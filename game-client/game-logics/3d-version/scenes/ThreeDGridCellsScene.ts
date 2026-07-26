import { GridCellsScene } from "../../phaser/scenes/GridCellsScene";
import * as THREE from "three";
import { ThreeDFieldViewState } from "../entities/ThreeDFieldViewState";
import { ThreeDEnemyCharacterState } from "../entities/ThreeDEnemyCharacterState";
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
import { ThreeDTriggerSettingController } from "./controllers/ThreeDTriggerSettingController";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { GameResult } from "@/types/GameTypes";
import { ThreeDTurnPlanner } from "./services/ThreeDTurnPlanner";
import { ThreeDTurnReplayController } from "./controllers/ThreeDTurnReplayController";

/**
 * 3D盤面シーン。
 * 2Dの GridCellsScene を継承しつつ、3D表示・3D入力・3D移動処理を構成する。
 */
export class ThreeDGridCellsScene extends GridCellsScene {
  /** ユニット地面高さのベース値（仮）。 */
  private static readonly UNIT_BASE_HEIGHT = 1;
  /** fieldStep 1段あたりの高さ係数（仮）。 */
  private static readonly UNIT_HEIGHT_PER_FIELD_STEP = 76;

  private threeDFieldViewState!: ThreeDFieldViewState;
  /** 3Dユニット表示オブジェクトの一覧 */
  private threeDCharacterManager: ThreeDCharacterManager = new ThreeDCharacterManager();
  private threeDInputController: ThreeDInputController | null = null;
  private readonly placementService: ThreeDCharacterPlacementService = new ThreeDCharacterPlacementService(this.gridConfig);
  private readonly unitObjectById = new Map<string, ThreeDUnitObject>();
  private readonly friendUnitsById = new Map<string, FriendUnit>();
  private threeDSelectionService: ThreeDSelectionService | null = null;
  /** 3D版の視界更新サービス（2D FieldViewService 再利用）。 */
  private threeDFieldViewService: FieldViewService | null = null;
  /** 3D版のトリガー方位設定コントローラ。 */
  private threeDTriggerSettingController: ThreeDTriggerSettingController | null = null;
  /** 3D版の行動計画・送信を扱う専用 Planner。 */
  private threeDTurnPlanner: ThreeDTurnPlanner | null = null;
  /** 3D版の受信ターン再生を扱う専用 Controller。 */
  private threeDTurnReplayController: ThreeDTurnReplayController | null = null;

  constructor(
    private readonly motionLabEndTime: Date,
    friendUnits: FriendUnit[],
    enemyUnits: EnemyUnit[],
    fieldSteps: number[][],
    visibility: boolean[][],
    private readonly sendServerTurn3D: (steps: Step[]) => void,
    private readonly completeGameHandler: (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[], result: GameResult) => void,
    private readonly handleFinishMotionExecuteHandler: (turnNumber: number) => void,
  ) {
    super(
      motionLabEndTime,
      friendUnits,
      enemyUnits,
      fieldSteps,
      visibility,
      sendServerTurn3D,
      completeGameHandler,
      handleFinishMotionExecuteHandler,
    );
  }

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
      this.friendUnitsById.set(unit.unitId, unit);
      const unitObject = this.placeUnit(unit, this.placementService);
      if (unitObject) {
        // 味方キャラクターの向きを反転させる
        unitObject.rotation.y = Math.PI;
        this.threeDCharacterManager.player3DCharacters.push(unitObject);
        this.unitObjectById.set(unit.unitId, unitObject);
        this.threeDCharacterManager.playerCharacterStates.set(unitObject, new ThreeDPlayerCharacterState(unitObject, unit));
        this.threeDCharacterManager.unitGridPositions.set(unitObject, { ...unit.position });
      }
    });

    // 相手のキャラクターは既存2D仕様と同様に反転座標で配置する
    this.enemyUnits.forEach((unit) => {
      const invertedPosition = this.hexUtils.invertPosition(unit.position);
      const unitObject = this.placeUnit({ ...unit, position: invertedPosition }, this.placementService);
      if (unitObject) {
        this.threeDCharacterManager.enemy3DCharacters.push(unitObject);
        this.unitObjectById.set(unit.unitId, unitObject);
        this.threeDCharacterManager.unitGridPositions.set(unitObject, { ...invertedPosition });
        this.threeDCharacterManager.enemyCharacterStatesById.set(
          unit.unitId,
          new ThreeDEnemyCharacterState(
            unitObject,
            unit,
            this.hexUtils,
          ),
        );
      }
    });
  }

  async create(): Promise<void> {
    // 2D版の create は FieldViewState / SelectionService / TriggerSettingController まで初期化するため、
    // 3D版では必要な前処理だけを明示的に行い、3D専用のコントローラ群だけを起動する。
    this.initializeMarginsFor3D();
    this.initializeGameConfig();
    this.initializeFieldViewState();
    this.createCharacters();

    this.detachBasePointerHandlers();
    await this.third.warpSpeed("-sky", "-ground"); // 3D空間の初期化
    this.third.camera.position.set(20, 500, 1500);
    this.third.camera.lookAt(0, 0, 0);
    await this.threeDFieldViewState.loadFieldModel();

    // ファークリッピングプレーンを広げて盤面全体が描画されるようにする
    const cam = this.third.camera as THREE.PerspectiveCamera;
    cam.far = 2000;
    cam.updateProjectionMatrix();

    if (!this.threeDFieldViewService) {
      this.threeDFieldViewService = this.createThreeDFieldViewService();
    }

    if (!this.threeDTurnPlanner) {
      this.threeDTurnPlanner = new ThreeDTurnPlanner({
        scene: this,
        characterManager: this.threeDCharacterManager,
        playerCharacterStates: this.threeDCharacterManager.playerCharacterStates,
        hexUtils: this.hexUtils,
        clearSelection: () => {
          this.threeDSelectionService?.clearSelection();
        },
        sendServerTurn: (steps: Step[]) => {
          this.sendServerTurn3D(steps);
        },
      });

      // 2D版と同様に初回ターンの締切タイマーを有効化する。
      this.threeDTurnPlanner.setMotionLabEnd(this.motionLabEndTime);
    }

    if (!this.threeDTurnReplayController) {
      this.threeDTurnReplayController = new ThreeDTurnReplayController({
        scene3d: this,
        hexUtils: this.hexUtils,
        gridConfig: this.gridConfig,
        placementService: this.placementService,
        resolveUnitHeightAtGrid: (col, row) => this.resolveUnitHeightAtGrid(col, row),
        unitObjectById: this.unitObjectById,
        enemyCharacterStatesById: this.threeDCharacterManager.enemyCharacterStatesById,
        playerCharacterStates: this.threeDCharacterManager.playerCharacterStates,
        friendUnitsById: this.friendUnitsById,
        clearSelection: () => {
          this.threeDSelectionService?.clearSelection();
        },
        onReplayCompleted: (turnNumber) => {
          this.handleFinishMotionExecuteHandler(turnNumber);
        },
        clearPlannedSteps: () => {
          this.threeDTurnPlanner?.clearPlannedSteps();
        },
        restoreActionPointsRemainSecondsText: () => {
          this.threeDSelectionService?.showMovableHexes();
        },
        updateFieldViewVisibility: () => {
          return this.threeDFieldViewService?.updateVisibility();
        },
        completeGame: (result) => {
          const { friendUnits, enemyUnits } = this;
          this.completeGameHandler(friendUnits, enemyUnits, result);
        },
      });
    }

    if (!this.threeDTriggerSettingController) {
      this.threeDTriggerSettingController = new ThreeDTriggerSettingController({
        scene3d: this,
        characterManager: this.threeDCharacterManager,
        playerCharacterStates: this.threeDCharacterManager.playerCharacterStates,
        placementService: this.placementService,
        hexUtils: this.hexUtils,
        gridConfig: this.gridConfig,
        onTriggerPairConfirmed: (unitObject, direction) => {
          this.handleTriggerPairConfirmed(unitObject, direction);
        },
      });
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
          onCancelMoveSelection: () => {
            this.threeDSelectionService?.cancelMoveSelection();
          },
          isTriggerSettingMode: () => {
            return this.threeDTriggerSettingController?.isTriggerSettingMode() ?? false;
          },
          getTriggerDirectionOrigin: () => {
            return this.threeDTriggerSettingController?.getTriggerCenterPosition() ?? null;
          },
          onUpdateTriggerDirection: (directionDeg) => {
            this.threeDTriggerSettingController?.updateCurrentTriggerAngle(directionDeg);
          },
          onCompleteTriggerSetting: () => {
            this.threeDTriggerSettingController?.completeCurrentTriggerSetting();
          },
          setCameraControlEnabled: (enabled) => {
            this.setThirdCameraInteractionEnabled(enabled);
          },
        }
      );
    }

    this.threeDInputController.bind();
    this.events.once("shutdown", () => {
      this.threeDInputController?.unbind();
      this.threeDSelectionService?.dispose();
      this.threeDTriggerSettingController?.stopTriggerSetting();
      this.threeDFieldViewState.dispose();
    });
  }

  /**
   * 2D版 GridCellsScene が登録した pointer ハンドラを 3D シーンでは無効化する。
   * 3D版では ThreeDInputController のみを入力ソースとして扱う。
   */
  private detachBasePointerHandlers(): void {
    this.input.off("pointerdown");
    this.input.off("pointermove");
    this.input.off("pointerup");
  }

  /**
   * 3D版でも 2D版と同じ余白計算だけは必要なので、base の private 実装をここで再現する。
   */
  private initializeMarginsFor3D(): void {
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    this.gridConfig = {
      ...this.gridConfig,
      marginLeft: gameWidth * 0.5,
      marginTop: gameHeight * 0.5,
    };
  }

  /**
   * enable3d/Three.js 側のカメラ操作を可能な範囲で有効/無効化する。
   * 実装差異に対応するため複数の候補プロパティを順に探索する。
   */
  private setThirdCameraInteractionEnabled(enabled: boolean): void {
    const thirdLike = this.third as {
      controls?: unknown;
      orbitControls?: unknown;
      cameraControls?: unknown;
    };

    const candidates: unknown[] = [
      thirdLike.controls,
      thirdLike.orbitControls,
      thirdLike.cameraControls,
    ];

    candidates.forEach((candidate) => {
      if (!candidate || typeof candidate !== "object") return;

      const control = candidate as {
        enabled?: boolean;
        enableRotate?: boolean;
        enablePan?: boolean;
        enableZoom?: boolean;
      };

      if (typeof control.enabled === "boolean") {
        control.enabled = enabled;
      }
      if (typeof control.enableRotate === "boolean") {
        control.enableRotate = enabled;
      }
      if (typeof control.enablePan === "boolean") {
        control.enablePan = enabled;
      }
      if (typeof control.enableZoom === "boolean") {
        control.enableZoom = enabled;
      }
    });
  }

  /**
   * 3Dトリガー（main/sub）確定後の後処理を実行する。
   *
   * 2D版と同じ責務として、
   * - 行動履歴の記録
   * - 残り秒数に応じた入力遷移
   * - 全ユニット完了時の turnExecution 送信
   * をまとめて行う。
   */
  private handleTriggerPairConfirmed(
    unitObject: ThreeDUnitObject,
    direction: { main: number; sub: number; },
  ): void {
    const remainingSeconds = this.threeDTurnPlanner?.recordActionHistory(unitObject, direction) ?? 0;
    // 残り秒数で次の入力遷移を分岐する。
    if (remainingSeconds > 0) {
      this.threeDSelectionService?.showMovableHexes();
    } else {
      this.threeDSelectionService?.cancelMoveSelection();
    }

    this.threeDTurnPlanner?.checkAllCharactersActionPointsCompleted();
  }

  /**
   * 2D版と同様、手動送信でも現在の計画ステップを送信する。
   */
  public override sendServerTurnManual(): void {
    this.threeDTurnPlanner?.sendMotionLabTurn();
  }

  /**
   * サーバー応答で次ターン再生へ入る前に、3D側の計画状態をリセットする。
   */
  public override executeTurn(turn: Turn, motionLabEndTime: Date): void {
    this.threeDTurnPlanner?.resetPlannedTurnState();

    if (this.threeDTurnReplayController && this.threeDTurnPlanner) {
      this.threeDTurnReplayController.executeTurn(turn);
      this.threeDTurnPlanner.setMotionLabEnd(motionLabEndTime);
      return;
    }

    super.executeTurn(turn, motionLabEndTime);
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

    const position = placementService.fromGridOn3D(
      this.hexUtils,
      col,
      row,
      this.resolveUnitHeightAtGrid(col, row),
    );
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
      playerCharacterStates: this.threeDCharacterManager.playerCharacterStates,
      unitGridPositions: this.threeDCharacterManager.unitGridPositions,
      hexUtils: this.hexUtils,
      placementService: this.placementService,
      resolveUnitHeightAtGrid: (col, row) => this.resolveUnitHeightAtGrid(col, row),
      addObjectToScene: (object) => {
        this.third.add.existing(object);
      },
      updateFieldViewVisibility: () => {
        return this.threeDFieldViewService?.updateVisibility();
      },
      startTriggerSettingForSelectedUnit: () => {
        this.threeDTriggerSettingController?.startTriggerSettingForSelectedUnit();
      },
      clearTriggerSettingDisplay: () => {
        this.threeDTriggerSettingController?.stopTriggerSetting();
      },
    };
  }

  /**
   * 2D版 FieldViewService を再利用するための 3D 用アダプタを生成する。
   * @returns 3Dシーン向けに構成した FieldViewService。
   */
  private createThreeDFieldViewService(): FieldViewService {
    const visibilityCharacters = Array.from(this.threeDCharacterManager.playerCharacterStates.values()).map((state) => ({
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

  /**
   * fieldSteps から指定マスのユニット配置高さを計算する。
   *
   * 高さ係数は仮値のため、見た目に合わせて調整する前提。
   */
  private resolveUnitHeightAtGrid(col: number, row: number): number {
    const fieldStep = this.fieldSteps[row]?.[col] ?? 0;
    return (
      ThreeDGridCellsScene.UNIT_BASE_HEIGHT +
      fieldStep * ThreeDGridCellsScene.UNIT_HEIGHT_PER_FIELD_STEP
    );
  }

}