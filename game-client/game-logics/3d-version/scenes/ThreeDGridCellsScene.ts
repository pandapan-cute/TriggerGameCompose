import { GridCellsScene } from "../../phaser/scenes/GridCellsScene";
import { ThreeDFieldViewState } from "../entities/ThreeDFieldViewState";
import { ThreeDCharacterPlacementService } from "../services/ThreeDCharacterPlacementService";
import { ThreeDUnitObject } from "../graphics/ThreeDUnitObject";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";
import { ThreeDCharacterManager } from "../characterManager";
import { ThreeDInputController } from "./inputs/ThreeDInputController";
import { ThreeDPlayerCharacterState } from "../entities/ThreeDPlayerCharacterState";
import {
  ThreeDSelectionService,
  type ThreeDSelectionServiceDeps,
} from "./services/ThreeDSelectionService";
import { FieldViewService } from "../../phaser/scenes/services/FieldViewService";

/**
 * 3D盤面シーン。
 * 2Dの GridCellsScene を継承しつつ、3D表示・3D入力・3D移動処理を構成する。
 */
export class ThreeDGridCellsScene extends GridCellsScene {

  private threeDFieldViewState!: ThreeDFieldViewState;
  /** 3Dユニット表示オブジェクトの一覧 */
  private threeDCharacterManager: ThreeDCharacterManager = new ThreeDCharacterManager();
  private threeDInputController: ThreeDInputController | null = null;
  private readonly placementService: ThreeDCharacterPlacementService = new ThreeDCharacterPlacementService(this.gridConfig);
  private readonly unitGridPositions = new Map<ThreeDUnitObject, { col: number; row: number; }>();
  private readonly playerCharacterStates = new Map<ThreeDUnitObject, ThreeDPlayerCharacterState>();
  private threeDSelectionService: ThreeDSelectionService | null = null;
  private threeDFieldViewService: FieldViewService | null = null;

  public init() {
    // 💡 4. ここで3DモードをONにする！
    // これにより、このシーンだけ裏で Three.js や物理エンジンが起動します
    this.accessThirdDimension();
  }

  /** フィールドビューの状態管理を初期化する（3D版） */
  protected initializeFieldViewState() {
    this.threeDFieldViewState = new ThreeDFieldViewState(
      this.hexUtils,
      this,
      this.gridConfig,
      this.fieldSteps,
      this.visibility,
    );
  }

  /** 3D版のキャラクターを配置する */
  protected createCharacters() {
    this.friendUnits.forEach((unit) => {
      const unitObject = this.placeUnit(unit, this.placementService);
      if (unitObject) {
        // 味方キャラクターの向きを反転させる
        unitObject.rotation.y = Math.PI;
        this.threeDCharacterManager.player3DCharacters.push(unitObject);
        this.playerCharacterStates.set(unitObject, new ThreeDPlayerCharacterState(unitObject, unit));
        this.unitGridPositions.set(unitObject, { ...unit.position });
      }
    });

    // 相手のキャラクターは既存2D仕様と同様に反転座標で配置する
    this.enemyUnits.forEach((unit) => {
      const invertedPosition = this.hexUtils.invertPosition(unit.position);
      const unitObject = this.placeUnit({ ...unit, position: invertedPosition }, this.placementService);
      if (unitObject) {
        this.threeDCharacterManager.enemy3DCharacters.push(unitObject);
        this.unitGridPositions.set(unitObject, { ...invertedPosition });
      }
    });
  }

  async create(): Promise<void> {
    // もとの2Dクラスのcreate（通信初期化など）をそのまま再利用して実行！
    super.create();
    await this.third.warpSpeed("-sky", "-ground"); // 3D空間の初期化
    this.third.camera.position.set(20, 20, 40);
    this.third.camera.lookAt(0, 0, 0);

    if (!this.threeDFieldViewService) {
      this.threeDFieldViewService = this.createThreeDFieldViewService();
    }

    if (!this.threeDSelectionService) {
      this.threeDSelectionService = new ThreeDSelectionService(this.createThreeDSelectionServiceDeps());
    }

    if (!this.threeDInputController) {
      this.threeDInputController = new ThreeDInputController(
        this,
        this.third.renderer,
        this.third.camera,
        {
          getSelectableUnits: () => [
            ...this.threeDCharacterManager.player3DCharacters,
            ...this.threeDCharacterManager.enemy3DCharacters,
          ],
          onSelectUnit: (unitObject) => {
            this.threeDSelectionService?.selectCharacter(unitObject);
          },
          getMovableCells: () => {
            return this.threeDSelectionService?.getMovableCellHighlights() ?? [];
          },
          onSelectMovableCell: (cell) => {
            this.threeDSelectionService?.moveSelectedCharacterByHighlight(cell);
          },
        }
      );
    }

    this.threeDInputController.bind();
    this.events.once("shutdown", () => {
      this.threeDInputController?.unbind();
      this.threeDSelectionService?.dispose();
    });
  }

  /**
   * 3Dユニットを盤面座標に配置して初期化する。
   * @param unit 配置対象ユニット情報。
   * @param placementService 3D座標変換サービス。
   * @returns 生成した 3D ユニット。配置不可時は undefined。
   */
  private placeUnit(unit: FriendUnit | EnemyUnit, placementService: ThreeDCharacterPlacementService): ThreeDUnitObject | undefined {
    const { col, row } = unit.position;
    if (col < 0 || row < 0 || col >= this.gridConfig.gridWidth || row >= this.gridConfig.gridHeight) {
      return;
    }

    const position = placementService.fromGridOnGround(this.hexUtils, col, row, 0.1);
    const unitObject = new ThreeDUnitObject(this, unit.unitTypeId, position.x, position.y, position.z);
    unitObject.setSelectUnitHandler(() => this.selectUnit(unitObject));
    unitObject.updateVisibility(!unit.isBailout);

    unitObject.loadDefaultModel();

    return unitObject;
  }

  /**
   * 3Dユニット選択イベントを SelectionService へ委譲する。
   * @param unitObject 選択された 3D ユニット。
   */
  private selectUnit(unitObject: ThreeDUnitObject): void {
    this.threeDSelectionService?.selectCharacter(unitObject);
    console.log("3Dユニットを選択", unitObject.name);
  }

  /**
   * ThreeDSelectionService 用の依存関係を構築する。
   * @returns SelectionService 依存関係オブジェクト。
   */
  private createThreeDSelectionServiceDeps(): ThreeDSelectionServiceDeps {
    return {
      characterManager: this.threeDCharacterManager,
      playerCharacterStates: this.playerCharacterStates,
      unitGridPositions: this.unitGridPositions,
      hexUtils: this.hexUtils,
      placementService: this.placementService,
      addObjectToScene: (object) => {
        this.third.add.existing(object);
      },
      updateFieldViewVisibility: () => {
        return this.threeDFieldViewService?.updateVisibility();
      },
    };
  }

  /**
   * 2D版 FieldViewService を再利用するための 3D 用アダプタを生成する。
   * @returns 3Dシーン向けに構成した FieldViewService。
   */
  private createThreeDFieldViewService(): FieldViewService {
    const visibilityCharacters = Array.from(this.playerCharacterStates.values()).map((state) => ({
      get position() {
        return state.getPosition();
      },
      getIsBailedOut: () => state.getFriendUnit().isBailout,
    }));

    return new FieldViewService({
      characterManager: {
        playerCharacters: visibilityCharacters,
      },
      fieldViewState: this.threeDFieldViewState,
      hexUtils: this.hexUtils,
      gridConfig: this.gridConfig,
    });
  }

}