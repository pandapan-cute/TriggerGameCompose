import { TurnCompleteResult } from "@/game-logics/types";
import { MatchingStatus } from "@/types/MatchingTypes";

/**
 * マッチメイキングレスポンスの型定義
 */
export interface MatchmakingResponse {
  action: "matchmakingResult";
  status: MatchingStatus;
  gameId?: string;
}

/** ターンの実行結果を受信 */
export interface TurnActionsResponse {
  action: "turnExecutionResult";
  turnNumber: number;
  result: TurnCompleteResult;
}

/** ゲームのキャンセルを受信 */
export interface CancelGameResponse {
  action: "cancelMatchingResult";
  playerId: string;
}


/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  action: "error";
  message: string;
}

/** WebSocketレスポンスの型 */
export type WebSocketResponseType = MatchmakingResponse | TurnActionsResponse | CancelGameResponse | ErrorResponse;