import { HexUtils } from "@/game-logics/hexUtils";
import { OnGridCellText } from "@/game-logics/phaser/game-objects/texts/OnGridCellText";
import { GridConfig } from "@/game-logics/types";
import { ThreeDHexagonCell } from "../graphics/ThreeDHexagonCell";
import { Scene3D } from "@enable3d/phaser-extension/dist/scene3d";

interface FieldViewCell {
  /** 可視性の色付けグラフィック */
  backGroundGraphic: ThreeDHexagonCell | null;
  /** そのセルが視認可能かどうか */
  canSight: boolean;
}

/**
 * 3D版のフィールドの視界領域の表示などを管理するクラス
 */
export class ThreeDFieldViewState {
  /** フィールド状態を保持する2次元配列 */
  protected fieldView: FieldViewCell[][];
  /** 3D配置を原点基準に寄せるためのオフセット */
  private readonly gridOriginOffset: { x: number; y: number; };

  constructor(protected hexUtils: HexUtils, protected scene: Scene3D, protected gridConfig: GridConfig, protected fieldSteps: number[][], visibility: boolean[][]) {
    this.gridOriginOffset = this.calculateGridOriginOffset();

    // フィールドビューを初期化（列×行）
    this.fieldView = Array.from({ length: gridConfig.gridWidth }, () =>
      Array.from({ length: gridConfig.gridHeight }, (): FieldViewCell => ({
        backGroundGraphic: null,
        canSight: false,
      }))
    );
    // 背景タイルの作成
    this.createBackgroundTiles();
    // 初期の視認可能エリアを設定
    this.setSightAreaFieldView(visibility);
  }

  /**
   * 背景タイルを六角形グリッドに敷き詰める
   */
  protected createBackgroundTiles() {
    // 各グリッドセルに六角形の背景を配置
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        const pos = this.toLocalGridPosition(this.hexUtils.getHexPosition(col, row));

        // ★ 作成したHexagonCellを保存
        const hexagon = new ThreeDHexagonCell(this.hexUtils, this.scene, pos);
        this.fieldView[col][row].backGroundGraphic = hexagon;
      }
    }
  }


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

  /**
   * グリッド全体の中心を原点に合わせるためのオフセットを計算する
   */
  private calculateGridOriginOffset(): { x: number; y: number; } {
    const gridWidth = this.gridConfig.gridWidth * this.gridConfig.hexWidth * 0.75 + this.gridConfig.hexWidth;
    const gridHeight = this.gridConfig.gridHeight * this.gridConfig.hexHeight + this.gridConfig.hexHeight;

    return {
      x: gridWidth / 2,
      y: gridHeight / 2,
    };
  }

  /**
   * 2D の画面座標を 3D のローカル座標へ変換する
   */
  private toLocalGridPosition(position: { x: number; y: number; }): { x: number; y: number; } {
    return {
      x: position.x - this.gridOriginOffset.x,
      y: position.y - this.gridOriginOffset.y,
    };
  }
}