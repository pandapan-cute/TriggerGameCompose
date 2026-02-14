import { EnemyUnit } from "@/game-logics/models/EnemyUnit";
import { FriendUnit } from "@/game-logics/models/FriendUnit";
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

/**
 * ゲーム状態取得レスポンスの型定義
 */
export interface GetGameStateResponse {
  action: "getGameStateResult";
  enemyUnits: EnemyUnit[];
  friendUnits: FriendUnit[];
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
export type WebSocketResponseType = MatchmakingResponse | GetGameStateResponse | TurnActionsResponse | CancelGameResponse | ErrorResponse;