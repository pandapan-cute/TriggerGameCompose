'use client';
import { UnitType } from "../config/CharacterConfig";
import { TRIGGER_STATUS } from "../config/status";
import { HexUtils } from "../hexUtils";
import { Action } from "../models/Action";
import { Combat } from "../models/Combat";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { EnemyUnitImage } from "../phaser/game-objects/images/EnemyUnitImage";
import { FriendUnitImage } from "../phaser/game-objects/images/FriendUnitImage";
import { Position, TriggerDirection, } from "../types";

/**
 * キャラクターごとの状態管理の型定義
 */
export class CharacterImageState {

  constructor(
    /** ユニットID */
    private unitId: string,
    /** ユニット種別 */
    private unitTypeId: UnitType,
    /** Phaserのゲームオブジェクト */
    public image: FriendUnitImage | EnemyUnitImage,
    /** キャラクターの座標マス */
    public position: Position,
    /** キャラクターのID */
    public id: string,
    /** トリガーの向き */
    public direction: TriggerDirection,
    /** メイントリガーの表示オブジェクト */
    private mainTriggerFan: TriggerFanShape | null,
    /** サブトリガーの表示オブジェクト */
    private subTriggerFan: TriggerFanShape | null,
    /** ベイルアウト済みか */
    private isBailedOut: boolean,
    /** 座標計算系クラス */
    protected hexUtils: HexUtils,
  ) { }

  /**
   * 子クラスでオーバーライドされるキャラクターの単一アクションを実行する関数
   * @param action 
   * @param onStepComplete 
   */
  executeCharacterSingleAction(action: Action, onStepComplete: () => void) {
    this.executeCommonSingleAction(action, onStepComplete);
  }

  /**
   * キャラクターの単一アクションを実行する
   * @param action 
   * @param onStepComplete 
   */
  protected executeCommonSingleAction(action: Action, onStepComplete: () => void) {
    const targetPixelPos = this.hexUtils.getHexPosition(
      action.getPosition().col,
      action.getPosition().row
    );
    console.log(`キャラクター${this.unitId}の移動先: マス(${action.getPosition().col}, ${action.getPosition().row}) -> ピクセル(${targetPixelPos.x}, ${targetPixelPos.y})`);
    this.setDirection({ main: action.getMainTriggerAzimuth(), sub: action.getSubTriggerAzimuth() });
    console.log(`キャラクター${this.unitId}の向きを更新: メイン ${action.getMainTriggerAzimuth()}°, サブ ${action.getSubTriggerAzimuth()}°`);
    // 移動アニメーションを実行
    this.image.moveUnitTween(targetPixelPos.x, targetPixelPos.y, () => {
      // 移動完了後にトリガー表示を更新
      this.updateTriggerPositionsForCharacter(action);
    }, onStepComplete);
  }


  /**
   * キャラクターの現在位置に基づいてトリガー表示を更新（アニメーション追従用）
   */
  updateTriggerPositionsForCharacter(
    action: Action,
  ) {
    // メイントリガーのステータスを取得
    const mainTriggerKey = action.getUsingMainTriggerId() as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];
    // サブトリガーのステータスを取得
    const subTriggerKey = action.getUsingSubTriggerId() as keyof typeof TRIGGER_STATUS;
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];
    // メイントリガーの表示を更新
    this.mainTriggerFan?.updateTriggerAzimuth(action.getMainTriggerAzimuth(), this.image.x, this.image.y, mainTriggerStatus.angle, mainTriggerStatus.range, mainTriggerKey);
    // サブトリガーの表示を更新
    this.subTriggerFan?.updateTriggerAzimuth(action.getSubTriggerAzimuth(), this.image.x, this.image.y, subTriggerStatus.angle, subTriggerStatus.range, subTriggerKey);
  }

  /**
   * 攻撃を与えた際の攻撃の表示を行う
   * @param combat - 戦闘情報
   */
  executeCharacterAttack(
    combat: Combat
  ) {
    // 攻撃先(防御したユニット)の座標を取得
    const targetPosition = combat.getDefenderPosition();
    const invertedTargetPosition = this.hexUtils.invertPosition(targetPosition);
    const targetPixelPos = this.hexUtils.getHexPosition(invertedTargetPosition.col, invertedTargetPosition.row);

    // 攻撃エフェクトを表示
    this.image.drawAnimatedArrowBetweenCharacters(
      {
        x: targetPixelPos.x,
        y: targetPixelPos.y,
      }
    );
  }


  /**
   * 攻撃を受けた際の防御・回避の表示を行う
   * @param combat - 戦闘情報
   */
  executeCharacterDefense(
    combat: Combat
  ) {
    if (combat.getIsDefeatedCombat()) {
      // 撃破状態を表示してキャラクターを削除
      this.image.showBailOutAndRemoveCharacter();
      this.isBailedOut = true;
      this.hideMainTriggerFan();
      this.hideSubTriggerFan();
    } else if (combat.getIsAvoidedCombat()) {
      // 回避状態を表示
      this.image.showAvoidImage();
    } else {
      // 0より大きいHPの値を取得
      const validHpValues = [
        combat.getMainTriggerHp(),
        combat.getSubTriggerHp(),
      ].filter((hp) => hp > 0);
      const minHp = Math.min(...validHpValues);
      // 減ってるほうのシールド状態を表示
      this.image.showShieldImage(
        minHp
      );
    }
  }


  /** メイントリガーの表示をオフにする */
  hideMainTriggerFan() {
    this.mainTriggerFan?.setTriggerVisible(false);
  }
  /** サブトリガーの表示をオフにする */
  hideSubTriggerFan() {
    this.subTriggerFan?.setTriggerVisible(false);
  }

  // ゲッター
  getUnitId(): string {
    return this.unitId;
  }

  getUnitTypeId(): UnitType {
    return this.unitTypeId;
  }

  getIsBailedOut(): boolean {
    return this.isBailedOut;
  }

  // セッター
  setDirection(direction: TriggerDirection) {
    this.direction = direction;
  }
}