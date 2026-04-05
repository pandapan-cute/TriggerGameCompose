import { useWebSocket } from "@/contexts/WebSocketContext";
import BattleResultPanel from "./view";
import { useEffect, useState } from "react";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { FriendUnit } from "@/types/FriendUnit";
import { EnemyUnit } from "@/types/EnemyUnit";
import { GameResult } from "@/types/GameTypes";

/** ゲーム結果表示に必要な情報 */
interface BattleResultPanelContainerProps {
  result: GameResult;
  turn: number;
}

/** ゲーム結果表示パネルのコンテナコンポーネント */
export default function BattleResultPanelContainer({ result, turn }: BattleResultPanelContainerProps) {
  const { sendMessage, addMessageListener, removeMessageListener, isConnected, playerId, gameId } = useWebSocket();

  // 接続確立後、ゲーム状態をリクエスト
  useEffect(() => {
    if (isConnected && playerId && gameId) {
      sendMessage({
        action: "getGameState",
        playerId: playerId,
        gameId: gameId,
      });
    }
  }, [isConnected, playerId, gameId, sendMessage]);

  const [friendUnits, setFriendUnits] = useState<FriendUnit[]>([]);
  const [enemyUnits, setEnemyUnits] = useState<EnemyUnit[]>([]);

  useEffect(() => {
    const handleGameStateResult = (data: WebSocketResponseType) => {
      if (data.action === "getGameStateResult") {
        console.log("ゲーム状態を受信:", data);
        setFriendUnits(data.friendUnits);
        setEnemyUnits(data.enemyUnits);
      }
    };

    addMessageListener("getGameStateResult", handleGameStateResult);

    return () => {
      // クリーンアップでリスナーを削除
      removeMessageListener("getGameStateResult", handleGameStateResult);
    };
  }, [addMessageListener, removeMessageListener]);

  return (
    <>
      <BattleResultPanel friendUnits={friendUnits} enemyUnits={enemyUnits} turn={turn} result={result} />
    </>
  );
}