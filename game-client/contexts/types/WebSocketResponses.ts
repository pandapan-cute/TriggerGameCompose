import { FriendUnit } from "@/types/FriendUnit";
import { Turn } from "@/game-logics/models/Turn";
import { MatchingStatus } from "@/types/MatchingTypes";
import { EnemyUnit } from "@/types/EnemyUnit";
import { GameResult, GameState } from "@/types/GameTypes";

/**
 * マッチメイキングレスポンスの型定義
 */
export interface MatchmakingResponse {
  action: "matchmakingResult";
  status: MatchingStatus;
  gameId?: string;
  motionLabEndTime?: string;
}

/**
 * ゲーム状態取得レスポンスの型定義
 */
export interface GetGameStateResponse {
  action: "getGameStateResult";
  gameState: GameState;
  enemyUnits: EnemyUnit[];
  friendUnits: FriendUnit[];
  fieldSteps: number[][];
  visibility: boolean[][];
  currentTurnNumber: number;
  motionLabEndTime: string;
}


/**
 * ゲーム結果通知レスポンスの型定義
 */
export interface NotifyGameStateResponse {
  action: "notifyGameState";
  gameId: string;
  message: string;
  state: GameState;
  outcome: GameResult;
}


/** ターンの実行結果を受信 */
export interface TurnActionsResponse {
  action: "turnExecutionResult";
  turn: Turn;
  motionLabEndTime: string;
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
export type WebSocketResponseType = MatchmakingResponse | GetGameStateResponse | TurnActionsResponse | CancelGameResponse | NotifyGameStateResponse | ErrorResponse;