/**
 * メイントリガーとサブトリガーの向きを定義
 * @interface TriggerDirection
 * @property {number} main - メイントリガーの向き
 * @property {number} sub - サブトリガーの向き
 */
export interface TriggerDirection {
  main: number;
  sub: number;
}

/**
 * グリッド上のマスの座標を定義
 * @interface Position
 * @property {number} col - 列番号
 * @property {number} row - 行番号
 */
export interface Position {
  col: number;
  row: number;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export interface ActionHistoryItem {
  character: Phaser.GameObjects.Image;
  position: Position;
  mainAzimuth: number;
  subAzimuth: number;
  timestamp: string;
}

export interface GridConfig {
  gridSize: number;
  gridWidth: number;
  gridHeight: number;
  hexRadius: number;
  hexWidth: number;
  hexHeight: number;
  marginLeft: number;
  marginTop: number;
}

export interface CharacterState {
  positions: Map<Phaser.GameObjects.Image, Position>;
  ids: Map<Phaser.GameObjects.Image, string>;
  directions: Map<Phaser.GameObjects.Image, TriggerDirection>;
  actionPoints: Map<Phaser.GameObjects.Image, number>;
  actionCompletedTexts: Map<Phaser.GameObjects.Image, Phaser.GameObjects.Text>;
  combatStats: Map<Phaser.GameObjects.Image, CombatStats>;
  triggerStats: Map<Phaser.GameObjects.Image, { main: TriggerStats; sub: TriggerStats; }>;
}

export interface TriggerState {
  settingMode: boolean;
  settingType: "main" | "sub" | null;
  fan: Phaser.GameObjects.Graphics | null;
  isDragging: boolean;
  currentAngle: number;
}

export interface SelectionState {
  selectedCharacter: Phaser.GameObjects.Image | null;
  selectedCharacterPosition: Position | null;
  movableHexes: Phaser.GameObjects.Graphics[];
}

// 戦闘関連の型定義
export interface CombatStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  avoid: number;
  trion: number;
  isStunned: boolean;
  stunEndTime: number;
}

export interface TriggerStats {
  trionEffect: number;
  defense: number;
  avoid: number;
}

export interface TriggerArea {
  character: Phaser.GameObjects.Image;
  triggerType: "main" | "sub";
  centerPosition: Position;
  direction: number;
  radius: number;
  angle: number;
}

/** マッチ成立後のフィールド情報型定義 */
export interface MatchmakingResult {
  fieldView: boolean[][];
}

/** ステップごとの実行結果 */
export interface CombatStepResult {
  stepNumber: number;
  fieldView: boolean[][];
  stepCharacterResult: StepCharacterResult[];
  winnerId: string | null;
}

/** ステップ内のキャラクターごとの実行結果 */
export interface StepCharacterResult {
  playerId: string;
  characterId: string;
  characterStatus: CharacterStatus;
  position: Position;
  mainTriggerDirection: number;
  subTriggerDirection: number;
  mainTriggerHP: number;
  subTriggerHP: number;
  guardCount: number;
  avoidCount: number;
  isDefeat: boolean;
  /** 当キャラクターに攻撃したキャラクターのID配列 */
  attackerCharacterIds: string[];
  /** 敵のプレイヤーに視認されているか */
  isSeenByEnemy: boolean;
}

/** キャラクターのステータス */
export interface CharacterStatus {
  main: string;
  sub: string;
  activeCount: number;
  trion: number;
  attack: number;
  defense: number;
  avoid: number;
  support: number;
  technique: number;
}