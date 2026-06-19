/**
 * アクションポイントの円形のグラフィックを表すクラス
 */
export class ActionPointCircle extends Phaser.GameObjects.Graphics {

  private color = 0xf4d83f;

  constructor(scene: Phaser.Scene, pos: { x: number; y: number; }) {
    super(scene);
    this.lineStyle(3, this.color);
    this.strokeCircle(pos.x, pos.y, 24); // 半径24pxの円
    this.setDepth(1); // トリガー扇形より前面に表示
    this.postFX.addGlow(0x000000, 0.7, 0); // 視認性を向上

    scene.add.existing(this);
  }

  /**
   * アクションポイントの円形のグラフィックを更新する
   * @param pos 円の中心位置
   * @param maxPoints 最大アクションポイント
   * @param currentPoints 現在のアクションポイント
   */
  updatePoint(pos: { x: number; y: number; }, maxPoints: number, currentPoints: number) {
    this.clear(); // 既存の描画をクリア

    const endAngle = -90 * (Math.PI / 180); // 上方向を基準にするため-90度
    // 開始角度と終了角度を計算（度数を使用）
    const startAngle = maxPoints === currentPoints ? 270 * (Math.PI / 180) : endAngle + (360 * ((maxPoints - currentPoints) / maxPoints)) * (Math.PI / 180);

    if (currentPoints === 0) {
      return; // アクションポイントがない場合は描画しない
    }
    const radius = 24; // 半径24pxの円

    // 扇形を描画
    this.lineStyle(3, this.color, 1.0);

    this.beginPath();
    this.arc(
      pos.x,
      pos.y,
      radius,
      startAngle,
      endAngle,
      false
    );
    this.strokePath();
    this.closePath();
  }
}