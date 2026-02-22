import { Position } from "../types";

/**
 * サーバーのCombat集約を受信用に表現するクラス
 */
export class Combat {
  private combatId: string;
  private attackingUnitId: string;
  private attackerPosition: Position;
  private attackerMainTriggerId: string;
  private attackerSubTriggerId: string;
  private attackerMainTriggerAzimuth: number;
  private attackerSubTriggerAzimuth: number;
  private attackerBaseAttack: number;
  private defendingUnitId: string;
  private defenderPosition: Position;
  private defenderMainTriggerId: string;
  private defenderSubTriggerId: string;
  private defenderMainTriggerAzimuth: number;
  private defenderSubTriggerAzimuth: number;
  private mainTriggerHp: number;
  private subTriggerHp: number;
  private defenderBaseDefense: number;
  private defenderBaseAvoid: number;
  private isAvoided: boolean;
  private isDefeated: boolean;

  constructor() {
    this.combatId = "";
    this.attackingUnitId = "";
    this.attackerPosition = { col: 0, row: 0 };
    this.attackerMainTriggerId = "";
    this.attackerSubTriggerId = "";
    this.attackerMainTriggerAzimuth = 0;
    this.attackerSubTriggerAzimuth = 0;
    this.attackerBaseAttack = 0;
    this.defendingUnitId = "";
    this.defenderPosition = { col: 0, row: 0 };
    this.defenderMainTriggerId = "";
    this.defenderSubTriggerId = "";
    this.defenderMainTriggerAzimuth = 0;
    this.defenderSubTriggerAzimuth = 0;
    this.mainTriggerHp = 0;
    this.subTriggerHp = 0;
    this.defenderBaseDefense = 0;
    this.defenderBaseAvoid = 0;
    this.isAvoided = false;
    this.isDefeated = false;
  }

  static fromJSON(rawCombat: unknown): Combat {
    return Object.setPrototypeOf(rawCombat as object, Combat.prototype) as Combat;
  }
}
