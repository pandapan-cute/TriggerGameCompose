'use client';
import { UnitType } from "@/types/UnitType";
import { TRIGGER_STATUS } from "../config/status";
import { HexUtils } from "../hexUtils";
import { Action } from "../models/Action";
import { Combat } from "../models/Combat";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { EnemyUnitImage } from "../phaser/game-objects/images/EnemyUnitImage";
import { FriendUnitImage } from "../phaser/game-objects/images/FriendUnitImage";
import { Position, TriggerDirection, } from "../types";
import { FieldViewService } from "../phaser/scenes/services/FieldViewService";
import { ActionPointsText } from "../phaser/game-objects/texts/ActionPointsText";

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
    /** フィールドビューサービス */
    protected fieldViewService: FieldViewService,
    /** 残りの行動力 */
    private actionPoints: number,
    /** 残りの行動力表示 */
    private actionPointsText: ActionPointsText | null
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
    const duration = this.position.col !== 36 ? 750 : 0; // バッグワーム状態なら移動アニメなし
    this.position = action.getPosition(); // キャラクターの座標を更新
    console.log(`キャラクター${this.unitId}の移動先: マス(${action.getPosition().col}, ${action.getPosition().row}) -> ピクセル(${targetPixelPos.x}, ${targetPixelPos.y})`);
    this.setDirection({ main: action.getMainTriggerAzimuth(), sub: action.getSubTriggerAzimuth() });
    console.log(`キャラクター${this.unitId}の向きを更新: メイン ${action.getMainTriggerAzimuth()}°, サブ ${action.getSubTriggerAzimuth()}°`);
    // ユニットの画像と可視状態を更新
    this.image.updateUnitImage(action.getUnitTypeId());
    this.image.setVisible(action.getPosition().col !== 36 && action.getPosition().row !== 36); // 座標が範囲外でない場合のみ表示
    // 移動アニメーションを実行
    this.image.moveUnitTween(targetPixelPos.x, targetPixelPos.y, duration, () => {
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
    const visible = action.getPosition().col < 0 || action.getPosition().row > 35 ? false : true; // 座標が範囲外なら非表示
    // メイントリガーのステータスを取得
    const mainTriggerKey = action.getUsingMainTriggerId() as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];
    // サブトリガーのステータスを取得
    const subTriggerKey = action.getUsingSubTriggerId() as keyof typeof TRIGGER_STATUS;
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];
    // メイントリガーの表示を更新
    this.mainTriggerFan?.updateTriggerAzimuth(action.getMainTriggerAzimuth(), this.image.x, this.image.y, mainTriggerStatus.angle, mainTriggerStatus.range, mainTriggerKey, visible);
    this.mainTriggerFan?.drawTriggerRangePoints(action.getPosition().col, action.getPosition().row, 0xff6b6b);
    // サブトリガーの表示を更新
    this.subTriggerFan?.updateTriggerAzimuth(action.getSubTriggerAzimuth(), this.image.x, this.image.y, subTriggerStatus.angle, subTriggerStatus.range, subTriggerKey, visible);
    this.subTriggerFan?.drawTriggerRangePoints(action.getPosition().col, action.getPosition().row, 0x6b6bff);
    // 残り行動力の表示を更新
    this.actionPoints = action.getCurrentActionPoints();
    this.updateActionPointsDisplay(this.image.scene);
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
      this.clearTriggerFans();
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

  /** 行動力表示を更新または削除する
   * @param points 新しい行動力、nullの場合は表示を削除
   */
  setActionPointsText(points: number | null) {
    if (points === null) {
      this.actionPointsText?.destroy();
      this.actionPointsText = null;
    } else {
      this.actionPoints = points;
      this.actionPointsText?.updatePoints(points);
    }
  }

  /**
   * 行動力を減らす
   */
  decrementActionPoints(points: number = 1) {
    this.setActionPointsText(Math.max(0, this.actionPoints - points));
  }

  /**
   * キャラクター左下の行動力表示を更新する
   */
  updateActionPointsDisplay(scene: Phaser.Scene) {
    const pixelPos = this.hexUtils.getHexPosition(
      this.position.col,
      this.position.row
    );

    const existingText = this.actionPointsText;
    if (existingText) {
      existingText.setPosition(pixelPos.x, pixelPos.y + 24);
      existingText.updatePoints(this.actionPoints);
      return;
    }

    // 新しいテキストを作成
    this.actionPointsText = new ActionPointsText(
      scene,
      pixelPos.x,
      pixelPos.y + 24,
      this.actionPoints
    );
  }


  /** メイントリガーの表示をオフにする */
  hideMainTriggerFan() {
    this.mainTriggerFan?.setTriggerVisible(false);
  }
  /** サブトリガーの表示をオフにする */
  hideSubTriggerFan() {
    this.subTriggerFan?.setTriggerVisible(false);
  }

  /** ベイルアウト時にトリガー表示をクリアする */
  clearTriggerFans() {
    this.mainTriggerFan?.setTriggerVisible(false);
    this.mainTriggerFan?.destroy();
    this.mainTriggerFan = null;
    this.subTriggerFan?.setTriggerVisible(false);
    this.subTriggerFan?.destroy();
    this.subTriggerFan = null;
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

  getActionPoints() {
    return this.actionPoints;
  }

  // セッター
  setDirection(direction: TriggerDirection) {
    this.direction = direction;
  }

  setActionPoints(points: number) {
    this.actionPoints = points;
  }
}