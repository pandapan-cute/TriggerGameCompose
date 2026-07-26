import { ThreeDCharacterManager } from "@/game-logics/3d-version/characterManager";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { Action, ActionType } from "@/game-logics/models/Action";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { HexUtils } from "@/game-logics/hexUtils";
import { Position, TriggerDirection } from "@/game-logics/types";

/**
 * ThreeDTurnPlanner が参照する依存関係。
 *
 * 補足:
 * 3D版の行動履歴構築と送信判定を、2D版 TurnPlanner に寄せた形で切り出すための最小構成。
 */
export interface ThreeDTurnPlannerDeps {
  scene: Phaser.Scene;
  characterManager: ThreeDCharacterManager;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  hexUtils: HexUtils;
  clearSelection: () => void;
  sendServerTurn: (steps: Step[]) => void;
}

/**
 * 3D版の行動計画、残り秒数判定、turnExecution 送信を扱う。
 *
 * 2D版 TurnPlanner と同じく「行動履歴を溜める」「未完了分を補完する」「送信する」責務を持つ。
 */
export class ThreeDTurnPlanner {
  /** 動きの設定の締切時間のタイマー */
  private motionLabEndTimeout: NodeJS.Timeout | null = null;

  /** サーバー送信用の計画ターン。 */
  private readonly plannedTurn = new Turn();
  /** 各ユニットの直近で履歴記録済みの位置。 */
  private readonly lastRecordedPositionByUnit = new Map<ThreeDUnitObject, Position>();
  /** 各ユニットの最後に記録したトリガー方向。 */
  private readonly triggerDirectionByUnit = new Map<ThreeDUnitObject, TriggerDirection>();
  /** 今ターンの送信済みフラグ。 */
  private hasSubmittedCurrentTurn = false;

  constructor(private readonly deps: ThreeDTurnPlannerDeps) {
    this.syncRecordedPositions();
  }

  /**
   * 現在選択中ユニットの行動を Turn の Step 履歴へ記録する。
   *
   * @param unitObject 履歴記録対象の 3D ユニット。
   * @param direction main/sub のトリガー方向。
   * @returns 記録後の残り秒数。
   */
  public recordActionHistory(unitObject: ThreeDUnitObject, direction: TriggerDirection): number {
    const state = this.deps.playerCharacterStates.get(unitObject);
    if (!state) {
      return 0;
    }

    this.triggerDirectionByUnit.set(unitObject, direction);

    const currentPosition = state.getPosition();
    const beforePosition = this.lastRecordedPositionByUnit.get(unitObject) ?? currentPosition;

    const hasMoved =
      beforePosition.col !== currentPosition.col || beforePosition.row !== currentPosition.row;

    // 移動している場合は経路上の各マスを、待機の場合は現在地を 1 手ずつ記録する。
    const path = hasMoved
      ? this.deps.hexUtils.findPath(beforePosition, currentPosition)
      : [currentPosition];

    for (const step of path) {
      const action = this.createAction(state, step, direction);
      this.plannedTurn.addActionWithIndex(state.getCurrentStep(), action);
      state.advanceStep();
    }

    this.lastRecordedPositionByUnit.set(unitObject, {
      col: currentPosition.col,
      row: currentPosition.row,
    });

    return Math.max(0, state.getRemainSeconds());
  }

  /**
   * ベイルアウト済みを除く全ユニットが 15 秒分の行動設定を完了したか判定する。
   * 完了時は turnExecution を 1 回だけ送信する。
   */
  public checkAllCharactersActionPointsCompleted(): void {
    if (this.hasSubmittedCurrentTurn) return;

    let allCompleted = true;
    for (const state of this.deps.playerCharacterStates.values()) {
      if (state.getFriendUnit().isBailout) {
        continue;
      }

      const remainSeconds = Math.max(0, state.getRemainSeconds());
      if (remainSeconds > 0) {
        allCompleted = false;
      }
    }

    if (!allCompleted || this.deps.characterManager.player3DCharacters.length === 0) {
      return;
    }

    this.submitPlannedTurn();
  }

  /**
   * 計画中ターンのステップ履歴をクリアする。
   */
  public clearPlannedSteps(): void {
    this.plannedTurn.clearSteps();
  }

  /**
   * 現在保持している計画ターンを返す。
   */
  public getPlannedTurn(): Turn {
    return this.plannedTurn;
  }

  /**
   * 動きの設定の締切時間を設定する。
   *
   * 2D版と同様に、未完了ユニットがある場合は締切時刻で自動送信する。
   */
  public setMotionLabEnd(endTime: Date): void {
    if (this.motionLabEndTimeout) {
      clearTimeout(this.motionLabEndTimeout);
      this.motionLabEndTimeout = null;
    }

    this.motionLabEndTimeout = this.runAt(endTime, () => {
      this.sendMotionLabTurn();
    });
  }

  /**
   * 動きの設定を送信する際に実行する処理。
   *
   * 未完了ユニットは現在位置で待機アクションを補完してから送信する。
   */
  public sendMotionLabTurn(): void {
    this.fillIncompleteActions();
    this.deps.clearSelection();
    this.submitPlannedTurn();
    console.log("動きの設定を送信しました。");
  }

  /**
   * 次ターンに備えて 3D 側の行動計画状態を初期化する。
   */
  public resetPlannedTurnState(): void {
    this.clearPlannedSteps();
    this.hasSubmittedCurrentTurn = false;

    for (const state of this.deps.playerCharacterStates.values()) {
      state.resetCurrentStep();
    }

    this.syncRecordedPositions();
  }

  /**
   * 未完了ユニット分の待機アクションを補完する。
   */
  private fillIncompleteActions(): void {
    const incompleteCharacters = Array.from(this.deps.playerCharacterStates.values()).filter(
      (state) => !state.getFriendUnit().isBailout && state.getRemainSeconds() > 0,
    );

    // 3D版ではユニットごとに記録済み方向を保持しているため、各ユニットの現在位置を待機で埋める。
    for (const state of incompleteCharacters) {
      const unitObject = state.getUnitObject();
      const direction = this.triggerDirectionByUnit.get(unitObject) ?? { main: 0, sub: 0 };
      const currentPosition = state.getPosition();

      for (let i = 0; i < state.getRemainSeconds(); i++) {
        const action = this.createAction(state, currentPosition, direction);
        this.plannedTurn.addActionWithIndex(state.getCurrentStep(), action);
        state.advanceStep();
      }
    }
  }

  /**
   * 現在の計画ターンを送信し、二重送信を防止する。
   */
  private submitPlannedTurn(): void {
    if (this.hasSubmittedCurrentTurn) return;

    this.hasSubmittedCurrentTurn = true;
    this.deps.sendServerTurn(this.plannedTurn.getSteps());

    if (this.motionLabEndTimeout) {
      clearTimeout(this.motionLabEndTimeout);
      this.motionLabEndTimeout = null;
    }
  }

  /**
   * 3Dユニットの現在位置から Action を組み立てる。
   */
  private createAction(
    state: ThreeDPlayerCharacterState,
    position: Position,
    direction: TriggerDirection,
  ): Action {
    const friendUnit = state.getFriendUnit();

    return new Action(
      ActionType.Move,
      friendUnit.unitId,
      friendUnit.unitTypeId,
      { col: position.col, row: position.row },
      friendUnit.usingMainTriggerId,
      friendUnit.usingSubTriggerId,
      direction.main,
      direction.sub,
    );
  }

  /**
   * 現在のユニット座標を再同期する。
   */
  private syncRecordedPositions(): void {
    this.lastRecordedPositionByUnit.clear();

    for (const [unitObject, state] of this.deps.playerCharacterStates.entries()) {
      this.lastRecordedPositionByUnit.set(unitObject, { ...state.getPosition() });
    }
  }

  /**
   * 指定時刻にタスクを実行する。
   */
  private runAt(targetDate: Date, task: () => void): NodeJS.Timeout | null {
    const now = Date.now();
    const delay = targetDate.getTime() - now;

    if (delay <= 0) {
      task();
      return null;
    }

    return setTimeout(task, delay);
  }
}