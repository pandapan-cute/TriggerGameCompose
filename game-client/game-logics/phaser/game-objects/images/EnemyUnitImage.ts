import { GridConfig } from "@/game-logics/types";
import "phaser";
import { UnitImage } from "./UnitImage";

/**
 * 敵ユニットの画像を表すクラス
 */
export class EnemyUnitImage extends UnitImage {

  constructor(scene: Phaser.Scene, unitTypeId: string | null, x: number, y: number, isBailout: boolean, visible: boolean, gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId ?? "UNKNOWN", gridConfig);

    // 相手のキャラクターは上下反転
    this.setFlipY(true);
    this.setVisible(!isBailout && visible); // 表示の判定

    this.scene.add.existing(this);
  }
}