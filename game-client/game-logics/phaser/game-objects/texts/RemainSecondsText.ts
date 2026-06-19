'use client';
import "phaser";

/**
 * 残り秒数表示テキストを表示するクラス
 */
export class RemainSecondsText extends Phaser.GameObjects.Text {

  private colorFX: Phaser.FX.ColorMatrix;

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
    this.postFX.addShadow(undefined, undefined, undefined, undefined, 0x962353, 1.0, 0); // 視認性を向上
    this.colorFX = this.postFX.addColorMatrix();

    scene.add.existing(this);
  }

  updateRemainSeconds(seconds: number) {
    this.setText(`${seconds}`);
  }

  /**
   * 残り時間テキストのテクスチャをグレースケールにする 
   */
  updateTextGray() {
    this.colorFX.grayscale(1);
  }

  /**
   * 残り時間テキストのテクスチャを通常のカラーに戻す
   */
  resetTextColor() {
    this.colorFX.reset();
  }
}
