'use client';
import { UnitType } from "../config/CharacterConfig";
import { Position, TriggerDirection, TriggerDisplay } from "../types";

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
  getUnitId(): string {
    return this.unitId;
  }

  getUnitTypeId(): UnitType {
    return this.unitTypeId;
  }
}