import { GridCellsScene } from "../../phaser/scenes/GridCellsScene";
import { ThreeDFieldViewState } from "../entities/ThreeDFieldViewState";
import { ThreeDCharacterPlacementService } from "../services/ThreeDCharacterPlacementService";
import { ThreeDUnitObject } from "../graphics/ThreeDUnitObject";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";
import { ThreeDCharacterManager } from "../characterManager";

export class ThreeDGridCellsScene extends GridCellsScene {

  private threeDFieldViewState!: ThreeDFieldViewState;
  /** 3Dユニット表示オブジェクトの一覧 */
  private threeDCharacterManager: ThreeDCharacterManager = new ThreeDCharacterManager();

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
    const placementService = new ThreeDCharacterPlacementService(this.gridConfig);

    this.friendUnits.forEach((unit) => {
      const unitObject = this.placeUnit(unit, placementService);
      if (unitObject) {
        this.threeDCharacterManager.player3DCharacters.push(unitObject);
      }
    });

    // 相手のキャラクターは既存2D仕様と同様に反転座標で配置する
    this.enemyUnits.forEach((unit) => {
      const invertedPosition = this.hexUtils.invertPosition(unit.position);
      const unitObject = this.placeUnit({ ...unit, position: invertedPosition }, placementService);
      if (unitObject) {
        this.threeDCharacterManager.enemy3DCharacters.push(unitObject);
      }
    });
  }

  async create(): Promise<void> {
    // もとの2Dクラスのcreate（通信初期化など）をそのまま再利用して実行！
    super.create();

    await this.third.warpSpeed();
    this.third.camera.position.set(20, 20, 40);
    this.third.camera.lookAt(0, 0, 0);
  }

  private placeUnit(unit: FriendUnit | EnemyUnit, placementService: ThreeDCharacterPlacementService): ThreeDUnitObject | undefined {
    const { col, row } = unit.position;
    if (col < 0 || row < 0 || col >= this.gridConfig.gridWidth || row >= this.gridConfig.gridHeight) {
      return;
    }

    const position = placementService.fromGridOnGround(this.hexUtils, col, row, 0.1);
    const unitObject = new ThreeDUnitObject(this, unit.unitTypeId, position.x, position.y, position.z);
    unitObject.updateVisibility(!unit.isBailout);

    unitObject.loadModel("/character/3d/Idle.fbx", 0.5);
    this.registerDefaultAnimations(unitObject);

    return unitObject;
  }

  private async registerDefaultAnimations(unitObject: ThreeDUnitObject): Promise<void> {
    const animationNames = ["Jumping", "LookingAround", "Running", "BodyJabCross", "HipHopDancing"];

    await Promise.all(
      animationNames.map((name) => unitObject.addAnimation(name, `/character/3d/${name}.fbx`))
    );
  }

}