'use client';
import NormalFullDialog from "@/components/dialogs/NormalFullDialog";
import BattleResultPanel from "@/components/panels/BattleResultPanel";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { EnemyUnit } from "@/types/EnemyUnit";
import { FriendUnit } from "@/types/FriendUnit";
import { GameResult } from "@/types/GameTypes";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [fieldSteps, setFieldSteps] = useState<number[][]>([]);
  const [visibility, setVisibility] = useState<boolean[][]>([]);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [motionLabEndTime, setMotionLabEndTime] = useState<Date>(new Date());
  const resultDialogRef = useRef<HTMLDialogElement>(null);

  const checkGameState = (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[]) => {
    if (isConnected && playerId) {
      const aliveFriendUnits = friendUnits.filter(unit => !unit.isBailout);
      const aliveEnemyUnits = enemyUnits.filter(unit => !unit.isBailout);
      if (aliveFriendUnits.length === 0 && aliveEnemyUnits.length === 0) {
        resultDialogRef.current?.showModal();
        setGameResult("draw");
      } else if (aliveFriendUnits.length === 0) {
        resultDialogRef.current?.showModal();
        setGameResult("lose");
      } else if (aliveEnemyUnits.length === 0) {
        resultDialogRef.current?.showModal();
        setGameResult("win");
      }
    }
  };

  useEffect(() => {
    const handleGameStateResult = (data: WebSocketResponseType) => {
      if (data.action === "getGameStateResult") {
        console.log("ゲーム状態を受信:", data);
        setFriendUnits(data.friendUnits);
        setEnemyUnits(data.enemyUnits);
        setFieldSteps(data.fieldSteps);
        setVisibility(data.visibility);
        setCurrentTurn(data.currentTurnNumber);
        setMotionLabEndTime(new Date(data.motionLabEndTime));
        checkGameState(data.friendUnits, data.enemyUnits);
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
  }, [isConnected, playerId, gameId, sendMessage, gameResult]);
  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <NormalFullDialog ref={resultDialogRef}>
        {gameResult && (
          <BattleResultPanel
            friendUnits={friendUnits}
            enemyUnits={enemyUnits}
            result={gameResult}
            turn={currentTurn}
          />
        )}
      </NormalFullDialog>
      {/* ゲーム画面 */}
      {friendUnits.length > 0 && enemyUnits.length > 0 && (
        <div className="w-full h-full">
          <GameGrid friendUnits={friendUnits} enemyUnits={enemyUnits} fieldSteps={fieldSteps} visibility={visibility} motionLabEndTime={motionLabEndTime} setGameResult={setGameResult} />
        </div>
      )}
    </div>
  );
}
