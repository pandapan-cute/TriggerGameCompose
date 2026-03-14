### 背景・課題

`recordActionHistory` と `executeTurn` が同居し、送信前ロジックと受信再生ロジックが混ざっている。

### 提案内容

以下の 2 クラスを Scene から分離する。

- `TurnPlanner`: Step 構築・AP 管理・送信可否判定（`recordActionHistory` `consumeActionPoint` `checkAllCharactersActionPointsCompleted` を移管）
- `TurnReplayController`: 受信 Turn の再生と UI 更新（`executeTurn` `completeUnitActionPhase` を移管）

### 期待される効果

非同期処理やアニメーション不具合の修正がしやすくなる。

### 対象範囲

game-client

### 受け入れ条件

- [ ] `recordActionHistory` 相当が TurnPlanner に移管されている
- [ ] `executeTurn` 相当が TurnReplayController に移管されている
- [ ] `GridCellsScene.ts` が概ね 400 行以下に縮小されている

### 補足

主対象: `game-client/game-logics/phaser/scenes/GridCellsScene.ts`
Issue 2・3 完了後に着手推奨。
