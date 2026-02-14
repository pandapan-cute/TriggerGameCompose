'use client';
import { HexUtils } from "../hexUtils";
import { EnemyUnit } from "../models/EnemyUnit";
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
    super(
      "", // 敵のユニット種別は初期値で空文字にしておく（必要に応じて後で設定）
      image,
      invertedPos, // 敵の座標は自分から見た逆位置で管理
      enemyUnit.unitTypeId,
      { main: 0, sub: 0 }, // トリガーの向きは初期値で0にしておく
      null
    );
  }

  /**
   * 敵キャラクターの視認状態を設定し、画像を更新する
   */
  private setCharacterImage() {
  }
}