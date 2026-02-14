import { Step } from "@/game-logics/models/Step";


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

/** ターンの行動決定時に送信するリクエストの型定義 */
interface TurnActionsRequest {
  action: "turnExecution";
  playerId: string;
  gameId: string;
  steps: Step[];
};

/** ゲームのキャンセル時に送信するリクエストの型定義 */
interface CancelGameRequest {
  action: "cancelMatching";
  playerId: string;
}

/** WebSocketリクエストの型 */
export type WebSocketRequestType = MatchMakingRequest | TurnActionsRequest | CancelGameRequest;