/**
 * 対戦結果の種類。
 */
export type GameResult = "win" | "lose" | "draw" | "inProgress";

/**
 * システム側からみたゲーム状態
 * "inProgress": ゲーム進行中、"completed": ゲーム終了（勝敗確定）
 */
export type GameState = "inProgress" | "completed";