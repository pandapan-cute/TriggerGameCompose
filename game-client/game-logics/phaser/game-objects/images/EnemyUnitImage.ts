import { GridConfig } from "@/game-logics/types";
import "phaser";

/**
 * 敵ユニットの画像を表すクラス
 */
export class EnemyUnitImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number, gridConfig: GridConfig) {

    super(scene, x, y, "UNKNOWN");
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(
      gridConfig.hexRadius * 1.2,
      gridConfig.hexRadius * 1.2
    ); // 六角形に合わせたサイズ
    this.setDepth(2); // 前面に表示

    // 相手のキャラクターは上下反転
    this.setFlipY(true);

    this.scene.add.existing(this);
  }
}