/**
 * 行動力アイコンを表すクラス
 */
export class ActionPointImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "flash");
    this.setOrigin(0.4, 1.8);
    this.setDisplaySize(18, 18);
    this.setDepth(3); // キャラクターより前面に表示
  }
}