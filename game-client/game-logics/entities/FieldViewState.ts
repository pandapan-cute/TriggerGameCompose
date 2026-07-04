'use client';
import { HexUtils } from "../hexUtils";
import { GridConfig } from "../types";
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
  protected fieldView: FieldViewCell[][];

  constructor(protected hexUtils: HexUtils, protected scene: Phaser.Scene, protected gridConfig: GridConfig, protected fieldSteps: number[][], visibility: boolean[][]) {
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
    // 初期の視認可能エリアを設定
    this.setSightAreaFieldView(visibility);
  }

  /**
   * 背景画像を作成・配置する
   */
  protected createBackground() {
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
  protected createBackgroundTiles() {
    // 各グリッドセルに六角形の背景を配置
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        const pos = this.hexUtils.getHexPosition(col, row);

        // ★ 作成したHexagonCellを保存
        const hexagon = new HexagonCell(this.hexUtils, this.scene, pos);
        this.fieldView[col][row].backGroundGraphic = hexagon;

        // 六角形の位置情報を書き込む
        this.fieldView[col][row].tilePositionText = new OnGridCellText(this.scene, this.hexUtils, { col, row }, this.fieldSteps);
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
   * @param visibilty 視認可能エリアの2次元配列
   */
  protected setSightAreaFieldView(visibilty: boolean[][]) {

    if (this.scene === null) {
      console.warn("Sceneが未初期化のため、視認可能エリアのフィールドビューを設定できません。");
      return;
    }
    for (const [colIndex, col] of visibilty.entries()) {
      for (const [rowIndex, row] of col.entries()) {
        if (row === true && this.fieldView[rowIndex][colIndex].canSight !== true) {
          // 視認可能エリアのセルに切り替える
          this.fieldView[rowIndex][colIndex].canSight = true;
          this.fieldView[rowIndex][colIndex].backGroundGraphic?.switchCanSight();
        } else if (row === false && this.fieldView[rowIndex][colIndex].canSight !== false) {
          // 視認不可能エリアのセルに切り替える
          this.fieldView[rowIndex][colIndex].canSight = false;
          this.fieldView[rowIndex][colIndex]?.backGroundGraphic?.switchCannotSight();
        }
      }
    }
  }
}