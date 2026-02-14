'use client';
import { Position, TriggerDirection, TriggerDisplay } from "../types";
import { CharacterImageState } from "./CharacterImageState";
import { HexUtils } from "../hexUtils";
import { ActionCompletedText } from "../phaser/game-objects/texts/ActionCompletedText";
import { ActionPointsText } from "../phaser/game-objects/texts/ActionPointsText";

export class PlayerCharacterState extends CharacterImageState {
  constructor(
    image: Phaser.GameObjects.Image,
    position: Position,
    id: string,
    direction: TriggerDirection,
    triggerDisplay: TriggerDisplay | null,
    /** 残りの行動力 */
    public actionPoints: number,
    /** 残りの行動力表示 */
    private actionPointsText: ActionPointsText | null,
    /** 行動設定完了表示 */
    public completeText: ActionCompletedText | null,
    /** 座標計算系クラス */
    public hexUtils: HexUtils
  ) {
    super(
      image,
      position,
      id,
      direction,
      triggerDisplay
    );
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
}