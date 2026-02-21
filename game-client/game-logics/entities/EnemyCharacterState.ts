'use client';
import { UnitType } from "../config/CharacterConfig";
import { TRIGGER_STATUS } from "../config/status";
import { HexUtils } from "../hexUtils";
import { Action } from "../models/Action";
import { EnemyUnit } from "../models/EnemyUnit";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { EnemyUnitImage } from "../phaser/game-objects/images/EnemyUnitImage";
import { GridConfig } from "../types";
import { CharacterImageState } from "./CharacterImageState";

/**
 * 敵キャラクターごとの状態管理の型定義
 */
export class EnemyCharacterState extends CharacterImageState {
  constructor(
    scene: Phaser.Scene,
    enemyUnit: EnemyUnit,
    hexUtils: HexUtils,
    private gridConfig: GridConfig
  ) {
    const invertedPos = hexUtils.invertPosition(enemyUnit.position);
    const hexPosition = hexUtils.getHexPosition(
      invertedPos.col,
      invertedPos.row
    );
    const image = new EnemyUnitImage(
      scene,
      hexPosition.x, hexPosition.y,
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
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0xff4444, 0, 0, mainTriggerStatus.range, mainTriggerKey, gridConfig, hexUtils, false),
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0x4444ff, 0, 0, subTriggerStatus.range, subTriggerKey, gridConfig, hexUtils, false),
      hexUtils
    );
  }

  executeCharacterSingleStep(action: Action, onStepComplete: () => void) {
    action.invertPositionForEnemy(this.gridConfig); // エネミー用に座標を反転させる
    this.executeCommonSingleStep(action, onStepComplete);
  }
}