/**
 * トリガー範囲内の点を表すクラス
 */
export class TriggerPoint extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, hexPosition: { x: number, y: number; }, pointColor: number) {
    super(scene);
    this.fillStyle(pointColor, 0.9); // 指定された色、90%透明度
    this.fillCircle(hexPosition.x, hexPosition.y, 4); // 半径4pxの円
    this.setDepth(1); // トリガー扇形より前面に表示
    this.setData('triggerRangePoint', true); // 識別用データ
    scene.add.existing(this);
  }
}