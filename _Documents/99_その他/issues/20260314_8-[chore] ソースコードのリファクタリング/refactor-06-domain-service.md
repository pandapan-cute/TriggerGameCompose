### 背景・課題

`step.rs` と `game.rs` が複数責務を持ち、ドメイン不変条件と処理手順が混在している。
特に `Step::step_start` が「検証・移動・戦闘生成」を、`to_player_step` が「視界投影」を抱えており肥大化している。

### 提案内容

以下のドメインサービスを導入する。

- `StepExecutionService`: action 検証・ユニット移動・戦闘生成（`step_start` の処理手順を移管）
- `VisibilityProjectionService`: プレイヤー別可視セル計算（`to_player_step` の視界ロジックを移管）

`Game::turn_start` は集約の整合管理（Turn のマージと結果 set）に専念させる。

### 期待される効果

ドメインモデルの可読性向上と仕様変更への耐性向上。

### 対象範囲

game_server

### 受け入れ条件

- [ ] `Step` から実行ロジックの一部がドメインサービスへ抽出されている
- [ ] `Game` からターン解決の詳細手順が分離されている
- [ ] 既存シナリオの結果が同等であることを確認できる

### 補足

主対象: `game_server/rust_app/src/domain/triggergame_simulator/models/step/step.rs` / `game.rs` / `turn.rs`
Issue 5 完了後に着手推奨。
