'use client';
import "phaser";

/**
 * 行動完了テキストを表示するクラス
 */
export class ActionCompletedText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string) {
    super(scene, x, y, text, {
      fontSize: "12px",
      color: "#ff0000",
      backgroundColor: "#ffffff",
      padding: { x: 4, y: 2 },
    });

    this.setOrigin(0.5, 0.5);
    this.setDepth(3); // キャラクターより前面

    scene.add.existing(this);
  }
}
