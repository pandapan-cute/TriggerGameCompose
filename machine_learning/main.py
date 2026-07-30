import math

import gymnasium as gym
from gymnasium import spaces
import numpy as np
import os
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
import wt_env  # MaturinでビルドしたRustモジュール

class WtGymEnv(gym.Env):
    """
    Rustで記述されたワートリシミュレータをStable-Baselines3で扱えるようにするラッパー環境
    """
    def __init__(self):
        super(WtGymEnv, self).__init__()
        # Rust環境の初期化
        self.rust_env = wt_env.WtEnv()
        
        # --- 行動空間 (Action Space) の定義 ---
        self.action_space = spaces.MultiDiscrete([7, 12, 12])  # 6角型マスの移動先or待機のターゲットを選ぶ（-1,0,1の組み合わせ）
        
        # --- 状態空間 (Observation Space) の定義 ---
        # AIが見る情報。今回はシンプルに「4体の味方位置(x,y)」と「4体の敵位置(x,y)」＝計16次元のベクトルとします
        # 実際にはHPやトリガー情報なども追加していくとより賢くなります
        # 観測を正規化して float にする（各座標を0.0-1.0にスケーリング）
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(17,),
            dtype=np.float32,
        )

    def _get_obs(self):
        """Rustの環境状態からPython（Gym）用の観測ベクトルを取り出す"""
        obs_vector = []
        
        # 例：.value などで内部のUUID文字列を取り出して比較する
        my_id_str = str(self.rust_env.my_player_id.value)
        enemy_id_str = str(self.rust_env.enemy_player_id.value)
        
        friends = [u for u in self.rust_env.units if str(u.owner_player_id.value) == my_id_str]
        for u in friends:
            # position の col,row を 0.0-1.0 に正規化して格納
            obs_vector.extend([u.position.col / 35.0, u.position.row / 35.0])
            
        enemies = [u for u in self.rust_env.units if str(u.owner_player_id.value) == enemy_id_str]
        for u in enemies:
            obs_vector.extend([u.position.col / 35.0, u.position.row / 35.0])
        # 追加: 現在フォーカスされているユニットのインデックスを正規化して観測に含める
        # 4体ユニットなので 0..3 を 0.0..1.0 に正規化
        obs_vector.append(float(self.rust_env.current_unit_idx) / 3.0)

        return np.array(obs_vector, dtype=np.float32)
    
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.rust_env.reset()
        
        # 初期状態の取得
        obs = self._get_obs()
        return obs, {}

    def step(self, action):
        action_idx = int(action[0])  # 0〜6の整数
        main_trigger_angle = int(action[1]) * 30  # 0〜330の整数（12分割）
        sub_trigger_angle = int(action[2]) * 30  # 0〜330の整数（12分割）
        # 1. 現在フォーカスされているユニットを取得
        # （Rustのqueue_action内部のロジックをシミュレートしてどのユニットのアクションを作るか特定）
        friends = [u for u in self.rust_env.units if str(u.owner_player_id.value) == str(self.rust_env.my_player_id.value)]
        current_unit = friends[self.rust_env.current_unit_idx]

        # 2. 離散的なアクションID(0〜7)から、盤面の(col, row)座標に逆変換
        target_col = current_unit.position.col
        target_row = current_unit.position.row

        # 盤内の移動先が出るまでループさせる
        for _ in range(10): # 最大10回まで試行
                
            # 偶数列と奇数列で隣接パターンが異なる
            # game-client/game-logics/hexUtils.ts#getHexNeighborsのロジックを参考にしています
            if (current_unit.position.col % 2 == 0):
                # 偶数列の場合
                d_col = [0, -1, -1, 0, 0, 1, 1][action_idx]
                d_row = [0, -1, 0, -1, 1, -1, 0][action_idx]
            else:
                # 奇数列の場合
                d_col = [0, -1, -1, 0, 0, 1, 1][action_idx]
                d_row = [0, 0, 1, -1, 1, 0, 1][action_idx]
            
            reserve_target_col = current_unit.position.col + d_col
            reserve_target_row = current_unit.position.row + d_row

            if 0 <= reserve_target_col < 36 and 0 <= reserve_target_row < 36:
                target_col = reserve_target_col
                target_row = reserve_target_row
                break
        
        # 3. RustのActionインスタンスを生成
        # 簡略化のため、今回は「Move」アクションを固定で作成
        # （将来的にActionTypeValueやTriggerIdをPythonにpyclass公開すれば、ここで攻撃等を選べます）
        rust_action = wt_env.ActionDto(
            "Move",  # action_type
            current_unit.unit_id.value,
            current_unit.unit_type_id.value,
            target_col,
            target_row,
            current_unit.using_main_trigger_id.value,
            current_unit.using_sub_trigger_id.value,
            main_trigger_angle,  # メイントリガー角度
            sub_trigger_angle,  # サブトリガー角度
        )
        
        # 4. Rust側に行動を予約させる
        success = self.rust_env.queue_action(rust_action)

        # 動きの結果を見たいとき
        # print(f"AI選定座標: ({target_col}, {target_row}) -> Rustの判定: {success}")
        
        # もしルール違反の移動（1マスより遠い、盤外など）だったら、AIにペナルティを与えて終了
        if not success:
            obs = self._get_obs()
            return obs, -0.5, False, False, {}

        # 5. 判定：15ステップ（15秒分＝全ユニットの予約完了）が埋まったか？
        # Rust側で全予約が埋まると、内部でstepsにプッシュされていく仕様
        if len(self.rust_env.steps) >= 15:
            # 15秒分の全行動が確定したので、一斉シミュレーションフェーズを実行！
            units, reward, done = self.rust_env.resolve_turn()
            
            obs = self._get_obs()
            print(f"一斉行動フェーズ終了: ターン={self.rust_env.turn_number.value}, reward={reward}, done={done}")
            return obs, reward, done, False, {}
        
        else:
            # まだ15秒分の予約フェーズの途中（次のユニットや次の秒数の入力中）
            # 予約段階ではゲームは進まないので、報酬は0、doneはFalseのまま次へ
            obs = self._get_obs()
            return obs, 0.0, False, False, {}

# --- 学習の実行メイン処理 ---
if __name__ == "__main__":
    print("--- ワールドトリガーAI 訓練開始 ---")
    
    # 独自のGym環境をインスタンス化
    env = WtGymEnv()
    
    # PPO（近接ポリシー最適化）モデルのセットアップ
    # 状態空間がシンプルなため、デフォルトのMlpPolicy（多層パーセプトロン）を使用
    model = PPO(
        "MlpPolicy", 
        env, 
        verbose=1,
        learning_rate=3e-4,
        ent_coef=0.02,
        n_steps=2048,
        batch_size=64,
        tensorboard_log="./tensorboard_logs/" # 学習進捗の可視化用
    )
    
    # 定期的にチェックポイント（脳みそデータ）を自動保存するコールバック
    checkpoint_callback = CheckpointCallback(
        save_freq=5000, 
        save_path="./models/",
        name_prefix="wt_ppo_model"
    )
    
    # 10万ステップ学習を実行（Rustが裏で動くのでかなり高速に回ります）
    model.learn(total_timesteps=100000, callback=checkpoint_callback)
    
    # 最終モデルの保存
    model.save("models/wt_ppo_final_model")
    print("--- 訓練完了。モデルを models/wt_ppo_final_model に保存しました ---")