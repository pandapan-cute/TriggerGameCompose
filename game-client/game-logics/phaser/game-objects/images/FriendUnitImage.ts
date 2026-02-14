import { GridConfig } from "@/game-logics/types";
import "phaser";

/**
 * 味方ユニットの画像を表すクラス
 */
export class FriendUnitImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number, unitTypeId: string, gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId);
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(
      gridConfig.hexRadius * 1.2,
      gridConfig.hexRadius * 1.2
    ); // 六角形に合わせたサイズ
    this.setDepth(2); // 前面に表示

    // 青い色調を追加（自分のキャラクター識別用）
    this.setTint(0xadd8e6); // 薄い青色

    // キャラクターをクリック可能にする
    this.setInteractive();

    scene.add.existing(this);
  }
}