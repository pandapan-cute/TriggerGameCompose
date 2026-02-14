import { Position } from "../types";

/**
 * 敵軍ユニットのインターフェース
 */
export interface EnemyUnit {
  unitId: string;
  unitTypeId: string;
  position: Position;
  usingMainTriggerId: string;
  usingSubTriggerId: string;
  isBailout: boolean;
}
