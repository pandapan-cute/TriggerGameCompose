'use client';
import { GridConfig } from "../types";
import { CharacterImageState } from "./CharacterImageState";
import { HexUtils } from "../hexUtils";
import { ActionCompletedText } from "../phaser/game-objects/texts/ActionCompletedText";
import { FriendUnit } from "../../types/FriendUnit";
import { FriendUnitImage } from "../phaser/game-objects/images/FriendUnitImage";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { TRIGGER_STATUS } from "../config/status";
import { Combat } from "../models/Combat";
import { FieldViewService } from "../phaser/scenes/services/FieldViewService";
import { RemainSecondsWidget } from "../phaser/game-objects/widgets/RemainSecondsWidget";

export class PlayerCharacterState extends CharacterImageState {

  /** 残りの行動可能秒数 */
  private remainSecondsWidget: RemainSecondsWidget | null;
  /** 行動設定完了表示 */
  private completeText: ActionCompletedText | null;
  /** 現在のステップ番号(初期値は0) */
  private currentStep: number = 0;

  constructor(
    /** 残りの行動可能秒数 */
    private remainSeconds: number,
    /** Phaserシーンクラス */
    scene: Phaser.Scene,
    /** 味方ユニット情報 */
    private friendUnit: FriendUnit,
    /** 座標計算系クラス */
    hexUtils: HexUtils,
    /** グリッド設定 */
    gridConfig: GridConfig,
    /** フィールドビューサービス */
    fieldViewService: FieldViewService
  ) {
    const hexPosition = hexUtils.getHexPosition(friendUnit.position.col, friendUnit.position.row);
    const image = new FriendUnitImage(
      scene,
      hexPosition.x, hexPosition.y,
      friendUnit.unitTypeId,
      friendUnit.isBailout,
      gridConfig
    );

    // メイントリガーのステータスを取得
    const mainTriggerKey =
      friendUnit.usingMainTriggerId as keyof typeof TRIGGER_STATUS;
    const mainTriggerStatus = TRIGGER_STATUS[mainTriggerKey];

    // サブトリガーのステータスを取得
    const subTriggerKey = friendUnit.usingSubTriggerId as keyof typeof TRIGGER_STATUS;
    const subTriggerStatus = TRIGGER_STATUS[subTriggerKey];

    super(
      friendUnit.unitId,
      friendUnit.unitTypeId,
      image,
      friendUnit.position,
      friendUnit.unitId,
      { main: 0, sub: 0 },
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0xff4444, 0, 0, mainTriggerStatus.range, mainTriggerKey, gridConfig, hexUtils, false, fieldViewService),
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0x4444ff, 0, 0, subTriggerStatus.range, subTriggerKey, gridConfig, hexUtils, false, fieldViewService),
      friendUnit.isBailout,
      hexUtils,
      fieldViewService,
      friendUnit.currentActionPoints,
      null
    );

    this.remainSecondsWidget = null;
    this.completeText = null;
    this.currentStep = 0;

    if (!friendUnit.isBailout) {
      this.updateActionPointsDisplay(scene);
      this.updateRemainSecondsDisplay(scene);
    }
  }

  /**
   * 行動完了テキストを表示する
   * @param scene Phaserのシーン
   */
  showActionCompletedText(scene: Phaser.Scene) {

    const pixelPos = this.hexUtils.getHexPosition(
      this.position.col,
      this.position.row
    );

    // 既存のテキストがあれば削除
    const existingText = this.completeText;
    if (existingText) {
      existingText.destroy();
    }

    // 新しいテキストを作成
    const text = new ActionCompletedText(
      scene,
      pixelPos.x,
      pixelPos.y - 40,
      "行動設定済み"
    );

    this.completeText = text;
  }

  /**
   * 残り行動可能秒数表示を更新または削除する
   * @param points 新しい残り行動可能秒数、nullの場合は表示を削除
   */
  setRemainSecondsWidget(points: number | null) {
    if (points === null) {
      this.remainSecondsWidget?.destroy();
      this.remainSecondsWidget = null;
    } else {
      this.remainSeconds = points;
      this.remainSecondsWidget?.updateRemainSecondsDisplay({ x: this.image.x, y: this.image.y }, points);
    }
  }

  /**
   * キャラクター左下の残り行動可能秒数表示を更新する
   */
  updateRemainSecondsDisplay(scene: Phaser.Scene) {
    const pixelPos = this.hexUtils.getHexPosition(
      this.position.col,
      this.position.row
    );

    const existingWidget = this.remainSecondsWidget;
    if (existingWidget) {
      existingWidget.updateRemainSecondsDisplay({ x: pixelPos.x, y: pixelPos.y }, this.remainSeconds);
      return;
    }

    // 新しいテキストを作成
    this.remainSecondsWidget = new RemainSecondsWidget(
      scene,
    );
    this.remainSecondsWidget.updateRemainSecondsDisplay({ x: pixelPos.x, y: pixelPos.y }, this.remainSeconds);
  }

  /** 
   * キャラクターが防御アクションを実行した際の処理
   * @override CharacterImageStateの同名メソッドをオーバーライドして、撃破された場合は行動力表示を削除する
   */
  executeCharacterDefense(
    combat: Combat
  ) {
    super.executeCharacterDefense(combat);
    if (combat.getIsDefeatedCombat()) {
      this.setFriendUnitBailout(true);
      this.setActionPointsText(null);
      this.setRemainSecondsWidget(null);
    }
  }

  /** 現在のステップ数を指定値分進める */
  advanceStep(steps: number = 1) {
    this.currentStep += steps;
  }

  resetCurrentStep() {
    this.currentStep = 0;
  }

  // ゲッター
  getCompleteText() {
    return this.completeText;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  getFriendUnit() {
    return this.friendUnit;
  }

  getRemainSeconds() {
    return this.remainSeconds;
  }

  // セッター
  setCompleteText(text: ActionCompletedText | null) {
    this.completeText = text;
  }

  setRemainSeconds(seconds: number) {
    this.remainSeconds = seconds;
  }

  private setFriendUnitBailout(isBailout: boolean) {
    this.friendUnit.isBailout = isBailout;
  }
}