import { UnitType } from "../config/CharacterConfig";
import { GridConfig, Position } from "../types";

/**
 * アクションの種類
 */
export enum ActionType {
  Move = "Move",
  Wait = "Wait",
  Guard = "Guard",
  UniqueCommand = "UniqueCommand",
  PursuitMove = "PursuitMove",
}


/**
 * アクションの実装クラス
 * 個々のユニットの一回の行動 -> Action
 */
export class Action {
  private actionId: string;
  private actionType: ActionType;
  private unitId: string;
  private unitTypeId: UnitType;
  private position: Position;
  private usingMainTriggerId: string;
  private usingSubTriggerId: string;
  private mainTriggerAzimuth: number;
  private subTriggerAzimuth: number;

  constructor(
    actionType: ActionType,
    unitId: string,
    unitTypeId: UnitType,
    position: Position,
    usingMainTriggerId: string,
    usingSubTriggerId: string,
    mainTriggerAzimuth: number,
    subTriggerAzimuth: number
  ) {
    this.actionId = crypto.randomUUID();
    this.actionType = actionType;
    this.unitId = unitId;
    this.unitTypeId = unitTypeId;
    this.position = position;
    this.usingMainTriggerId = usingMainTriggerId;
    this.usingSubTriggerId = usingSubTriggerId;
    this.mainTriggerAzimuth = mainTriggerAzimuth;
    this.subTriggerAzimuth = subTriggerAzimuth;
  }

  static fromJSON(rawAction: unknown): Action {
    return Object.setPrototypeOf(rawAction as object, Action.prototype) as Action;
  }

  /**
   * エネミー用に座標を反転させる
   */
  invertPositionForEnemy(gridConfig: GridConfig) {
    const invertedCol = gridConfig.gridWidth - 1 - this.position.col;
    const invertedRow = gridConfig.gridHeight - 1 - this.position.row;
    this.position = { col: invertedCol, row: invertedRow };
  }

  /**
   * エネミー用にトリガー角度を反転させる
   */
  invertTriggerAngleForEnemy(gridConfig: GridConfig) {
    this.mainTriggerAzimuth = (this.mainTriggerAzimuth + 180) % 360;
    this.subTriggerAzimuth = (this.subTriggerAzimuth + 180) % 360;
  }

  // ゲッター
  getUnitId(): string {
    return this.unitId;
  }

  getPosition(): Position {
    return this.position;
  }

  getUsingMainTriggerId(): string {
    return this.usingMainTriggerId;
  }

  getUsingSubTriggerId(): string {
    return this.usingSubTriggerId;
  }

  getMainTriggerAzimuth(): number {
    return this.mainTriggerAzimuth;
  }

  getSubTriggerAzimuth(): number {
    return this.subTriggerAzimuth;
  }
}