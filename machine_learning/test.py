import gymnasium as gym
import numpy as np
import time
from stable_baselines3 import PPO
from main import WtGymEnv  # 先ほど作ったカスタム環境をインポート

def main():
    print("--- 訓練済みワートリAIの評価モード起動 ---")

    # 1. 環境の準備
    env = WtGymEnv()

    # 2. 生成されたzipファイルからモデル（脳みそ）をロード
    model = PPO.load("models/wt_ppo_final_model", env=env)
    print("モデルの読み込みに成功しました！")

    # 3. 環境を初期化して、最初の状態（ユニットの初期位置など）を取得
    obs, _ = env.reset()
    done = False
    
    turn_count = 1

    # 4. ゲーム終了までAIに操作させるループ
    while not done:
        print(f"\n--- ターン {turn_count} の行動予約開始 ---")
        
        # 1ターン分（4体×15ステップ＝60回のアクション予約）をループ
        # ※現在の環境の仕様上、15ステップ埋まるまで一斉行動が走らないため
        for step_idx in range(15):
            for unit_idx in range(4):
                # AIに現在の状態（obs）を見せて、次の一手（action）を予測させる
                # deterministic=False にすることで、確率的に行動を選択する（探索的な行動）ようになる
                action, _ = model.predict(obs, deterministic=True)

                # 環境にアクションを送り、次の状態、報酬、終了判定を取得
                obs, reward, done, _, _ = env.step(action)

        print(f"ターン {turn_count} の一斉行動フェーズが実行されました。")
        
        # 💡 ここで現在のユニットの位置を表示して、AIが動いているか確認！
        print("【味方ユニットの現在地】")
        friends = [u for u in env.rust_env.units if u.owner_player_id.value == env.rust_env.my_player_id.value]
        for i, u in enumerate(friends):
            print(f"  ユニット {i}: ({u.position.col}, {u.position.row})")
            
        turn_count += 1
        time.sleep(1)  # ログが見やすいように1秒待つ

        if turn_count > 6: # 無限ループ防止用の安全弁
            print("6ターンに達したため検証を終了します。")
            break

    print("--- 評価終了 ---")

if __name__ == "__main__":
    main()