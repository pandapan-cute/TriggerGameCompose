'use client';
import { GridConfig, Position } from "../types";
import { CharacterImageState } from "./CharacterImageState";
import { HexUtils } from "../hexUtils";
import { ActionCompletedText } from "../phaser/game-objects/texts/ActionCompletedText";
import { ActionPointsText } from "../phaser/game-objects/texts/ActionPointsText";
import { FriendUnit } from "../models/FriendUnit";
import { FriendUnitImage } from "../phaser/game-objects/images/FriendUnitImage";
import { TriggerFanShape } from "../phaser/game-objects/graphics/TriggerFanShape";
import { TRIGGER_STATUS } from "../config/status";
import { Combat } from "../models/Combat";

export class PlayerCharacterState extends CharacterImageState {

  /** 残りの行動力表示 */
  private actionPointsText: ActionPointsText | null;
  /** 行動設定完了表示 */
  private completeText: ActionCompletedText | null;
  /** 現在のステップ番号(初期値は0) */
  private currentStep: number = 0;

  constructor(
    /** 残りの行動力 */
    private actionPoints: number,
    /** Phaserシーンクラス */
    scene: Phaser.Scene,
    /** 味方ユニット情報 */
    friendUnit: FriendUnit,
    /** 座標計算系クラス */
    hexUtils: HexUtils,
    /** グリッド設定 */
    gridConfig: GridConfig
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
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0xff4444, 0, 0, mainTriggerStatus.range, mainTriggerKey, gridConfig, hexUtils, false),
      new TriggerFanShape(scene, hexPosition.x, hexPosition.y, 0x4444ff, 0, 0, subTriggerStatus.range, subTriggerKey, gridConfig, hexUtils, false),
      friendUnit.isBailout,
      hexUtils
    );

    this.actionPointsText = null;
    this.completeText = null;
    this.currentStep = 0;

    if (!friendUnit.isBailout) {
      this.updateActionPointsDisplay(scene);
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
   * 目的地に向けて一番近くの隣接マスに移動する
   * @param target 目的地の座標
   * @return 移動した場合はtrue、すでに目的地にいる場合はfalse
   */
  moveTowardsAdjacent(target: Position): boolean {
    let result = false;
    if (target.col > this.position.col) {
      result = true;
      this.position.col += 1;
    } else if (target.col < this.position.col) {
      result = true;
      this.position.col -= 1;
    }

    if (target.row > this.position.row) {
      result = true;
      this.position.row += 1;
    } else if (target.row < this.position.row) {
      result = true;
      this.position.row -= 1;
    }

    if (result) {
      // 移動先のピクセル座標を計算
      const targetPosition = this.hexUtils.getHexPosition(this.position.col, this.position.row);
      this.image.setPosition(
        targetPosition.x,
        targetPosition.y
      );
      // 行動力を1減らす
      this.actionPoints = Math.max(0, this.actionPoints - 1);
    }

    return result;
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
   * キャラクター左下の行動力表示を更新する
   */
  updateActionPointsDisplay(scene: Phaser.Scene) {
    const pixelPos = this.hexUtils.getHexPosition(
      this.position.col,
      this.position.row
    );

    const existingText = this.actionPointsText;
    if (existingText) {
      existingText.setPosition(pixelPos.x - 12, pixelPos.y + 20);
      existingText.updatePoints(this.actionPoints);
      return;
    }

    // 新しいテキストを作成
    this.actionPointsText = new ActionPointsText(
      scene,
      pixelPos.x - 12,
      pixelPos.y + 20,
      this.actionPoints
    );
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
      this.setActionPointsText(null);
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
  getActionPoints() {
    return this.actionPoints;
  }

  getCompleteText() {
    return this.completeText;
  }

  getCurrentStep() {
    return this.currentStep;
  }

  // セッター
  setActionPoints(points: number) {
    this.actionPoints = points;
  }

  setCompleteText(text: ActionCompletedText | null) {
    this.completeText = text;
  }
}