import { Position } from "../types";

/**
 * 友軍ユニットのインターフェース
 */
export interface FriendUnit {
  unitId: string;
  unitTypeId: string;
  position: Position;
  usingMainTriggerId: string;
  usingSubTriggerId: string;
  havingMainTriggerIds: string[];
  havingSubTriggerIds: string[];
  mainTriggerHp: number;
  subTriggerHp: number;
  sightRange: number;
  isBailout: boolean;
}

