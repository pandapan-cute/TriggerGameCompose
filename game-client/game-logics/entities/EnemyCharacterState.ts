'use client';
import { EnemyUnit } from "@/types/EnemyUnit";
import { TRIGGER_STATUS } from "../config/status";
import { HexUtils } from "../hexUtils";
import { Action } from "../models/Action";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { EnemyUnitImage } from "../phaser/game-objects/images/EnemyUnitImage";
import { GridConfig } from "../types";
import { CharacterImageState } from "./CharacterImageState";
import { UnitType } from "@/types/UnitType";
import { Combat } from "../models/Combat";

/**
 * 敵キャラクターごとの状態管理の型定義
 */
export class EnemyCharacterState extends CharacterImageState {
  constructor(
    scene: Phaser.Scene,
    private enemyUnit: EnemyUnit,
    hexUtils: HexUtils,
    private gridConfig: GridConfig
  ) {
    const invertedPos = hexUtils.invertPosition(enemyUnit.position);
    const hexPosition = hexUtils.getHexPosition(
      invertedPos.col,
      invertedPos.row
    );
    const visible = enemyUnit.position.col === -1 || enemyUnit.position.row === -1 ? false : true; // 反転後の座標が範囲外なら非表示
    const image = new EnemyUnitImage(
      scene,
      enemyUnit.unitTypeId,
      hexPosition.x, hexPosition.y,
      enemyUnit.isBailout,
      visible,
      gridConfig
    );

    // メイントリガーのステータスを取得
    const mainTriggerKey =
      enemyUnit.usingMainTriggerId as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];

    // サブトリガーのステータスを取得
    const subTriggerKey = enemyUnit.usingSubTriggerId as keyof typeof TRIGGER_STATUS;
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];
    super(
      enemyUnit.unitId,
      UnitType.UNKNOWN, // 敵のユニット種別は初期値でUNKNOWNにしておく
      image,
      invertedPos, // 敵の座標は自分から見た逆位置で管理
      enemyUnit.unitTypeId,
      { main: 0, sub: 0 }, // トリガーの向きは初期値で0にしておく
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0xff4444, 0, 0, mainTriggerStatus?.range, mainTriggerKey, gridConfig, hexUtils, false),
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0x4444ff, 0, 0, subTriggerStatus?.range, subTriggerKey, gridConfig, hexUtils, false),
      enemyUnit.isBailout,
      hexUtils
    );
  }

  /**
   * 行動モードの単一アクションを実行する
   * @param action 
   * @param onStepComplete 
   */
  executeCharacterSingleAction(action: Action, onStepComplete: () => void) {
    action.invertPositionForEnemy(this.gridConfig); // エネミー用に座標を反転させる
    action.invertTriggerAngleForEnemy(); // エネミー用にトリガー角度を反転させる
    this.setEnemyUnitTypeId(action.getUnitTypeId()); // 敵のユニット種別を更新
    this.executeCommonSingleAction(action, onStepComplete);
  }

  /** 
   * キャラクターが防御アクションを実行した際の処理
   * @override CharacterImageStateの同名メソッドをオーバーライドして、エネミーのベイルアウト状態を更新する処理を追加
   */
  executeCharacterDefense(
    combat: Combat
  ) {
    super.executeCharacterDefense(combat);
    if (combat.getIsDefeatedCombat()) {
      this.setEnemyUnitBailout(true);
    }
  }

  // ゲッター
  getEnemyUnitData() {
    return this.enemyUnit;
  }

  // セッター
  private setEnemyUnitBailout(isBailout: boolean) {
    this.enemyUnit.isBailout = isBailout;
  }

  private setEnemyUnitTypeId(unitTypeId: UnitType) {
    this.enemyUnit.unitTypeId = unitTypeId;
  }
}