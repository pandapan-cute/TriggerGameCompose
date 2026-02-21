import { GridConfig } from "@/game-logics/types";
import { TriggerTypeText } from "../texts/TriggerTypeText";
import { HexUtils } from "@/game-logics/hexUtils";


export class TriggerFanShape extends Phaser.GameObjects.Graphics {
  private color: number;
  private triggerAngle: number;
  private triggerRange: number;

  constructor(scene: Phaser.Scene, x: number, y: number, color: number, private direction: number, triggerAngle: number = 60, triggerRange: number = 3, triggerName: string = "", private gridConfig: GridConfig, private hexUtils: HexUtils, visible: boolean) {
    super(scene);
    this.setDepth(1);
    this.setVisible(visible); // 初期状態では非表示

    // プロパティを保存
    this.color = color;
    this.triggerAngle = triggerAngle;
    this.triggerRange = triggerRange;

    // Phaserの座標系に合わせて角度を補正（-90度）
    const correctedDirection = direction - 90;
    // 扇形の初期描画
    this.updateTriggerShape(x, y, color, correctedDirection, triggerAngle, triggerRange);

    const label = new TriggerTypeText(scene, x, y, color, gridConfig, correctedDirection, triggerRange, triggerName, visible);

    // ラベル用の保存領域を追加
    this.setData("label", label);

    scene.add.existing(this);
  }


  /**
   * 0.75秒かけて扇形の回転と座標を更新する
   * @param direction トリガーの向き
   * @param x トリガーのX座標
   * @param y トリガーのY座標
   * @param triggerAngle トリガーの角度
   * @param triggerRange トリガーの範囲
   * @param triggerName トリガーの名前
   */
  updateTriggerAzimuth(direction: number, x: number, y: number, triggerAngle: number, triggerRange: number, triggerName: string) {
    this.direction = direction;
    this.triggerAngle = triggerAngle;
    this.triggerRange = triggerRange;
    // 扇形の更新
    this.updateTriggerShape(x, y, this.color, direction - 90, triggerAngle, triggerRange);
    this.setVisible(true); // 更新時に扇形を表示

    const correctedDirection = direction - 90;
    const label = this.getData('label');
    if (label) {
      label.setText(triggerName);
      label.setPosition(
        x + Math.cos((correctedDirection * Math.PI) / 180) * this.gridConfig.hexRadius * triggerRange + 1.0,
        y + Math.sin((correctedDirection * Math.PI) / 180) * this.gridConfig.hexRadius * triggerRange + 1.0,
      );
      label.setVisible(true);
    }
  }

  /**
   * トリガー範囲内のマスの中心に赤い点を表示する
   * @param centerX - トリガー中心のX座標
   * @param centerY - トリガー中心のY座標
   * @param direction - トリガーの向き（度数法）
   * @param triggerAngle - トリガーの角度
   * @param triggerRange - トリガーの範囲
   * @param pointColor - 赤い点の色（デフォルトは赤色0xff0000）
   * @return 描画した点のGraphicsオブジェクトの配列
   */
  drawTriggerRangePoints(
    centerCol: number,
    centerRow: number,
    pointColor: number = 0xff0000
  ) {
    // 既存の赤い点を削除（もしあれば）
    const existingPoints = this.scene.children.getChildren().filter(child =>
      child.getData && child.getData('triggerRangePoint') === true
    );
    existingPoints.forEach(point => point.destroy());

    const centerPos = this.hexUtils.getHexPosition(centerCol, centerRow);

    const correctedDirection = this.direction - 90;

    const points: Phaser.GameObjects.Graphics[] = [];

    // トリガー範囲内のマスをチェック
    for (let col = centerCol - this.triggerRange - 5; col <= centerCol + this.triggerRange + 5; col++) {
      for (let row = centerRow - this.triggerRange - 5; row <= centerRow + this.triggerRange + 5; row++) {
        // グリッド範囲内かチェック
        if (col < 0 || col >= this.gridConfig.gridWidth ||
          row < 0 || row >= this.gridConfig.gridHeight) {
          continue;
        }

        // 中心からの距離をチェック
        const distance = this.hexUtils.calculateHexDistance(centerCol, centerRow, col, row);
        if (distance > this.gridConfig.hexHeight * (this.triggerRange + 0.5)) {
          continue;
        }

        // マスの中心座標を取得
        const hexPosition = this.hexUtils.getHexPosition(col, row);

        // 中心からマスへの角度を計算
        const angleToHex = Math.atan2(
          hexPosition.y - centerPos.y,
          hexPosition.x - centerPos.x
        ) * (180 / Math.PI);

        // 角度を0-360度の範囲に正規化
        const normalizedAngleToHex = ((angleToHex + 360) % 360);
        const normalizedDirection = ((correctedDirection + 360) % 360);

        // トリガー角度の範囲内かチェック
        const halfAngle = this.triggerAngle / 2;
        let angleDiff = Math.abs(normalizedAngleToHex - normalizedDirection);

        // 360度境界を跨ぐ場合の調整
        if (angleDiff > 180) {
          angleDiff = 360 - angleDiff;
        }

        if (angleDiff <= halfAngle) {
          // 赤い点を描画
          const point = this.scene.add.graphics();
          point.fillStyle(pointColor, 0.6); // 指定された色、60%透明度
          point.fillCircle(hexPosition.x, hexPosition.y, 6); // 半径6pxの円
          point.setDepth(1); // トリガー扇形より前面に表示
          point.setData('triggerRangePoint', true); // 識別用データ
          points.push(point);
        }
      }
    }
    return points;
  }

  /**
   * 現在の扇形を更新して再描画するヘルパー関数
   * @param x 
   * @param y 
   * @param color 
   * @param direction 
   * @param triggerAngle 
   * @param triggerRange 
   */
  private updateTriggerShape(x: number, y: number, color: number, direction: number, triggerAngle: number, triggerRange: number) {
    this.clear(); // 既存の描画をクリア

    // 扇形の設定（トリガーの実際のangleとrangeを使用）
    // WARNING: サーバー側の処理とそろえること
    const radius = this.gridConfig.hexHeight * (triggerRange + 0.5); // 半径はrangeに基づく

    // 開始角度と終了角度を計算（度数を使用）
    const startAngle = (direction - triggerAngle / 2) * (Math.PI / 180);
    const endAngle = (direction + triggerAngle / 2) * (Math.PI / 180);

    // 扇形を描画
    this.fillStyle(color, 0.5);
    this.lineStyle(2, color, 0.8);

    this.beginPath();
    this.moveTo(x, y);
    this.arc(
      x,
      y,
      radius,
      startAngle,
      endAngle,
      false
    );
    this.closePath();
    this.fillPath();
    this.strokePath();
  }
}