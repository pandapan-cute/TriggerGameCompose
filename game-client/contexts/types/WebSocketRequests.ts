/**
 * マッチメイキングリクエストの型定義
 */
interface MatchMakingRequest {
  action: "matchmaking";
  playerId: string;
  units:
  Array<{
    unitTypeId: string;
    initialX: number;
    initialY: number;
    usingMainTriggerId: string;
    usingSubTriggerId: string;
    mainTriggerIds: string[];
    subTriggerIds: string[];
  }>;
}

/** WebSocketリクエストの型 */
export type WebSocketRequestType = MatchMakingRequest;
