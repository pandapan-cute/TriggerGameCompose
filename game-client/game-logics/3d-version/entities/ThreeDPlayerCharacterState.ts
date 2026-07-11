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

  constructor(
    private readonly unitObject: ThreeDUnitObject,
    private readonly friendUnit: FriendUnit,
  ) {
    this.position = { ...friendUnit.position };
    this.actionPoints = friendUnit.currentActionPoints;
    this.remainSeconds = MAX_UNIT_EXEC_SECONDS;
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
}