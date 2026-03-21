### 背景・課題

`createMouseInteraction` を中心に pointer/touch 処理が 1101 行の Scene に集中しており、UI とゲームロジックが密結合になっている。

### 提案内容

入力イベント処理を `InputController` クラスへ抽出し、`GridCellsScene` はイベント購読と委譲のみにする。

### 期待される効果

入力系バグの切り分けが容易になり、Scene の責務が軽くなる。

### 対象範囲

game-client

### 受け入れ条件

- [ ] pointer/touch 入力処理が `GridCellsScene.ts` から分離されている
- [ ] Scene 側は InputController の API 呼び出しのみで動作する
- [ ] 既存のドラッグ/ピンチ/クリック挙動が維持される

### 補足

主対象: `game-client/game-logics/phaser/scenes/GridCellsScene.ts`
Issue 1 完了後に着手推奨。
