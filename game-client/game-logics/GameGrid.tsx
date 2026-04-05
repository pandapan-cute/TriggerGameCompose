'use client';
import { useEffect, useRef, useState } from "react";
import GridLeftNav from "@/components/nav/GridLeftNav";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useRouter } from "next/navigation";
import { GridCellsScene } from "./phaser/scenes/GridCellsScene";
import { FriendUnit } from "../types/FriendUnit";
import { EnemyUnit } from "../types/EnemyUnit";
import { Step } from "./models/Step";
import { Turn } from "./models/Turn";
import { GameResult } from "@/types/GameTypes";

interface GameGridProps {
  friendUnits: FriendUnit[];
  enemyUnits: EnemyUnit[];
  fieldSteps: number[][];
  visibility: boolean[][];
  setGameResult: (result: GameResult) => void;
}

/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid: React.FC<GameGridProps> = ({ friendUnits, enemyUnits, fieldSteps, visibility, setGameResult }) => {

  // PhaserゲームインスタンスのRef（型安全性のため動的インポートの型を使用）
  const gameRef = useRef<import("phaser").Game | null>(null);
  const gridSceneRef = useRef<GridCellsScene | null>(null);

  // ゲームを表示するDOMコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);
  const resultDialogRef = useRef<HTMLDialogElement>(null);

  // ゲームモードの状態管理
  const [gameMode, setGameMode] = useState<"setup" | "action">("setup");
  const [currentTurn, setCurrentTurn] = useState<number>(1);

  // WebSocketコンテキストを使用
  const {
    isConnected,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    playerId,
    gameId,
    connect,
  } = useWebSocket();


  // 対戦終了処理
  const handleEndMatch = () => {
    if (isConnected && playerId) {
      const messageData = {
        action: "cancelMatching" as const,
        playerId: playerId,
      };
      console.log("対戦終了メッセージを送信:", messageData);
      sendMessage(messageData);
    } else {
      console.error("WebSocket接続がないか、プレイヤーIDが不足しています");
    }
  };

  // WebSocket接続とゲームIDの初期化
  useEffect(() => {
    // ゲームIDを取得（URLパラメータから）

    // 接続していない場合は接続を開始
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  const router = useRouter();

  /** ターン情報の送信 */
  const handleTurnExecution = (steps: Step[]) => {
    console.log("Phaserからターン情報を受け取りました:", steps, isConnected, playerId, gameId);
    if (isConnected && playerId && gameId) {
      const messageData = {
        action: "turnExecution" as const,
        playerId,
        gameId,
        steps,
      };
      // WebSocketでサーバーに送信
      sendMessage(messageData);
    }
  };

  /** ゲーム終了処理 */
  const handleCompleteGame = (result: GameResult) => {
    console.log("ゲーム終了処理を実行します。結果:", result);
    setGameResult(result);
  };

  // WebSocketでターン実行結果を受信したときの処理
  useEffect(() => {
    /** ターンの実行 */
    const handleTurnResultSubmitted = (data: WebSocketResponseType) => {
      if (data.action === "turnExecutionResult") {
        let activeScene: GridCellsScene | null = null;
        if (gameRef.current) {
          try {
            activeScene = gameRef.current.scene.getScene("GridScene") as GridCellsScene;
          } catch {
            activeScene = null;
          }
        }

        const targetScene = activeScene ?? gridSceneRef.current;
        if (!targetScene) {
          console.warn("GridSceneが未初期化のためturnExecutionResultを処理できません");
          return;
        }

        const hydratedTurn = Turn.fromJSON(data.turn);
        targetScene.executeTurn(hydratedTurn); // Phaserシーンにターン情報を渡して実行
        setGameMode("action");
        setCurrentTurn(data.turn.getTurnNumber());
      }
    };

    /** 対戦終了結果の処理 */
    const handleCancelMatchingResult = (data: WebSocketResponseType) => {
      if (data.action === "cancelMatchingResult") {
        console.log("対戦終了結果を受信:", data);
        console.log("対戦が正常に終了されました。ホーム画面に戻ります。");
        router.push("/");
      }
    };

    addMessageListener("turnExecutionResult", handleTurnResultSubmitted);
    addMessageListener("cancelMatchingResult", handleCancelMatchingResult);

    return () => {
      removeMessageListener("turnExecutionResult", handleTurnResultSubmitted);
      removeMessageListener("cancelMatchingResult", handleCancelMatchingResult);
    };
  }, [addMessageListener, removeMessageListener, router]);

  useEffect(() => {
    // DOM要素が存在しない場合は何もしない
    if (!containerRef.current) return;

    // 既にゲームインスタンスが存在する場合は何もしない
    if (gameRef.current) return;

    /**
     * Phaserライブラリを動的に読み込む関数
     * SSR時にwindowオブジェクトが存在しないため、クライアント側でのみ実行
     */
    const loadPhaser = async () => {
      try {
        // Phaserライブラリを動的にインポート
        const Phaser = await import("phaser");

        const gridScene = new GridCellsScene(friendUnits, enemyUnits, fieldSteps, visibility, handleTurnExecution, handleCompleteGame);
        gridSceneRef.current = gridScene;

        // Phaserゲームの設定（画面サイズに合わせて調整）
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO, // 自動的にWebGLまたはCanvasを選択
          width: window.innerWidth, // 画面幅に合わせて調整（余白を考慮）
          height: window.innerHeight, // 画面高さに合わせて調整（余白を考慮）
          backgroundColor: "#ffffff", // 背景色（真っ白）
          parent: containerRef.current, // ゲームを表示するDOM要素
          scene: gridScene, // 使用するシーン
          physics: {
            default: "arcade", // 物理エンジン（今回は使用しないがデフォルト設定）
            arcade: {
              gravity: { y: 0, x: 0 }, // 重力なし
              debug: false, // デバッグ表示なし
            },
          },
        };

        // 二重チェック：再度ゲームインスタンスが存在しないことを確認
        if (!gameRef.current) {
          // Phaserゲームインスタンスを作成
          gameRef.current = new Phaser.Game(config);
        }
      } catch (error) {
        console.error("Phaserの読み込みに失敗しました:", error);
      }
    };

    // Phaser読み込みを実行
    loadPhaser();

    // コンポーネントのクリーンアップ関数
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true); // Phaserゲームインスタンスを破棄
        gameRef.current = null;
      }
      gridSceneRef.current = null;
    };
  }, []); // 空の依存配列で初回のみ実行

  return (
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* 左側ナビゲーション */}
      <GridLeftNav />

      {/* ゲームモード表示 */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <div className="text-center">
          <h3 className="font-bold mb-2">
            {gameMode === "setup" ? "動きの設定モード" : "ユニットの行動モード"}
          </h3>
          <p className="text-xs text-gray-300">ターン {currentTurn}</p>
        </div>
      </div>

      {/* Phaserゲームが表示されるコンテナ */}
      <div
        ref={containerRef}
        className="w-full h-full border border-gray-300 rounded-lg overflow-hidden"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
      />
    </div>
  );
};

export default GameGrid;
