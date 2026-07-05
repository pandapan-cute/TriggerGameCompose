import { GridCellsScene } from "../../phaser/scenes/GridCellsScene";
import { ThreeDFieldViewState } from "../entities/ThreeDFieldViewState";
import { ThreeDCharacterPlacementService } from "../services/ThreeDCharacterPlacementService";
import { ThreeDUnitObject } from "../graphics/ThreeDUnitObject";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";
import { ThreeDCharacterManager } from "../characterManager";
import { ThreeDInputController } from "./inputs/ThreeDInputController";
import {
  ThreeDSelectionService,
  type ThreeDSelectionServiceDeps,
} from "./services/ThreeDSelectionService";

export class ThreeDGridCellsScene extends GridCellsScene {

  private threeDFieldViewState!: ThreeDFieldViewState;
  /** 3Dユニット表示オブジェクトの一覧 */
  private threeDCharacterManager: ThreeDCharacterManager = new ThreeDCharacterManager();
  private threeDInputController: ThreeDInputController | null = null;
  private readonly placementService: ThreeDCharacterPlacementService = new ThreeDCharacterPlacementService(this.gridConfig);
  private readonly unitGridPositions = new Map<ThreeDUnitObject, { col: number; row: number; }>();
  private readonly playerUnits = new Map<ThreeDUnitObject, FriendUnit>();
  private threeDSelectionService: ThreeDSelectionService | null = null;

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
        this.playerUnits.set(unitObject, unit);
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
        }
      );
    }

    this.threeDInputController.bind();
    this.events.once("shutdown", () => {
      this.threeDInputController?.unbind();
      this.threeDSelectionService?.dispose();
    });
  }

  private placeUnit(unit: FriendUnit | EnemyUnit, placementService: ThreeDCharacterPlacementService): ThreeDUnitObject | undefined {
    const { col, row } = unit.position;
    if (col < 0 || row < 0 || col >= this.gridConfig.gridWidth || row >= this.gridConfig.gridHeight) {
      return;
    }

    const position = placementService.fromGridOnGround(this.hexUtils, col, row, 0.1);
    const unitObject = new ThreeDUnitObject(this, unit.unitTypeId, position.x, position.y, position.z);
    unitObject.setSelectUnitHandler(() => this.selectUnit(unitObject));
    unitObject.updateVisibility(!unit.isBailout);

    unitObject.loadModel("/character/3d/Idle.fbx", 0.5);
    this.registerDefaultAnimations(unitObject);

    return unitObject;
  }

  private selectUnit(unitObject: ThreeDUnitObject): void {
    this.threeDSelectionService?.selectCharacter(unitObject);
    console.log("3Dユニットを選択", unitObject.name);
  }

  private createThreeDSelectionServiceDeps(): ThreeDSelectionServiceDeps {
    return {
      characterManager: this.threeDCharacterManager,
      playerUnits: this.playerUnits,
      unitGridPositions: this.unitGridPositions,
      hexUtils: this.hexUtils,
      placementService: this.placementService,
      addObjectToScene: (object) => {
        this.third.add.existing(object);
      },
    };
  }

  private async registerDefaultAnimations(unitObject: ThreeDUnitObject): Promise<void> {
    const animationNames = ["Jumping", "LookingAround", "Running", "BodyJabCross", "HipHopDancing"];

    await Promise.all(
      animationNames.map((name) => unitObject.addAnimation(name, `/character/3d/${name}.fbx`))
    );
  }

}