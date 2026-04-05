import { Position } from "./Position";
import { UnitType } from "./UnitType";


/**
 * 敵軍ユニットのインターフェース
 */
export interface EnemyUnit {
  unitId: string;
  unitTypeId: UnitType;
  position: Position;
  usingMainTriggerId: string;
  usingSubTriggerId: string;
  isBailout: boolean;
}
