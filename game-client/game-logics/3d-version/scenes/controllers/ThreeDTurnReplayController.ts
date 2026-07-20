import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDEnemyCharacterState } from "@/game-logics/3d-version/entities/ThreeDEnemyCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { FriendUnit } from "@/types/FriendUnit";
import { HexUtils } from "@/game-logics/hexUtils";
import { GameResult } from "@/types/GameTypes";
import { Combat } from "@/game-logics/models/Combat";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { MAX_TURN } from "@/game-logics/config/game-config";
import { MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";
import { CHARACTER_STATUS } from "@/game-logics/config/status";
import { TRIGGER_STATUS } from "@/game-logics/config/status";
import { GridConfig } from "@/game-logics/types";
import { ThreeDTriggerFanObject } from "@/game-logics/3d-version/graphics/ThreeDTriggerFanObject";
import { Scene3D } from "@enable3d/phaser-extension";

/**
 * ThreeDTurnReplayController が参照する依存関係。
 *
 * 補足:
 * 3D版のターン再生を Scene から分離し、2D版 TurnReplayController と同じ役割分担に寄せる。
 */
export interface ThreeDTurnReplayControllerDeps {
  scene3d: Scene3D;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
  placementService: ThreeDCharacterPlacementService;
  /** 指定グリッド座標でのユニット配置高さを返す。 */
  resolveUnitHeightAtGrid: (col: number, row: number) => number;
  unitObjectById: Map<string, ThreeDUnitObject>;
  enemyCharacterStatesById: Map<string, ThreeDEnemyCharacterState>;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  friendUnitsById: Map<string, FriendUnit>;
  clearSelection: () => void;
  onReplayCompleted: (turnNumber: number) => void;
  setActionMode?: (isActionMode: boolean) => void;
  setActionAnimationInProgress?: (isInProgress: boolean) => void;
  clearPlannedSteps?: () => void;
  restoreActionPointsRemainSecondsText?: () => void;
  updateFieldViewVisibility: () => boolean[][] | undefined;
  completeGame?: (result: GameResult) => void;
}

/**
 * 受信した Turn の 3D 再生を扱う。
 *
 * 2D版と同じく、ステップ単位でアクションとコンバットを順に再生し、
 * 完了後にゲーム終了判定または行動フェーズ復帰を行う。
 */
export class ThreeDTurnReplayController {
  /** リプレイ中に表示するメイントリガー扇形。 */
  private readonly mainReplayTriggerFans = new Map<string, ThreeDTriggerFanObject>();
  /** リプレイ中に表示するサブトリガー扇形。 */
  private readonly subReplayTriggerFans = new Map<string, ThreeDTriggerFanObject>();

  constructor(private readonly deps: ThreeDTurnReplayControllerDeps) { }

  /**
   * 受信したターンを先頭ステップから順次再生する。
   *
   * @param turn サーバーから受信したターン情報。
   */
  public executeTurn(turn: Turn): void {
    this.clearAllReplayTriggerFans();
    this.deps.clearSelection();
    this.deps.setActionMode?.(true);
    this.deps.setActionAnimationInProgress?.(true);

    this.deps.scene3d.time.delayedCall(2000, () => {
      this.executeStep(turn, 0);
    });
  }

  /**
   * 指定インデックスのステップを再生し、次ステップへ連鎖させる。
   *
   * @param turn 再生対象のターン。
   * @param stepIndex 再生するステップのインデックス。
   */
  private executeStep(turn: Turn, stepIndex: number): void {
    const steps = turn.getSteps();
    const step = steps[stepIndex];
    if (!step) return;

    this.replayActions(step);
    this.deps.scene3d.time.delayedCall(500, () => {
      this.replayCombats(step);
    });

    // 3D版でもステップ再生後に視界情報を更新する。
    this.deps.updateFieldViewVisibility();

    const nextStepIndex = stepIndex + 1;
    this.deps.scene3d.time.delayedCall(1000, () => {
      if (nextStepIndex < steps.length) {
        this.executeStep(turn, nextStepIndex);
        return;
      }

      const gameResult = this.checkGameIsCompleted(turn.getTurnNumber());
      if (gameResult !== "InProgress") {
        this.clearAllReplayTriggerFans();
        this.deps.completeGame?.(gameResult);
        return;
      }

      this.completeUnitActionPhase(turn.getTurnNumber());
    });
  }

  /**
   * 1ステップ内のアクション群を 3D ユニットに反映する。
   *
   * @param step 再生対象のステップ。
   */
  private replayActions(step: Step): void {
    for (const action of step.getActions()) {
      const unitObject = this.deps.unitObjectById.get(action.getUnitId());
      if (!unitObject) continue;

      const playerState = this.deps.playerCharacterStates.get(unitObject);
      const currentGridPosition = this.getCurrentGridPosition(action.getUnitId());
      const targetGridPosition = this.resolveGridPosition(action.getUnitId(), action.getPosition());
      const worldPosition = this.deps.placementService.fromGridOnGround(
        this.deps.hexUtils,
        targetGridPosition.col,
        targetGridPosition.row,
        this.deps.resolveUnitHeightAtGrid(targetGridPosition.col, targetGridPosition.row),
      );

      const isMoving =
        currentGridPosition.col !== targetGridPosition.col ||
        currentGridPosition.row !== targetGridPosition.row;

      if (isMoving) {
        // 3D版では移動アニメーションを先行し、完了時に状態を確定する。
        unitObject.faceToward(worldPosition);
        unitObject.playAnimation("Running", 120);
        // 移動開始時点の位置でトリガー扇形を表示し、移動中は中心座標を追従させる。
        this.updateReplayTriggerFansForAction(
          action,
          { x: unitObject.position.x, y: unitObject.position.y, z: unitObject.position.z },
          unitObject.position.y + 0.02,
        );

        unitObject.moveTo(
          worldPosition,
          750,
          () => {
            const enemyCharacterState = this.deps.enemyCharacterStatesById.get(action.getUnitId());
            if (enemyCharacterState) {
              enemyCharacterState.syncReplayState({
                unitTypeId: action.getUnitTypeId(),
                displayGridPosition: targetGridPosition,
                worldPosition,
                currentActionPoints: action.getCurrentActionPoints(),
              });
            } else {
              unitObject.syncVisualState({
                unitTypeId: action.getUnitTypeId(),
                visible: true,
                position: worldPosition,
              });
            }

            if (playerState) {
              playerState.setPosition(targetGridPosition);
              playerState.setActionPoints(action.getCurrentActionPoints());
            }

            this.updateReplayTriggerFansForAction(action, worldPosition, unitObject.position.y + 0.02);
          },
          (currentPosition) => {
            this.updateReplayTriggerFansForAction(action, currentPosition, currentPosition.y + 0.02);
          },
        );
      } else {
        // 移動しないアクションは Idle のまま、座標と表示だけを更新する。
        unitObject.playAnimation("Idle", 120);
        if (playerState) {
          playerState.setPosition(targetGridPosition);
          playerState.setActionPoints(action.getCurrentActionPoints());
        }

        const enemyCharacterState = this.deps.enemyCharacterStatesById.get(action.getUnitId());
        if (enemyCharacterState) {
          enemyCharacterState.syncReplayState({
            unitTypeId: action.getUnitTypeId(),
            displayGridPosition: targetGridPosition,
            worldPosition,
            currentActionPoints: action.getCurrentActionPoints(),
          });
        } else {
          unitObject.syncVisualState({
            unitTypeId: action.getUnitTypeId(),
            visible: true,
            position: worldPosition,
          });
        }
        this.updateReplayTriggerFansForAction(action, worldPosition, unitObject.position.y + 0.02);
      }
    }
  }

  /**
   * 1ステップ内のコンバット群を 3D ユニットへ反映する。
   *
   * @param step 再生対象のステップ。
   */
  private replayCombats(step: { getCombats: () => Combat[]; }): void {
    for (const combat of step.getCombats()) {
      const defendingUnitObject = this.deps.unitObjectById.get(combat.getDefendingUnitId());
      if (!defendingUnitObject) continue;

      if (!combat.getIsDefeatedCombat()) {
        continue;
      }

      // 3D版は 2D の撃破演出を簡略化し、撃破時は非表示化のみ行う。
      const enemyCharacterState = this.deps.enemyCharacterStatesById.get(combat.getDefendingUnitId());
      if (enemyCharacterState) {
        enemyCharacterState.setBailout(true);
      } else {
        defendingUnitObject.updateVisibility(false);
      }

      const friendUnit = this.deps.friendUnitsById.get(combat.getDefendingUnitId());
      if (friendUnit) {
        friendUnit.isBailout = true;
      }
    }
  }

  /**
   * 再生完了時のフェーズ復帰処理を実行する。
   *
   * @param turnNumber 完了したターン番号。
   */
  private completeUnitActionPhase(turnNumber: number): void {
    // 再生中の Running を止め、次の行動設定モードでは全ユニットを待機状態に戻す。
    this.setAllUnitsIdle();
    // 行動設定フェーズへ戻る前に、リプレイ用トリガー扇形を消す。
    this.clearAllReplayTriggerFans();

    // 前ターンの選択を持ち越すと、次ターンの初回クリックが「同じユニット再クリック」扱いになる。
    this.deps.clearSelection();
    this.resetPlayerActionResources();

    this.deps.setActionMode?.(false);
    this.deps.setActionAnimationInProgress?.(false);

    this.deps.clearPlannedSteps?.();
    this.deps.restoreActionPointsRemainSecondsText?.();
    this.deps.onReplayCompleted(turnNumber);
  }

  /**
   * 3D版のゲーム終了判定を行う。
   *
   * @param currentTurn 現在のターン番号。
   */
  private checkGameIsCompleted(currentTurn: number): GameResult {
    const playerAlive = Array.from(this.deps.friendUnitsById.values()).filter((unit) => !unit.isBailout);
    const enemyAlive = Array.from(this.deps.enemyCharacterStatesById.values()).filter((state) => !state.getEnemyUnit().isBailout);

    console.log(`checkGameIsCompleted: playerAlive=${playerAlive.length}, enemyAlive=${enemyAlive.length}, currentTurn=${currentTurn}`);

    const isPlayerDefeated = playerAlive.length === 0;
    const isEnemyDefeated = enemyAlive.length === 0;

    if (isPlayerDefeated && isEnemyDefeated) {
      return "Draw";
    }
    if (isPlayerDefeated) {
      return "Lose";
    }
    if (isEnemyDefeated) {
      return "Win";
    }
    if (currentTurn >= MAX_TURN) {
      return "Draw";
    }

    return "InProgress";
  }

  /**
   * 3D版での敵味方判定に応じて、サーバー座標を盤面座標へ変換する。
   *
   * 敵ユニットは表示用に反転配置しているため、受信した座標を反転して扱う。
   */
  private resolveGridPosition(unitId: string, position: { col: number; row: number; }): { col: number; row: number; } {
    if (this.deps.friendUnitsById.has(unitId)) {
      return position;
    }

    return this.deps.hexUtils.invertPosition(position);
  }

  /**
   * 現在の表示座標を、ユニット種別に応じて盤面座標で返す。
   *
   * 敵ユニットは表示用に反転配置しているため、保存済みの raw 座標を反転して比較する。
   */
  private getCurrentGridPosition(unitId: string): { col: number; row: number; } {
    if (this.deps.friendUnitsById.has(unitId)) {
      return this.deps.friendUnitsById.get(unitId)?.position ?? { col: 0, row: 0 };
    }

    const enemyCharacterState = this.deps.enemyCharacterStatesById.get(unitId);
    if (!enemyCharacterState) {
      return { col: 0, row: 0 };
    }

    return enemyCharacterState.getDisplayGridPosition() ?? this.deps.hexUtils.invertPosition(enemyCharacterState.getEnemyUnit().position);
  }

  /**
   * 行動モード終了時に、全ユニットのアニメーションを Idle へ戻す。
   *
   * 3D では Running のクロスフェードが残りやすいため、次の行動設定開始前に明示的に待機状態へ戻す。
   */
  private setAllUnitsIdle(): void {
    for (const unitObject of this.deps.unitObjectById.values()) {
      if (!unitObject.visible) {
        continue;
      }

      unitObject.playAnimation("Idle", 150);
    }
  }

  /**
   * 次ターンの行動設定開始に向けて、3D味方ユニットの行動リソースを初期化する。
   */
  private resetPlayerActionResources(): void {
    for (const state of this.deps.playerCharacterStates.values()) {
      const friendUnit = state.getFriendUnit();

      if (friendUnit.isBailout) {
        state.setActionPoints(0);
        state.setRemainSeconds(0);
        state.resetCurrentStep();
        continue;
      }

      const status = CHARACTER_STATUS[friendUnit.unitTypeId as keyof typeof CHARACTER_STATUS];
      const maxActionPoints = status?.activeCount ?? friendUnit.currentActionPoints;

      state.setActionPoints(maxActionPoints);
      state.setRemainSeconds(MAX_UNIT_EXEC_SECONDS);
      state.resetCurrentStep();
    }
  }

  /**
   * 1アクション分のトリガー方位を、3Dリプレイ用の扇形へ反映する。
   */
  private updateReplayTriggerFansForAction(
    action: { getUnitId: () => string; getUsingMainTriggerId: () => string; getUsingSubTriggerId: () => string; getMainTriggerAzimuth: () => number; getSubTriggerAzimuth: () => number; },
    center: { x: number; y: number; z: number; },
    y: number,
  ): void {
    const unitId = action.getUnitId();
    const isEnemyUnit = this.deps.enemyCharacterStatesById.has(unitId);
    const mainTriggerKey = action.getUsingMainTriggerId() as keyof typeof TRIGGER_STATUS;
    const subTriggerKey = action.getUsingSubTriggerId() as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];
    const mainAzimuth = this.resolveReplayTriggerAzimuth(action.getMainTriggerAzimuth(), isEnemyUnit);
    const subAzimuth = this.resolveReplayTriggerAzimuth(action.getSubTriggerAzimuth(), isEnemyUnit);

    if (mainTriggerStatus) {
      this.upsertReplayTriggerFan(
        this.mainReplayTriggerFans,
        unitId,
        {
          x: center.x,
          y,
          z: center.z,
        },
        0xff6b6b,
        mainAzimuth,
        mainTriggerStatus.angle,
        mainTriggerStatus.range,
      );
    }

    if (subTriggerStatus) {
      this.upsertReplayTriggerFan(
        this.subReplayTriggerFans,
        unitId,
        {
          x: center.x,
          y,
          z: center.z,
        },
        0x6b6bff,
        subAzimuth,
        subTriggerStatus.angle,
        subTriggerStatus.range,
      );
    }
  }

  /**
   * 敵ユニットのトリガー向きを、表示用に 180 度反転して返す。
   */
  private resolveReplayTriggerAzimuth(azimuth: number, isEnemyUnit: boolean): number {
    if (!isEnemyUnit) {
      return azimuth;
    }

    return (azimuth + 180) % 360;
  }

  /**
   * リプレイ用トリガー扇形を更新または新規作成する。
   */
  private upsertReplayTriggerFan(
    fanMap: Map<string, ThreeDTriggerFanObject>,
    unitId: string,
    center: { x: number; y: number; z: number; },
    color: number,
    azimuth: number,
    angle: number,
    range: number,
  ): void {
    const existing = fanMap.get(unitId);
    if (existing) {
      existing.updateTriggerAzimuth(azimuth, center, color, angle, range, true);
      return;
    }

    fanMap.set(
      unitId,
      new ThreeDTriggerFanObject(
        this.deps.scene3d,
        center,
        color,
        azimuth,
        angle,
        range,
        this.deps.gridConfig,
        true,
      ),
    );
  }

  /**
   * リプレイ中に表示した全ユニットのトリガー扇形を破棄する。
   */
  private clearAllReplayTriggerFans(): void {
    for (const fan of this.mainReplayTriggerFans.values()) {
      fan.dispose();
    }
    this.mainReplayTriggerFans.clear();

    for (const fan of this.subReplayTriggerFans.values()) {
      fan.dispose();
    }
    this.subReplayTriggerFans.clear();
  }
}