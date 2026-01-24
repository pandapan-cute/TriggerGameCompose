/**
 * マッチメイキングリクエストの型定義
 */
interface MatchMakingRequest {
  action: "matchmaking";
  playerId: string;
}

/** WebSocketリクエストの型 */
export type WebSocketRequestType = MatchMakingRequest;
