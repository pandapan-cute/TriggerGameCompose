'use client';
import { FieldViewState } from "../../entities/FieldViewState";
import { GameView } from "../../GameView";
import { HexUtils } from "../../hexUtils";
import { BackCanvasTexture } from "../textures/BackCanvasTexture";
import "phaser";
import { UnitImageLoader } from "./loader/UnitImageLoader";
import { GameAssetsLoader } from "./loader/GameAssetsLoader";
import { GameCamera } from "../cameras/GameCamera";
import { CharacterManager } from "@/game-logics/characterManager";
import { PlayerCharacterState } from "@/game-logics/entities/PlayerCharacterState";
import { EnemyCharacterState } from "@/game-logics/entities/EnemyCharacterState";
import { HighLightCell } from "../game-objects/graphics/HighLightCell";
import { FriendUnit } from "@/types/FriendUnit";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { TriggerFanShape } from "../game-objects/graphics/TriggerFanShape";
import { InputController, type InputControllerDeps } from "./inputs/InputController";
import { SelectionService, type SelectionServiceDeps } from "./services/SelectionService";
import {
  TriggerSettingController,
  type TriggerSettingControllerDeps,
} from "./controllers/TriggerSettingController";
import { TurnPlanner, type TurnPlannerDeps } from "./services/TurnPlanner";
import {
  TurnReplayController,
  type TurnReplayControllerDeps,
} from "./controllers/TurnReplayController";
import { FieldViewService } from "./services/FieldViewService";
import { EnemyUnit } from "@/types/EnemyUnit";
import { GameResult } from "@/types/GameTypes";
import { GRID_CONFIG, MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";

/**
 * グリッドセルを管理するPhaserのシーン
 */
export class GridCellsScene extends Phaser.Scene {

  // Phaserオブジェクト
  private hoveredCell: { x: number; y: number; } | null = null; // マウスでホバーしているセル
  private cellHighlight!: HighLightCell; // セルのハイライト表示用

  /** キャラクター管理 */
  private characterManager: CharacterManager = new CharacterManager();

  /** フィールドビューの状態管理 */
  private fieldViewState!: FieldViewState;

  // トリガー設定フェーズ
  private triggerSettingMode: boolean = false; // トリガー設定モード
  private triggerSettingType: "main" | "sub" | null = null; // 設定中のトリガータイプ
  private triggerFan: TriggerFanShape | null = null; // トリガー扇形の表示
  private triggerPoints: Phaser.GameObjects.Graphics[] | null = null;
  private isDraggingTrigger: boolean = false; // トリガー扇形をドラッグ中かどうか
  private currentTriggerAngle: number = 0; // 現在のトリガー角度

  constructor(private firstMotionLabEndtime: Date, private friendUnits: FriendUnit[], private enemyUnits: EnemyUnit[], private fieldSteps: number[][], private visibility: boolean[][], private sendServerTurn: (steps: Step[]) => void, private completeGame: (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[], result: GameResult) => void, private handleFinishMotionExecute: (turnNumber: number) => void) {
    super({ key: "GridScene" });
    console.log("GridCellsSceneコンストラクタ: friendUnits =", friendUnits, "enemyUnits =", enemyUnits);
  }

  /** ターンのステップ情報を格納 */
  private turn = new Turn();

  // ユニット行動モード関連
  private isActionMode: boolean = false;
  private actionAnimationInProgress: boolean = false;
  /** ユニット行動モード中のトリガー矢印の配列 */
  private triggerArrows: Phaser.GameObjects.Graphics[] = [];
  /** 初期化前に受け取ったターン */
  private pendingTurn: Turn | null = null;

  /** グリッドの設定値 */
  private gridConfig = GRID_CONFIG;
  /** グリッドフィールドの関数群 */
  private hexUtils!: HexUtils;
  /** ゲーム表示関連のクラス */
  private gameView!: GameView;
  /** 入力処理コントローラ */
  private inputController: InputController | null = null;
  /** 選択・移動処理サービス */
  private selectionService: SelectionService | null = null;
  /** トリガー設定処理コントローラ */
  private triggerSettingController: TriggerSettingController | null = null;
  /** ターン計画サービス */
  private turnPlanner: TurnPlanner | null = null;
  /** ターン再生コントローラ */
  private turnReplayController: TurnReplayController | null = null;
  /** 視界情報管理サービス */
  private fieldViewService: FieldViewService | null = null;

  /**
  * Phaserのpreload段階で呼ばれる
  * アセット（画像、音声など）の読み込みを行う
  */
  preload() {
    new BackCanvasTexture(this, this.gridConfig); // 背景テクスチャの作成
    new UnitImageLoader(this);
    new GameAssetsLoader(this);
  }

  /**
   * 余白を初期化する（画面サイズの半分程度）
   */
  private initializeMargins() {
    // ゲームのキャンバスサイズを取得
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // 画面の横幅/縦幅の半分程度の余白を設定
    this.gridConfig = {
      ...this.gridConfig,
      marginLeft: gameWidth * 0.5,
      marginTop: gameHeight * 0.5,
    };
  }

  /**
   * 六角形グリッドのユーティリティを初期化する
   */
  initializeGameConfig() {
    this.hexUtils = new HexUtils(this.gridConfig);
    this.gameView = new GameView(this, this.gridConfig);
    this.fieldViewState = new FieldViewState(
      this.hexUtils,
      this,
      this.gridConfig,
      this.fieldSteps,
      this.visibility
    );
  }

  /**
   * Phaserのcreate段階で呼ばれる
   * ゲームオブジェクトの初期化を行う
   */
  create() {
    this.initializeMargins(); // 余白を初期化
    new GameCamera(this, this.gridConfig); // カメラの設定を最初に行う
    this.initializeGameConfig(); // 六角形グリッドの設定値初期化
    this.cellHighlight = new HighLightCell(this); // グリッドラインを描画
    this.setupSceneControllers(); // SelectionService / TriggerSettingController を初期化
    this.createCharacters(); // キャラクターを配置
    this.setupInputController(); // InputController を初期化してイベントをバインドする
  }

  /**
   * シーンの委譲先コントローラ群を初期化する
   */
  private setupSceneControllers(): void {

    if (!this.fieldViewService) {
      this.initializeFieldViewService();
    }

    if (!this.selectionService) {
      this.selectionService = new SelectionService(this.createSelectionServiceDeps());
    }

    if (!this.triggerSettingController) {
      this.triggerSettingController = new TriggerSettingController(
        this,
        this.createTriggerSettingControllerDeps()
      );
    }

    if (!this.turnPlanner) {
      this.turnPlanner = new TurnPlanner(this.createTurnPlannerDeps());
      // ターンプランナーに最初の動きの設定終了時間をセット
      // 次ターンからはサーバーから送られてくるターン情報の中の時間をセットしていく
      this.turnPlanner.setMotionLabEnd(this.firstMotionLabEndtime);
    }

    if (!this.turnReplayController) {
      this.turnReplayController = new TurnReplayController(
        this.createTurnReplayControllerDeps()
      );
    }
  }

  /**
   * マウスイベントを設定する（六角形グリッド対応）
   */
  private setupInputController() {
    if (!this.inputController) {
      this.inputController = new InputController(
        this,
        this.cameras,
        this.createInputControllerDeps(),
        this.gridConfig,
        this.hexUtils
      );
    }

    // InputController 側へ入力イベント処理を委譲する
    this.inputController.bind();
  }

  /**
   * InputController へ渡す依存関数を構築する
   */
  private createInputControllerDeps(): InputControllerDeps {
    return {
      isInteractionLocked: () => this.isActionMode || this.actionAnimationInProgress,
      hasTriggerFan: () => !!this.triggerFan,
      isTriggerSettingMode: () => this.triggerSettingMode,
      isTriggerDragging: () => this.isDraggingTrigger,
      setTriggerDragging: (isDragging: boolean) => {
        this.isDraggingTrigger = isDragging;
      },
      updateTriggerAngleFromPointer: (pointer: Phaser.Input.Pointer) => {
        this.triggerSettingController?.updateTriggerAngleFromPointer(pointer);
      },
      updateHoverFromPointer: (pointer: Phaser.Input.Pointer) => {
        this.updateHoverFromPointer(pointer);
      },
      commitGridClick: (pointer: Phaser.Input.Pointer) => {
        this.commitGridClick(pointer);
      },
      completeTriggerSetting: () => {
        this.triggerSettingController?.completeTriggerSetting(
          this.currentTriggerAngle
        );
      },
      setupNativePinchGesture: (camera: Phaser.Cameras.Scene2D.Camera) => {
        this.gameView.setupNativePinchGesture(camera);
      },
    };
  }

  /**
   * SelectionService へ渡す依存関数を構築する
   */
  private createSelectionServiceDeps(): SelectionServiceDeps {
    return {
      scene: this,
      characterManager: this.characterManager,
      fieldViewState: this.fieldViewState,
      hexUtils: this.hexUtils,
      gridConfig: this.gridConfig,
      consumeActionPoint: (remainingMoves: number, remainingSeconds: number) => {
        this.turnPlanner?.consumeActionPointRemainSeconds(remainingMoves, remainingSeconds);
      },
      startTriggerSetting: () => {
        this.triggerSettingController?.startTriggerSetting();
      },
      resetTriggerSettingState: () => {
        this.triggerSettingMode = false;
        this.triggerSettingType = null;
      },
      updateFieldViewVisibility: () => {
        return this.fieldViewService?.updateVisibility();
      }
    };
  }

  /**
   * TriggerSettingController へ渡す依存関数を構築する
   */
  private createTriggerSettingControllerDeps(): TriggerSettingControllerDeps {
    return {
      characterManager: this.characterManager,
      fieldViewState: this.fieldViewState,
      fieldViewService: this.fieldViewService!,
      hexUtils: this.hexUtils,
      gridConfig: this.gridConfig,
      isTriggerDragging: () => this.isDraggingTrigger,
      getTriggerSettingType: () => this.triggerSettingType,
      setTriggerSettingType: (triggerType: "main" | "sub" | null) => {
        this.triggerSettingType = triggerType;
      },
      setTriggerSettingMode: (isEnabled: boolean) => {
        this.triggerSettingMode = isEnabled;
      },
      getCurrentTriggerAngle: () => this.currentTriggerAngle,
      setCurrentTriggerAngle: (angle: number) => {
        this.currentTriggerAngle = angle;
      },
      getTriggerFan: () => this.triggerFan,
      setTriggerFan: (fan: TriggerFanShape | null) => {
        this.triggerFan = fan;
      },
      getTriggerPoints: () => this.triggerPoints,
      setTriggerPoints: (points: Phaser.GameObjects.Graphics[] | null) => {
        this.triggerPoints = points;
      },
      recordActionHistory: () => {
        this.turnPlanner?.recordActionHistory();
      },
      showMovableHexes: () => {
        this.selectionService?.showMovableHexes();
      },
      clearSelection: () => {
        this.selectionService?.clearSelection();
      },
      showActionCompletedText: (character: Phaser.GameObjects.Image) => {
        this.turnPlanner?.showActionCompletedText(character);
      },
      checkAllCharactersActionPointsCompleted: () => {
        this.turnPlanner?.checkAllCharactersActionPointsCompleted();
      },
    };
  }

  /**
   * TurnPlanner へ渡す依存関数を構築する
   */
  private createTurnPlannerDeps(): TurnPlannerDeps {
    return {
      scene: this,
      characterManager: this.characterManager,
      turn: this.turn,
      hexUtils: this.hexUtils,
      sendServerTurn: (steps: Step[]) => {
        this.sendServerTurn(steps);
      },
    };
  }

  /**
   * TurnReplayController へ渡す依存関数を構築する
   */
  private createTurnReplayControllerDeps(): TurnReplayControllerDeps {
    return {
      scene: this,
      hexUtils: this.hexUtils,
      characterManager: this.characterManager,
      onReplayCompleted: (turnNumber: number) => {
        this.handleFinishMotionExecute(turnNumber);
      },
      clearTriggerArrows: () => {
        this.triggerArrows.forEach((arrow) => arrow.destroy());
        this.triggerArrows = [];
      },
      setActionMode: (isActionMode: boolean) => {
        this.isActionMode = isActionMode;
      },
      setActionAnimationInProgress: (isInProgress: boolean) => {
        this.actionAnimationInProgress = isInProgress;
      },
      clearPlannedSteps: () => {
        this.turnPlanner?.clearPlannedSteps();
      },
      restoreActionPointsRemainSecondsText: () => {
        this.characterManager.setAllActionPointsRemainSecondsText(this);
      },
      updateFieldViewVisibility: () => {
        return this.fieldViewService?.updateVisibility();
      },
      /** ゲームの終了処理を実行する */
      completeGame: (result: GameResult) => {
        const { friendUnits, enemyUnits } = this.characterManager.getUnitsList();
        this.completeGame(friendUnits, enemyUnits, result);
      }
    };
  }

  /**
   * 視界情報管理サービスを初期化する
   */
  private initializeFieldViewService(): void {
    this.fieldViewService = new FieldViewService({
      characterManager: this.characterManager,
      fieldViewState: this.fieldViewState,
      hexUtils: this.hexUtils,
      gridConfig: this.gridConfig,
    });
  }

  /**
   * pointer 座標に応じてホバー表示を更新する
   */
  private updateHoverFromPointer(pointer: Phaser.Input.Pointer): void {
    const hexCoord = this.hexUtils.pixelToHex(
      pointer.x,
      pointer.y,
      this.cameras.main
    );

    if (
      hexCoord.col >= 0 &&
      hexCoord.col < this.gridConfig.gridWidth &&
      hexCoord.row >= 0 &&
      hexCoord.row < this.gridConfig.gridHeight
    ) {
      this.hoveredCell = { x: hexCoord.col, y: hexCoord.row };
      this.updateCellHighlight();
    } else {
      this.hoveredCell = null;
      this.cellHighlight.setVisible(false);
    }
  }

  /**
   * グリッドクリック時の既存処理を実行する
   */
  private commitGridClick(pointer: Phaser.Input.Pointer): void {
    const hexCoord = this.hexUtils.pixelToHex(
      pointer.x,
      pointer.y,
      this.cameras.main
    );

    if (
      hexCoord.col < 0 ||
      hexCoord.col >= this.gridConfig.gridWidth ||
      hexCoord.row < 0 ||
      hexCoord.row >= this.gridConfig.gridHeight
    ) {
      return;
    }

    this.selectionService?.handleGridClick(hexCoord.col, hexCoord.row);
  }

  private updateCellHighlight() {
    if (!this.hoveredCell) return;

    // 前のハイライトをクリア
    this.cellHighlight.clear();

    // 六角形の位置を計算
    const pos = this.hexUtils.getHexPosition(
      this.hoveredCell.x,
      this.hoveredCell.y
    );

    // 薄い青色で六角形をハイライト
    this.cellHighlight.fillStyle(0x87ceeb, 0.5); // 色と透明度

    const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
    this.cellHighlight.beginPath();
    this.cellHighlight.moveTo(vertices[0], vertices[1]);
    for (let i = 2; i < vertices.length; i += 2) {
      this.cellHighlight.lineTo(vertices[i], vertices[i + 1]);
    }
    this.cellHighlight.closePath();
    this.cellHighlight.fillPath();

    // ハイライトを表示
    this.cellHighlight.setVisible(true);
  }

  /**
   * キャラクターを六角形グリッドに配置する
   */
  private createCharacters() {
    // 自分のキャラクターを配置
    this.friendUnits.forEach((unit) => {
      const playerCharacterState = new PlayerCharacterState(
        MAX_UNIT_EXEC_SECONDS, // 初期の行動可能秒数を設定
        this,
        unit,
        this.hexUtils,
        this.gridConfig,
        this.fieldViewService!
      );
      this.characterManager.playerCharacters.push(playerCharacterState);
    });

    // 相手のキャラクターを配置（逆転した座標を使用）
    this.enemyUnits.forEach((unit) => {
      const enemyCharacterState = new EnemyCharacterState(
        this,
        unit,
        this.hexUtils,
        this.gridConfig,
        this.fieldViewService!
      );
      this.characterManager.enemyCharacters.push(enemyCharacterState);
    });
  }

  /**
   * 指定されたステップの行動を実行
   */
  executeTurn(turn: Turn, motionLabEndTime: Date): void {
    if (this.turnReplayController && this.turnPlanner) {
      // 行動可能なセルのハイライトを消す
      this.selectionService?.clearSelection();
      this.triggerSettingController?.clearTriggerDisplay();
      this.turnReplayController.executeTurn(turn);
      this.turnPlanner.setMotionLabEnd(motionLabEndTime);
      return;
    }

    this.pendingTurn = turn;
  }
};
