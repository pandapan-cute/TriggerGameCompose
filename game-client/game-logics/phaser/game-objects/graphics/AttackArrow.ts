/**
 * 攻撃矢印を描画するクラス
 */
export class AttackArrow extends Phaser.GameObjects.Graphics {

  /**
   * 攻撃矢印を描画するコンストラクタ
   * @param scene 
   * @param x1 
   * @param y1 
   * @param x2 
   * @param y2 
   */
  constructor(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number) {
    super(scene);
    super.lineStyle(4, 0x0091EA);
    super.fillStyle(0x0091EA);

    const arrowSize = 15; // 矢印の先端の大きさ

    // 線の描画
    this.beginPath();
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.stroke();
    this.setDepth(1); // トリガー扇形より前面に表示

    // 矢印の角度を計算 (ラジアン)
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);

    // 先端の三角形を描画
    // 角度から少しずらした3点を計算し、終点に配置
    this.fillTriangle(
      x2,
      y2,
      x2 - Math.cos(angle - Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle - Math.PI / 6) * arrowSize,
      x2 - Math.cos(angle + Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle + Math.PI / 6) * arrowSize
    );
    scene.add.existing(this);
  }


  /**
   * アニメーション付きの矢印を描画
   * 描画完了後は自動的に削除される
   */
  public drawAnimatedArrow() {
    this.setAlpha(0);
    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 250,
      delay: 0,
      ease: "Power2",
      onComplete: () => {
        this.destroy();
      },
    });
  }
}