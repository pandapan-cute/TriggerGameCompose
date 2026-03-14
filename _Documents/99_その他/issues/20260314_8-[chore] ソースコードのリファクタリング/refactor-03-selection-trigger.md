### 背景・課題

選択、移動可能セル表示、トリガー扇形表示が 1 ファイル内で混在し、変更時の影響範囲が広い。

### 提案内容

`SelectionService` と `TriggerSettingController` を導入し、以下のメソッドを抽出する。

- `selectCharacter`
- `showMovableHexes`
- `clearSelection`
- `startTriggerSetting`
- `showTriggerFan`
- `updateTriggerFan`
- `completeTriggerSetting`
- `clearTriggerDisplay`

### 期待される効果

キャラクター操作仕様の変更を安全に行えるようになる。

### 対象範囲

game-client

### 受け入れ条件

- [ ] 選択/移動可視化ロジックが Scene から分離されている
- [ ] トリガー設定ロジックが独立モジュール化されている
- [ ] 視界表示やハイライト表示が既存通り動作する

### 補足

主対象: `game-client/game-logics/phaser/scenes/GridCellsScene.ts`
Issue 2 完了後に着手推奨。
