import { UnitType } from "../config/CharacterConfig";
import { Position } from "../types";

/**
 * アクションの種類
 */
export enum ActionType {
  MOVE = "MOVE",
  WAIT = "WAIT",
  GUARD = "GUARD",
  UNIQUECOMMAND = "UNIQUECOMMAND",
  PURSUITMOVE = "PURSUITMOVE",
}

/**
 * アクションのインターフェース
 */
export interface Action {
  actionId: string;
  actionType: ActionType;
  unitId: string;
  unitTypeId: UnitType;
  position: Position;
  usingMainTriggerId: string;
  usingSubTriggerId: string;
  mainTriggerAzimuth: number;
  subTriggerAzimuth: number;
}


/**
 * アクションの実装クラス
 * 個々のユニットの一回の行動 -> Action
 */
export class Action implements Action { }