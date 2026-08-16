import { MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { Position } from "@/game-logics/types";
import { FriendUnit } from "@/types/FriendUnit";

/**
 * 3D版の味方ユニット状態。
 *
 * 表示オブジェクトとは分離して、ゲーム進行上の可変状態だけを集約する。
 */
export class ThreeDPlayerCharacterState {
  private position: Position;
  private actionPoints: number;
  private remainSeconds: number;
  /** 現在ユニットが記録済みのステップ番号。 */
  private currentStep = 0;

  constructor(
    private readonly unitObject: ThreeDUnitObject,
    private readonly friendUnit: FriendUnit,
  ) {
    this.position = { ...friendUnit.position };
    this.actionPoints = friendUnit.currentActionPoints;
    this.remainSeconds = MAX_UNIT_EXEC_SECONDS;

    // 初期表示時点の装備トリガーを 3D モデルへ反映する。
    this.syncTriggerVisuals();
  }

  getUnitObject(): ThreeDUnitObject {
    return this.unitObject;
  }

  getFriendUnit(): FriendUnit {
    return this.friendUnit;
  }

  getPosition(): Position {
    return this.position;
  }

  setPosition(position: Position): void {
    this.position = position;
    this.friendUnit.position = position;
  }

  /**
   * リプレイ結果を味方ユニット状態へ反映する。
   */
  syncReplayState(options: {
    displayGridPosition: Position;
    currentActionPoints: number;
    usingMainTriggerId: string;
    usingSubTriggerId: string;
  }): void {
    this.setPosition(options.displayGridPosition);
    this.setActionPoints(options.currentActionPoints);
    this.friendUnit.usingMainTriggerId = options.usingMainTriggerId;
    this.friendUnit.usingSubTriggerId = options.usingSubTriggerId;
    this.syncTriggerVisuals();
  }

  getActionPoints(): number {
    return this.actionPoints;
  }

  setActionPoints(actionPoints: number): void {
    this.actionPoints = actionPoints;
    this.friendUnit.currentActionPoints = actionPoints;
  }

  getRemainSeconds(): number {
    return this.remainSeconds;
  }

  setRemainSeconds(remainSeconds: number): void {
    this.remainSeconds = remainSeconds;
  }

  /** 現在のステップ番号を返す。 */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /** ステップ番号を指定数だけ進める。 */
  advanceStep(steps = 1): void {
    this.currentStep += steps;
  }

  /** ステップ番号を初期値へ戻す。 */
  resetCurrentStep(): void {
    this.currentStep = 0;
  }

  /**
   * friendUnit が保持する現在装備トリガーを 3D モデルへ同期する。
   */
  private syncTriggerVisuals(): void {
    this.unitObject.syncEquippedTriggers({
      usingMainTriggerId: this.friendUnit.usingMainTriggerId,
      usingSubTriggerId: this.friendUnit.usingSubTriggerId,
    });
  }
}