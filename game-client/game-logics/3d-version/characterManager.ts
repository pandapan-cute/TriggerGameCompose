'use client';

import { CharacterManager } from "../characterManager";
import { ThreeDUnitObject } from "./graphics/ThreeDUnitObject";

/**
 * キャラクター管理クラス
 */
export class ThreeDCharacterManager extends CharacterManager {

  public player3DCharacters: ThreeDUnitObject[] = []; // 自分のキャラクター
  public enemy3DCharacters: ThreeDUnitObject[] = []; // 相手のキャラクター

  // キャラクター選択・移動関連
  public selected3DCharacter: ThreeDUnitObject | null = null; // 選択されたキャラクター
  public movableHexes: Phaser.GameObjects.Graphics[] = []; // 移動可能な六角形のハイライト
}
