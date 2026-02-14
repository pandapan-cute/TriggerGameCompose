'use client';
import { HexUtils } from "../hexUtils";
import { GridConfig } from "../types";
import { FIELD_STEPS } from "../config/FieldData";
import { HexagonCell } from "../phaser/game-objects/graphics/HexagonCell";
import { OnGridCellText } from "../phaser/game-objects/texts/OnGridCellText";

interface FieldViewCell {
  /** 可視性の色付けグラフィック */
  backGroundGraphic: HexagonCell | null;
  /** そのセルが視認可能かどうか */
  canSight: boolean;
  /** タイル状の座標テキスト */
  tilePositionText: OnGridCellText | null;
}

/**
 * フィールドの視界領域の表示などを管理するクラス
 */
export class FieldViewState {
  /** フィールド状態を保持する2次元配列 */
  private fieldView: FieldViewCell[][];

  constructor(private hexUtils: HexUtils, private scene: Phaser.Scene, private gridConfig: GridConfig) {
    // フィールドビューを初期化（列×行）
    this.fieldView = Array.from({ length: gridConfig.gridWidth }, () =>
      Array.from({ length: gridConfig.gridHeight }, (): FieldViewCell => ({
        backGroundGraphic: null,
        canSight: false,
        tilePositionText: null,
      }))
    );
    // 背景画像の作成
    this.createBackground();
    // 背景タイルの作成
    this.createBackgroundTiles();
  }

  /**
   * 背景画像を作成・配置する
   */
  private createBackground() {
    const position = this.hexUtils.getHexPosition(
      0,
      0
    );

    // 背景画像を追加
    const background = this.scene.add.image(position.x - this.gridConfig.hexWidth / 2, position.y - this.gridConfig.hexHeight / 2, "gameBackground");
    background.setOrigin(0, 0); // 左上角を基準点に設定
    background.setDepth(0.2);
    background.setAlpha(0.7);
  }

  /**
   * 背景タイルを六角形グリッドに敷き詰める
   */
  private createBackgroundTiles() {
    // 各グリッドセルに六角形の背景を配置
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        const pos = this.hexUtils.getHexPosition(col, row);

        // ★ 作成したHexagonCellを保存
        const hexagon = new HexagonCell(this.hexUtils, this.scene, pos);
        this.fieldView[col][row].backGroundGraphic = hexagon;

        // 六角形の位置情報を書き込む
        this.fieldView[col][row].tilePositionText = new OnGridCellText(this.scene, this.hexUtils, { col, row });
      }
    }
  }

  /**
   * タイル上に表示するテキストを更新する
   * @param {"position" | "buildingHeight"} tileType - 表示するテキストの種類
   */
  changeTileText = (tileType: "position" | "buildingHeight") => {
    // 新しいテキストを作成
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        if (tileType === "position") {
          this.fieldView[col][row].tilePositionText?.switchToTilePosition();
        } else if (tileType === "buildingHeight") {
          this.fieldView[col][row].tilePositionText?.switchToBuildingHeight();
        }
      }
    }
  };


  /** 
   * 視認可能エリアのフィールドビューを設定する
   * @param sightArea 視認可能エリアの2次元配列
   */
  setSightAreaFieldView(sightArea: boolean[][]) {

    if (this.scene === null) {
      console.warn("Sceneが未初期化のため、視認可能エリアのフィールドビューを設定できません。");
      return;
    }
    for (const [rowIndex, row] of sightArea.entries()) {
      for (const [colIndex, col] of row.entries()) {

        if (col) {
          // 視界領域内
          if (this.fieldView[rowIndex][colIndex]?.canSight) {
            // 既に視認可能エリアの場合は何もしない
            continue;
          }
          // 視認可能エリアで、まだ背景グラフィックがない場合、新規作成
          const pos = this.hexUtils.getHexPosition(colIndex, rowIndex);

          if (this.fieldView[rowIndex][colIndex]?.backGroundGraphic) {
            // 既存の背景グラフィックがあれば削除
            this.fieldView[rowIndex][colIndex].backGroundGraphic?.switchCanSight();
          } else {
            const hexagon = new HexagonCell(this.hexUtils, this.scene, pos);
            this.fieldView[rowIndex][colIndex].backGroundGraphic = hexagon;
          }
          this.fieldView[rowIndex][colIndex].canSight = true;
        } else {
          // 既存の背景グラフィックがあれば削除
          this.fieldView[rowIndex][colIndex]?.backGroundGraphic?.switchCannotSight();
          this.fieldView[rowIndex][colIndex].canSight = false;
        }
      }
    }
  }
}