/**
 * アクションポイントの円形のグラフィックを表すクラス
 */
export class ActionPointCircle extends Phaser.GameObjects.Graphics {

  private color = 0xf4d83f; // 初期色は黄色

  constructor(scene: Phaser.Scene, pos: { x: number; y: number; }) {
    super(scene);
    this.lineStyle(3, this.color);
    this.strokeCircle(pos.x, pos.y, 24); // 半径24pxの円
    this.setDepth(1); // トリガー扇形より前面に表示

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
    const startAngle = (endAngle + (360 * (currentPoints / maxPoints)) * (Math.PI / 180));
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

    // Tweenで色を滑らかにアニメーションさせる
    this.scene.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 3000,      // 3秒かけて変化
      ease: 'Linear',
      yoyo: true,          // 変化したら元の色に戻る
      loop: -1,            // 無限ループ
      onUpdate: (tween) => {
        // 0〜1の間で変化する値を取得
        const value = (tween?.getValue() ?? 0) / 100;

        // Phaserのカラー関数を使って、黄色(0xf4d83f)から緑(0x2ecc71)の間の色を補間
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xf4d83f), // 開始色（黄色）
          Phaser.Display.Color.ValueToColor(0x2ecc71), // 終了色（緑）
          100,
          tween?.getValue() ?? 0
        );

        // RGBからカラーコードを生成して適用
        const hexColor = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
        this.lineStyle(3, hexColor);
      }
    });

  }
}