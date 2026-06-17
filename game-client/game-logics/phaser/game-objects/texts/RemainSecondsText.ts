'use client';
import "phaser";

/**
 * 残り秒数表示テキストを表示するクラス
 */
export class RemainSecondsText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, seconds: number) {
    super(scene, x, y, `⏳${seconds}`, {
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
      fontFamily: "Michroma",
      backgroundColor: "#1e293baa",
      padding: { x: 2, y: 2 },
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: "#000000",
        blur: 4,
        fill: true,
      },
    });

    this.setOrigin(0.5, 0.5);
    this.setDepth(3); // キャラクターより前面

    scene.add.existing(this);
  }

  updateRemainSeconds(seconds: number) {
    this.setText(`⏳${seconds}`);
  }
}
