/**
 * 残り時間アイコンを表すクラス
 */
export class RemainSecondsImage extends Phaser.GameObjects.Image {

  private colorFX: Phaser.FX.ColorMatrix;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "hourglass");
    this.setOrigin(1.4, 0.2);
    this.setDisplaySize(14, 14);
    this.setDepth(3); // キャラクターより前面に表示
    this.colorFX = this.postFX.addColorMatrix();
  }

  /**
   * 残り時間アイコンのテクスチャをグレースケールにする 
   */
  updateImageGray() {
    this.colorFX.grayscale(1);
  }

  /**
   * 残り時間アイコンのテクスチャを通常のカラーに戻す
   */
  resetImageColor() {
    this.colorFX.reset();
  }
}