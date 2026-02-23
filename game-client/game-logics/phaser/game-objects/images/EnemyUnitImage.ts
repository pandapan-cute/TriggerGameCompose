import { GridConfig } from "@/game-logics/types";
import "phaser";
import { UnitImage } from "./UnitImage";

/**
 * 敵ユニットの画像を表すクラス
 */
export class EnemyUnitImage extends UnitImage {

  constructor(scene: Phaser.Scene, x: number, y: number, isBailout: boolean, gridConfig: GridConfig) {

    super(scene, x, y, "UNKNOWN", gridConfig);

    // 相手のキャラクターは上下反転
    this.setFlipY(true);
    this.setVisible(!isBailout); // ベイルアウト状態なら非表示

    this.scene.add.existing(this);
  }
}