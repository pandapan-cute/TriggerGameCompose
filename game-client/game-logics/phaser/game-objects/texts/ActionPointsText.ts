'use client';
import "phaser";

/**
 * 行動力表示テキストを表示するクラス
 */
export class ActionPointsText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, points: number) {
    super(scene, x, y, `${points}`, {
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#1e293b",
      padding: { x: 2, y: 0 },
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

  updatePoints(points: number) {
    this.setText(`${points}`);
  }
}
