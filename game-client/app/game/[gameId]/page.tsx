'use client';
import NormalFullDialog from "@/components/dialogs/NormalFullDialog";
import BattleResultPanel from "@/components/panels/BattleResultPanel";
import RotateView from "@/components/views/RotateView";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { MAX_TURN } from "@/game-logics/config/game-config";
import { EnemyUnit } from "@/types/EnemyUnit";
import { FriendUnit } from "@/types/FriendUnit";
import { GameResult, GameState } from "@/types/GameTypes";
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
  const [gameResult, setGameResult] = useState<GameResult>("InProgress");
  const [gameResultMsg, setGameResultMsg] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [motionLabEndTime, setMotionLabEndTime] = useState<Date>(new Date());
  const resultDialogRef = useRef<HTMLDialogElement>(null);

  const checkGameState = (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[], currentTurn: number, gameState?: GameState) => {
    if (isConnected && playerId) {
      setFriendUnits(friendUnits);
      setEnemyUnits(enemyUnits);
      const aliveFriendUnits = friendUnits.filter(unit => !unit.isBailout);
      const aliveEnemyUnits = enemyUnits.filter(unit => !unit.isBailout);
      if (aliveFriendUnits.length === 0 && aliveEnemyUnits.length === 0) {
        setGameResult("Draw");
      } else if (aliveFriendUnits.length === 0) {
        setGameResult("Lose");
      } else if (aliveEnemyUnits.length === 0) {
        setGameResult("Win");
      } else if (currentTurn >= MAX_TURN || gameState === "Completed") {
        console.log("最大ターン数に到達: 引き分け");
        setGameResult("Draw");
      }
    }
  };

  useEffect(() => {
    // ゲーム終了の検知
    if (gameResult !== "InProgress") {
      console.log("ゲーム状態が変更されました:", gameResult);
      resultDialogRef.current?.showModal();
    }
  }, [gameResult]);

  useEffect(() => {
    /** ゲーム状態の受信処理 */
    const handleGameStateResult = (data: WebSocketResponseType) => {
      if (data.action === "getGameStateResult") {
        console.log("ゲーム状態を受信:", data);
        if (data.gameState === "InProgress") {
          setGameResult("InProgress");
        }
        setFriendUnits(data.friendUnits);
        setEnemyUnits(data.enemyUnits);
        setFieldSteps(data.fieldSteps);
        setVisibility(data.visibility);
        setCurrentTurn(data.currentTurnNumber);
        setMotionLabEndTime(new Date(data.motionLabEndTime));
        checkGameState(data.friendUnits, data.enemyUnits, data.currentTurnNumber, data.gameState);
      }
    };
    addMessageListener("getGameStateResult", handleGameStateResult);

    /** ゲーム結果の通知受信 */
    const handleNotifyGameState = (data: WebSocketResponseType) => {
      if (data.action === "notifyGameState") {
        console.log("ゲーム結果を受信:", data);
        if (data.state === "Completed" && data.gameId === gameId) {
          // ゲーム終了の通知を受け取った場合、結果を設定してダイアログを表示する
          setGameResult(data.outcome);
          setGameResultMsg(data.message || null);
          resultDialogRef.current?.showModal();
        }
      }
    };
    addMessageListener("notifyGameState", handleNotifyGameState);

    return () => {
      // クリーンアップでリスナーを削除
      removeMessageListener("getGameStateResult", handleGameStateResult);
      removeMessageListener("notifyGameState", handleNotifyGameState);
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
      {/* 画面回転を推奨するコンポーネント */}
      <RotateView />

      <NormalFullDialog ref={resultDialogRef}>
        <BattleResultPanel
          friendUnits={friendUnits}
          enemyUnits={enemyUnits}
          result={gameResult}
          turn={currentTurn}
          message={gameResultMsg}
        />
      </NormalFullDialog>
      {/* ゲーム画面 */}
      {friendUnits.length > 0 && enemyUnits.length > 0 && gameResult === "InProgress" && (
        <div className="w-full h-full">
          <GameGrid currentTurn={currentTurn} friendUnits={friendUnits} enemyUnits={enemyUnits} fieldSteps={fieldSteps} visibility={visibility} motionLabEndTime={motionLabEndTime} gameResult={gameResult} setGameResult={setGameResult} checkGameState={checkGameState} setCurrentTurn={setCurrentTurn} />
        </div>
      )}
    </div>
  );
}
