import { GridConfig } from "@/game-logics/types";
import "phaser";
import { UnitImage } from "./UnitImage";

/**
 * 敵ユニットの画像を表すクラス
 */
export class EnemyUnitImage extends UnitImage {

  constructor(scene: Phaser.Scene, x: number, y: number, gridConfig: GridConfig) {

    super(scene, x, y, "UNKNOWN", gridConfig);

    // 相手のキャラクターは上下反転
    this.setFlipY(true);

    this.scene.add.existing(this);
  }
}