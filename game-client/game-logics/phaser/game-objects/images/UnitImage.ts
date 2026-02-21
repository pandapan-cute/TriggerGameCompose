import { GridConfig } from "@/app/game/[gameId]/page";

/**
 * ユニットの画像を表すクラス
 */
export class UnitImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number, unitTypeId: string, gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId);
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(
      gridConfig.hexRadius * 1.2,
      gridConfig.hexRadius * 1.2
    ); // 六角形に合わせたサイズ
    this.setDepth(2); // 前面に表示

    // キャラクターをクリック可能にする
    this.setInteractive();
  }

  /** ユニットを移動させるアニメーション */
  moveUnitTween(targetX: number, targetY: number, onUpdate: () => void, onComplete: () => void) {
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 750,
      ease: "Power2",
      onUpdate: onUpdate,
      onComplete: onComplete
    });
  }
}