import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";
import { ThreeDHexagonCell } from "../graphics/ThreeDHexagonCell";
import { Scene3D } from "@enable3d/phaser-extension/dist/scene3d";
import { ThreeDCharacterPlacementService } from "../services/ThreeDCharacterPlacementService";

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
  /** 3D配置の座標変換サービス */
  private readonly placementService: ThreeDCharacterPlacementService;

  constructor(protected hexUtils: HexUtils, protected scene: Scene3D, protected gridConfig: GridConfig, protected fieldSteps: number[][], visibility: boolean[][]) {
    this.placementService = new ThreeDCharacterPlacementService(gridConfig);

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
        const pos = this.placementService.fromGrid(this.hexUtils, col, row);

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
  public setSightAreaFieldView(visibilty: boolean[][]) {

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