import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { EnemyUnit } from "@/types/EnemyUnit";
import { FriendUnit } from "@/types/FriendUnit";
import { HexUtils } from "@/game-logics/hexUtils";
import { GameResult } from "@/types/GameTypes";
import { Combat } from "@/game-logics/models/Combat";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { MAX_TURN } from "@/game-logics/config/game-config";
import { MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";
import { CHARACTER_STATUS } from "@/game-logics/config/status";

/**
 * ThreeDTurnReplayController が参照する依存関係。
 *
 * 補足:
 * 3D版のターン再生を Scene から分離し、2D版 TurnReplayController と同じ役割分担に寄せる。
 */
export interface ThreeDTurnReplayControllerDeps {
  scene3d: Phaser.Scene;
  hexUtils: HexUtils;
  placementService: ThreeDCharacterPlacementService;
  unitObjectById: Map<string, ThreeDUnitObject>;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  friendUnitsById: Map<string, FriendUnit>;
  enemyUnitsById: Map<string, EnemyUnit>;
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
  constructor(private readonly deps: ThreeDTurnReplayControllerDeps) { }

  /**
   * 受信したターンを先頭ステップから順次再生する。
   *
   * @param turn サーバーから受信したターン情報。
   */
  public executeTurn(turn: Turn): void {
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
        unitObject.position.y,
      );

      const isMoving =
        currentGridPosition.col !== targetGridPosition.col ||
        currentGridPosition.row !== targetGridPosition.row;

      if (isMoving) {
        // 3D版では移動アニメーションを先行し、完了時に状態を確定する。
        unitObject.faceToward(worldPosition);
        unitObject.playAnimation("Running", 120);
        unitObject.moveTo(worldPosition, 750, () => {
          unitObject.setWorldPosition(worldPosition.x, worldPosition.y, worldPosition.z);
          if (playerState) {
            playerState.setPosition(targetGridPosition);
            playerState.setActionPoints(action.getCurrentActionPoints());
          }

          const enemyUnit = this.deps.enemyUnitsById.get(action.getUnitId());
          if (enemyUnit) {
            enemyUnit.position = { ...action.getPosition() };
          }
        });
      } else {
        // 移動しないアクションは Idle のまま、座標と表示だけを更新する。
        unitObject.playAnimation("Idle", 120);
        if (playerState) {
          playerState.setPosition(targetGridPosition);
          playerState.setActionPoints(action.getCurrentActionPoints());
        }

        const enemyUnit = this.deps.enemyUnitsById.get(action.getUnitId());
        if (enemyUnit) {
          enemyUnit.position = { ...action.getPosition() };
        }

        unitObject.setWorldPosition(worldPosition.x, worldPosition.y, worldPosition.z);
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
      defendingUnitObject.updateVisibility(false);
      const friendUnit = this.deps.friendUnitsById.get(combat.getDefendingUnitId());
      if (friendUnit) {
        friendUnit.isBailout = true;
      }

      const enemyUnit = this.deps.enemyUnitsById.get(combat.getDefendingUnitId());
      if (enemyUnit) {
        enemyUnit.isBailout = true;
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
    const enemyAlive = Array.from(this.deps.enemyUnitsById.values()).filter((unit) => !unit.isBailout);

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

    const enemyUnit = this.deps.enemyUnitsById.get(unitId);
    if (!enemyUnit) {
      return { col: 0, row: 0 };
    }

    return this.deps.hexUtils.invertPosition(enemyUnit.position);
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
}