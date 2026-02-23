'use client';
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { EnemyUnit } from "@/game-logics/models/EnemyUnit";
import { FriendUnit } from "@/game-logics/models/FriendUnit";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const GameGrid = dynamic(() => import("@/game-logics/GameGrid"), {
  // フロント側で500が出るため、SSRを無効化
  ssr: false,
});

export interface GridConfig {
  gridSize: number;
  gridWidth: number;
  gridHeight: number;
  hexRadius: number;
  hexWidth: number;
  hexHeight: number;
  marginLeft: number;
  marginTop: number;
}

export default function GamePage() {
  // WebSocketコンテキストを使用
  const { isConnected, playerId, setGameId, connect, sendMessage, addMessageListener, removeMessageListener } = useWebSocket();

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

  // URLパラメータを取得
  const params = useParams();
  const gameId = params.gameId as string;

  // WebSocketの接続状態が変わったら接続を確立する
  useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  // 接続確立後、ゲーム状態をリクエスト
  useEffect(() => {
    if (isConnected && playerId && gameId) {
      setGameId(gameId);
      sendMessage({
        action: "getGameState",
        playerId: playerId,
        gameId: gameId,
      });
    }
  }, [isConnected, playerId, gameId, sendMessage]);
  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* ゲーム画面 */}
      {friendUnits.length > 0 && enemyUnits.length > 0 && (
        <div className="w-full h-full">
          <GameGrid friendUnits={friendUnits} enemyUnits={enemyUnits} />
        </div>
      )}
    </div>
  );
}
