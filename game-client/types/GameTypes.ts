/**
 * 対戦結果の種類。
 */
export type GameResult = "Win" | "Lose" | "Draw" | "InProgress";

/**
 * システム側からみたゲーム状態
 * "InProgress": ゲーム進行中、"Completed": ゲーム終了（勝敗確定）
 */
export type GameState = "InProgress" | "Completed";

/**
 * ゲームの種別
 * "PvP": プレイヤー対プレイヤー、"PvE": プレイヤー対AI
 */
export type GameType = "PvP" | "PvE";