# ONNX変換

Stable-Baselines3（PyTorch）のモデルをONNXに変換し、それをRust（`tract` クレート）で読み込んで超高速に推論するまでの具体的な手順を解説します。

---

## 🛠️ ステップ1：Python側でONNX形式にエクスポートする

まずは、Python環境にONNX変換用のライブラリをインストールします。

```bash
pip install onnx

```

次に、`machine_learning` フォルダの中に **`export_onnx.py`** という名前で以下のスクリプトを作成し、実行してください。学習済みの `.zip` をロードして、Rustが読める `.onnx` ファイルに変換します。

これを実行すると、`models/wt_model.onnx` という単一のファイルが生成されます。Pythonの役目はここで一旦終了です！

---

## 🦀 ステップ2：Rust側でONNXを読み込んで推料（予測）する

ここからはRust側のプロジェクト（サービス）の実装です。
今回は、純Rust製でクロスコンパイルが非常に簡単な **`tract`** というライブラリを使用します。

### 1. `Cargo.toml` の設定

`Cargo.toml` の `[dependencies]` に以下を追加してください。

```toml
[dependencies]
# ONNXモデルを扱うためのクレート
tract-onnx = "0.21" # 2026年現在の安定バージョン

```

### 2. Rustでの推論コード（`ai_service.rs`）

AIに「16次元の状態」を渡して、「移動(0〜8)」と「トリガー向き(0〜3)」のアクションを返してもらうサービス関数を実装します。

```rust
use tract_onnx::prelude::*;

pub struct WtAiService {
    // コンパイル済みのONNXモデル（RunnableModel）を保持する
    model: SimplePlan<TypedFact, Box<dyn TypedOp>, Graph<TypedFact, Box<dyn TypedOp>>>,
}

impl WtAiService {
    /// ONNXファイルを読み込んで初期化する
    pub fn new(model_path: &str) -> TractResult<Self> {
        // 1. ONNXモデルの読み込みと最適化
        let model = tract_onnx::onnx()
            // ファイルパスを指定
            .model_for_path(model_path)?
            // 入力データの型（f32）と形状（1行16列）を指定
            .with_input_fact(0, f32::fact(&[1, 16]).into())?
            // モデルを使いやすい形に最適化（コンパイル）
            .into_optimized()?
            // 実行可能なプラン（Plan）に変換
            .into_runnable()?;

        Ok(Self { model })
    }

    /// 現在の状態（16次元）から、敵AIのアクション（移動, 向き）を予測する
    pub fn predict(&self, obs: &[i32; 16]) -> TractResult<(i64, i64)> {
        // 1. i32の配列を、ONNXが求める f32 のテンソル（行列）に変換
        let f32_obs: Vec<f32> = obs.iter().map(|&x| x as f32).collect();
        let input_tensor = rctensor2(&[[
            f32_obs[0], f32_obs[1], f32_obs[2], f32_obs[3],
            f32_obs[4], f32_obs[5], f32_obs[6], f32_obs[7],
            f32_obs[8], f32_obs[9], f32_obs[10], f32_obs[11],
            f32_obs[12], f32_obs[13], f32_obs[14], f32_obs[15],
        ]]);

        // 2. モデルを実行（推論）
        // 入力レイヤーにテンソルを流し込む
        let mut outputs = self.model.run(tvec!(input_tensor.into()))?;

        // 3. 出力データの解析
        // Stable-Baselines3のモデルは、出力として「各アクションの確率分布（ロジットなど）」を返します
        // 今回は MultiDiscrete([9, 4]) なので、出力テンソルから一番確率が高いインデックス（ArgMax）を探します
        let output_tensor = outputs.remove(0);
        let output_values: &[f32] = output_tensor.as_slice()?;

        // 前半9要素が「移動」の確率分布、後半4要素が「トリガー向き」の確率分布
        let move_logits = &output_values[0..9];
        let azimuth_logits = &output_values[9..13];

        // 一番スコア（確率）が高いインデックスを抽出
        let predicted_move = move_logits
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(index, _)| index as i64)
            .unwrap_or(4); // 失敗したら4（Wait）

        let predicted_azimuth = azimuth_logits
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(index, _)| index as i64)
            .unwrap_or(0); // 失敗したら0（北）

        Ok((predicted_move, predicted_azimuth))
    }
}

```

### 3. メイン処理（サービスへの組み込み例）

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // サービスの初期化（サーバー起動時などに1回だけロードする）
    let ai_service = WtAiService::new("models/wt_model.onnx")?;
    println!("Rust側でAIモデル（ONNX）のロードに成功しました！");

    // 模擬のゲームループ
    // 例：味方4体と敵4体の (col, row) 座標の配列
    let current_obs: [i32; 16] = [
        4, 34, 12, 34, 20, 34, 28, 34, // 味方
        4, 2,  12, 2,  20, 2,  28, 2   // 敵
    ];

    // 敵のターンになったらAIに予測させる
    let (action_move, action_azimuth) = ai_service.predict(&current_obs)?;

    println!("🤖 AI敵ユニットの予測結果:");
    println!("  -> 移動方向: {}", action_move);
    println!("  -> トリガーの向き: {}", action_azimuth);

    // あとはこの数値を基に、Rust側で敵のアクションを生成して queue に突っ込むだけ！
    Ok(())
}

```

---

## 🎯 このアプローチのここが最高！

1. **Pythonの呪縛からの解放：**
Rustのバイナリを実行する際、PCにPythonがインストールされている必要も、重たいPyTorchを裏で動かす必要もありません。Rustだけで完結します。
2. **圧倒的なパフォーマンス：**
Pythonを経由するオーバーヘッドが一切ないため、1回の予測にかかる時間は **マイクロ秒（0.001秒以下）** レベルになります。100体以上の大乱戦シミュレーションを回してもビクともしません。

このONNX化が成功すれば、完全にRust主体の「本格的なワートリ対戦ゲーム」のバックエンドが完成します。ぜひ組み込んでみてください！