import torch
import torch.nn as nn
from stable_baselines3 import PPO
from main import WtGymEnv

# ONNX用に「生のスコア（ロジット）だけを出力する」超シンプルなネットワークを定義
class PureActionNet(nn.Module):
    def __init__(self, policy):
        super().__init__()
        # SB3のモデルから、特徴量抽出（MLP）と行動決定（action_net）の層だけを拝借する
        self.features_extractor = policy.features_extractor
        self.mlp_extractor = policy.mlp_extractor
        self.action_net = policy.action_net

    def forward(self, x):
        # 1. 16次元の入力を特徴量に変換
        features = self.features_extractor(x)
        # 2. 隠れ層（ニューラルネットワークの中身）を通す
        latent_pi, _ = self.mlp_extractor(features)
        # 3. 各アクションの生スコア（計13次元）を計算してそのまま出力！
        return self.action_net(latent_pi)

def main():
    print("--- 確実な部分だけを抽出してONNXに変換します ---")
    
    env = WtGymEnv()
    model = PPO.load("models/wt_ppo_final_model", env=env)
    
    # 複雑なSB3のガワを剥ぎ取って、純粋な計算レイヤーだけにする
    pure_model = PureActionNet(model.policy)
    pure_model.eval()

    # あなたのObservation（16次元）
    dummy_input = torch.zeros((1, 17), dtype=torch.float32)
    
    with torch.no_grad():
        torch.onnx.export(
            pure_model,
            dummy_input,
            "models/wt_model.onnx",
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch_size"}},
            opset_version=15
        )
        
    print("✨ 大成功！ 'models/wt_model.onnx' が出力されました！")

if __name__ == "__main__":
    main()