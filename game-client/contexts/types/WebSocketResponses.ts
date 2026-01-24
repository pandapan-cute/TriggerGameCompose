import { MatchingStatus } from "@/types/MatchingTypes";

/**
 * マッチメイキングレスポンスの型定義
 */
export interface MatchmakingResponse {
  action: "matchmakingResult";
  status: MatchingStatus;
}

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  action: "error";
  message: string;
}

/** WebSocketレスポンスの型 */
export type WebSocketResponseType = MatchmakingResponse | ErrorResponse;