'use client';

import { CharacterManager } from "../characterManager";
import { ThreeDEnemyCharacterState } from "./entities/ThreeDEnemyCharacterState";
import { ThreeDPlayerCharacterState } from "./entities/ThreeDPlayerCharacterState";
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

  /** 3D味方ユニットの状態一覧。 */
  public readonly playerCharacterStates = new Map<ThreeDUnitObject, ThreeDPlayerCharacterState>();
  /** 3D敵ユニットの状態一覧。 */
  public readonly enemyCharacterStatesById = new Map<string, ThreeDEnemyCharacterState>();
  /** 3Dユニットの現在グリッド座標一覧。 */
  public readonly unitGridPositions = new Map<ThreeDUnitObject, { col: number; row: number; }>();
}
