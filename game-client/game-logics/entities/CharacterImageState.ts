'use client';
import { Position, TriggerDirection, TriggerDisplay } from "../types";

/**
 * キャラクターごとの状態管理の型定義
 */
export class CharacterImageState {

  constructor(
    /** ユニット種別 */
    private unitTypeId: string,
    /** Phaserのゲームオブジェクト */
    public image: Phaser.GameObjects.Image,
    /** キャラクターの座標マス */
    public position: Position,
    /** キャラクターのID */
    public id: string,
    /** トリガーの向き */
    public direction: TriggerDirection,
    /** トリガーの表示オブジェクト */
    public triggerDisplay: TriggerDisplay | null
  ) { }


  // ゲッター
  getUnitTypeId(): string {
    return this.unitTypeId;
  }
}