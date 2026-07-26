'use client';
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
import MotionLabDialog, { MotionLabDialogHandle } from "@/components/dialogs/MotionMode/MotionLabDialog";
import MotionExecuteDialog, { MotionExecuteDialogHandle } from "@/components/dialogs/MotionMode/MotionExecuteDialog";
import LoadingDialog from "@/components/dialogs/Loading";
import TurnStateMotionLabPanel from "@/components/panels/TurnStatePanel/MotionLab";
import TurnStateMotionExecutePanel from "@/components/panels/TurnStatePanel/MotionExecute";
import { MAX_TURN } from "./config/game-config";
import { SkyOutlineButton } from "@/components/buttons/sky-outline";
import { ThreeDGridCellsScene } from "./3d-version/scenes/ThreeDGridCellsScene";
import { enable3d } from "@enable3d/phaser-extension/dist/enable3d";
import { Canvas } from "@enable3d/common/dist/customCanvas";

interface GameGridProps {
  currentTurn: number;
  friendUnits: FriendUnit[];
  enemyUnits: EnemyUnit[];
  fieldSteps: number[][];
  visibility: boolean[][];
  motionLabEndTime: Date;
  gameResult: GameResult | null;
  gameDimention: "2D" | "3D";
  setGameResult: (result: GameResult) => void;
  checkGameState: (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[], currentTurn: number) => void;
  setCurrentTurn: (turn: number) => void;
}

/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid: React.FC<GameGridProps> = ({ currentTurn, friendUnits, enemyUnits, fieldSteps, visibility, motionLabEndTime, gameResult, gameDimention = "3D", setGameResult, checkGameState, setCurrentTurn }) => {

  // PhaserゲームインスタンスのRef（型安全性のため動的インポートの型を使用）
  const gameRef = useRef<import("phaser").Game | null>(null);
  const gridSceneRef = useRef<GridCellsScene | null>(null);

  // ゲームを表示するDOMコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);

  // ゲームモードの状態管理
  const [gameMode, setGameMode] = useState<"lab" | "execute">("lab");
  const [motionLabEndTimeState, setMotionLabEndTimeState] = useState<Date>(motionLabEndTime);
  const [motionExecuteEndTimeState, setMotionExecuteEndTimeState] = useState<Date>(motionLabEndTime);
  const [isSendingMotionLabTurn, setIsSendingMotionLabTurn] = useState(false);
  const motionLabDialogRef = useRef<MotionLabDialogHandle>(null);
  const motionExecuteDialogRef = useRef<MotionExecuteDialogHandle>(null);
  const isMotionLabTurnSendDisabled = isSendingMotionLabTurn || gameMode !== "lab";

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
    if (isConnected && playerId && gameId && gameResult === "InProgress") {
      setIsSendingMotionLabTurn(true);
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
  const handleCompleteGame = (friendUnits: FriendUnit[], enemyUnits: EnemyUnit[], result: GameResult) => {
    console.log("ゲーム終了処理を実行します。結果:", result);
    setGameResult(result);
    checkGameState(friendUnits, enemyUnits, currentTurn);
  };

  /** ユニットの行動終了処理 */
  const handleFinishMotionExecute = (turnNumber: number) => {
    console.log("ユニットの行動終了処理を実行します。,現在のターン状態:", currentTurn);
    if (currentTurn < MAX_TURN) {
      // 次のターンの動きの設定フェーズへ移行
      setCurrentTurn(turnNumber + 1);
      setGameMode("lab");
      motionLabDialogRef.current?.show();
    }
  };

  // WebSocketでターン実行結果を受信したときの処理
  useEffect(() => {
    /** ターンの実行 */
    const handleTurnResultSubmitted = (data: WebSocketResponseType) => {
      if (data.action === "turnExecutionResult") {
        setIsSendingMotionLabTurn(false);

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
        targetScene.executeTurn(hydratedTurn, new Date(data.motionLabEndTime)); // Phaserシーンにターン情報を渡して実行
        setGameMode("execute");
        motionExecuteDialogRef.current?.show();
        setMotionExecuteEndTimeState(new Date(Date.now() + 15000 + 2000)); // 動きの実行時間（15秒）＋αを設定
        setMotionLabEndTimeState(new Date(data.motionLabEndTime));
      }
    };

    /** 対戦終了結果の処理 */
    const handleCancelMatchingResult = (data: WebSocketResponseType) => {
      if (data.action === "cancelMatchingResult") {
        setIsSendingMotionLabTurn(false);
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

  const onRenderEffectEvent = useEffectEvent(() => {
    // DOM要素が存在しない場合は何もしない
    if (!containerRef.current) return;

    // 既にゲームインスタンスが存在する場合は何もしない
    if (gameRef.current) return;

    let cancelled = false;

    /**
     * Phaserライブラリを動的に読み込む関数
     * SSR時にwindowオブジェクトが存在しないため、クライアント側でのみ実行
     */
    const loadPhaser = async () => {
      try {
        // Phaserライブラリを動的にインポート
        const Phaser = await import("phaser");


        if (cancelled || !containerRef.current || gameRef.current) return;

        if (gameDimention === "2D") {
          // 2Dの場合の設定
          const gridScene = new GridCellsScene(motionLabEndTime, friendUnits, enemyUnits, fieldSteps, visibility, handleTurnExecution, handleCompleteGame, handleFinishMotionExecute);
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
        } else if (gameDimention === "3D") {
          // 3Dの場合の設定
          const gridScene = new ThreeDGridCellsScene(motionLabEndTime, friendUnits, enemyUnits, fieldSteps, visibility, handleTurnExecution, handleCompleteGame, handleFinishMotionExecute);
          gridSceneRef.current = gridScene;

          // Phaserゲームの設定（画面サイズに合わせて調整）
          const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.WEBGL, // WebGLを選択
            transparent: true, // 背景を透明にするかどうか
            scale: {
              mode: Phaser.Scale.FIT, // 画面サイズに合わせてスケーリング
              autoCenter: Phaser.Scale.CENTER_BOTH, // 画面中央に配置
            },
            width: window.innerWidth, // 画面幅に合わせて調整（余白を考慮）
            height: window.innerHeight, // 画面高さに合わせて調整（余白を考慮）
            backgroundColor: "#ffffff", // 背景色（真っ白）
            parent: containerRef.current, // ゲームを表示するDOM要素
            scene: gridScene, // 使用するシーン
            ...Canvas(),
          };

          enable3d(() => {
            if (cancelled || gameRef.current) return;

            // Ammo物理の初期化後に Phaser.Game を作成する
            gameRef.current = new Phaser.Game(config);
          }).withPhysics('/lib/ammo');
        }
      } catch (error) {
        console.error("Phaserの読み込みに失敗しました:", error);
      }
    };

    // Phaser読み込みを実行
    loadPhaser();

    // 動きの設定の開始
    if (gameResult === "InProgress") {
      motionLabDialogRef.current?.show();
    }

    // コンポーネントのクリーンアップ関数
    return () => {
      cancelled = true;
      if (gameRef.current) {
        gameRef.current.destroy(true); // Phaserゲームインスタンスを破棄
        gameRef.current = null;
      }
      gridSceneRef.current = null;
    };
  });

  useEffect(() => {
    const cleanup = onRenderEffectEvent();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, []);  // 空の依存配列で初回のみ実行

  /**
   * 動きの設定を途中送信する
   */
  const handleSendMotionLabTurn = () => {
    if (isMotionLabTurnSendDisabled) {
      return;
    }

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

    setIsSendingMotionLabTurn(true);
    targetScene.sendServerTurnManual();
  };

  return (
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* 左側ナビゲーション */}
      <GridLeftNav />

      {/* ゲームモード表示 */}
      <div className="absolute top-2 right-2 p-2 z-50 flex flex-row items-start gap-2">
        <SkyOutlineButton
          href="#"
          onClick={handleSendMotionLabTurn}
          className={`text-sm text-center ${isMotionLabTurnSendDisabled ? "pointer-events-none opacity-50" : ""}`}
        >
          動きの設定を送信<br />MotionLab Ready !
        </SkyOutlineButton>
        {gameMode === "lab" ? (
          <TurnStateMotionLabPanel turn={currentTurn} endtime={motionLabEndTimeState} maxTurn={MAX_TURN} />
        ) : (
          <TurnStateMotionExecutePanel turn={currentTurn} endtime={motionExecuteEndTimeState} maxTurn={MAX_TURN} />
        )}
      </div>

      {/* Phaserゲームが表示されるコンテナ */}
      <div
        ref={containerRef}
        className="w-full h-full border border-gray-300 rounded-lg overflow-hidden"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
      />

      {/* 動きの設定とユニットの行動のダイアログ表示 */}
      <MotionLabDialog ref={motionLabDialogRef} turn={currentTurn}></MotionLabDialog>
      <MotionExecuteDialog ref={motionExecuteDialogRef} turn={currentTurn}></MotionExecuteDialog>
      <LoadingDialog message="Waiting..." isOpen={isSendingMotionLabTurn} />
    </div>
  );
};

export default GameGrid;
