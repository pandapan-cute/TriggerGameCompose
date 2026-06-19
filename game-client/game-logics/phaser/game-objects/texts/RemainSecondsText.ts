'use client';
import "phaser";

/**
 * 残り秒数表示テキストを表示するクラス
 */
export class RemainSecondsText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, seconds: number) {
    super(scene, x, y, `${seconds}`, {
      fontSize: "14px",
      color: "#f43f9aff",
      fontStyle: "bold",
      fontFamily: "Michroma",
      padding: { x: 2, y: 2 },
    });

    this.setOrigin(0.3, 0.2);
    this.setDepth(3); // キャラクターより前面

    scene.add.existing(this);
  }

  updateRemainSeconds(seconds: number) {
    this.setText(`${seconds}`);
  }
}
