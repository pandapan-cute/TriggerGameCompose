'use client';
import { FIELD_STEPS } from "@/game-logics/config/FieldData";
import { HexUtils } from "@/game-logics/hexUtils";
import "phaser";

/**
 * 座標テキストを表示するクラス
 * （テスト向き）
 */
export class OnGridCellText extends Phaser.GameObjects.Text {

  private position: { col: number; row: number; };

  constructor(scene: Phaser.Scene, hexUtils: HexUtils, position: { col: number; row: number; }) {
    const pos = hexUtils.getHexPosition(position.col, position.row);
    super(scene, pos.x, pos.y, `(${position.col},${position.row})`, {
      fontSize: "9px",
      color: "#000",
      fontFamily: "monospace",
      backgroundColor: "rgba(255, 255, 255, 0.7)",
      padding: { x: 2, y: 1 },
    });

    this.setOrigin(0.5, 0.5);
    this.setDepth(0.1);

    scene.add.existing(this);

    this.position = position;
  }

  /** タイル上にセル座標を表示 */
  switchToTilePosition() {
    this.setText(`(${this.position.col},${this.position.row})`);
  };

  /** タイル上に建物の高さを表示 */
  switchToBuildingHeight() {
    const buildingHeight = FIELD_STEPS[this.position.row][this.position.col];
    this.setText(buildingHeight.toString());
  }
}