// 自分のキャラクター（底辺行）を配置
export const playerPositions = [
  { col: 4, row: 34 },
  { col: 12, row: 34 },
  { col: 20, row: 34 },
  { col: 28, row: 34 },
];

export const playerCharacterKeys = [
  "MIKUMO_OSAMU",
  "KUGA_YUMA",
  "AMATORI_CHIKA",
  "HYUSE_KURONIN",
];

/**
 * ユニット種別のEnum定義
 */
export enum UnitType {
  MIKUMO_OSAMU = "MIKUMO_OSAMU",
  KUGA_YUMA = "KUGA_YUMA",
  AMATORI_CHIKA = "AMATORI_CHIKA",
  HYUSE_KURONIN = "HYUSE_KURONIN",
  UNKNOWN = "UNKNOWN", // 敵のユニット種別が不明な場合のデフォルト値
}