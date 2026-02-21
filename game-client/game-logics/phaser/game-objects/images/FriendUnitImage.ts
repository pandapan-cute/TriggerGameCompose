import { GridConfig } from "@/game-logics/types";
import "phaser";
import { UnitImage } from "./UnitImage";

/**
 * 味方ユニットの画像を表すクラス
 */
export class FriendUnitImage extends UnitImage {

  constructor(scene: Phaser.Scene, x: number, y: number, unitTypeId: string, gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId, gridConfig);

    // 青い色調を追加（自分のキャラクター識別用）
    this.setTint(0xadd8e6); // 薄い青色

    scene.add.existing(this);
  }
}