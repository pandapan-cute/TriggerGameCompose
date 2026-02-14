'use client';
import { useEffect, useRef, useState } from "react";
import GridLeftNav from "@/components/nav/GridLeftNav";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useRouter } from "next/navigation";
import { Action } from "./models/Action";
import { GridCellsScene } from "./phaser/scenes/GridCellsScene";


/**
 * PhaserゲームのReactコンポーネント
 * SSR（Server-Side Rendering）対応のため、動的インポートを使用
 */
const GameGrid = () => {

  // PhaserゲームインスタンスのRef（型安全性のため動的インポートの型を使用）
  const gameRef = useRef<import("phaser").Game | null>(null);

  // ゲームを表示するDOMコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);

  // 選択されたキャラクターのIDを管理するステート
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  );

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
    fieldView,
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

  // マッチング結果をPhaser側に通知
  // useEffect(() => {
  //   executeActionsEmitter.dispatchEvent(
  //     new CustomEvent("matchmaking_result", {
  //       detail: {
  //         fieldView: fieldView,
  //       },
  //     })
  //   );
  // }, [fieldView]);

  // 全行動完了イベントを監視してWebSocketで送信
  useEffect(() => {
    const handleAllActionsCompleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { actionHistory, timestamp } = customEvent.detail;

      if (isConnected && playerId && gameId) {
        const messageData = {
          action: "turnExecution" as const,
          playerId: playerId,
          gameId: gameId,
          steps: actionHistory,
        };

        console.log("WebSocketでサーバーに行動履歴を送信:", messageData);
        sendMessage(messageData);

        // UI に送信完了を表示
        console.log("✅ 行動履歴の送信が完了しました！");
      } else {
        console.error(
          "WebSocket接続がないか、プレイヤーID/マッチIDが不足しています:",
          {
            isConnected,
            playerId,
            gameId,
          }
        );
      }
    };

    allActionsCompletedEmitter.addEventListener(
      "allActionsCompleted",
      handleAllActionsCompleted
    );

    return () => {
      allActionsCompletedEmitter.removeEventListener(
        "allActionsCompleted",
        handleAllActionsCompleted
      );
    };
  }, [playerId, gameId, sendMessage, currentTurn]);

  // 敵側のアクションを受信してユニット行動モードに移行
  useEffect(() => {
    const handleTurnResultSubmitted = (data: WebSocketResponseType) => {
      if (data.action === "turnExecutionResult") {
        console.log("ターン戦闘結果のアクションを受信:", data);
        setCurrentTurn(data.turnNumber || 1);
        setGameMode("action");

        // ユニット行動開始をPhaser側に通知
        executeActionsEmitter.dispatchEvent(
          new CustomEvent("executeAllActions", {
            detail: {
              turnCompleteResult: data.result,
              playerId: playerId,
              turnNumber: data.turnNumber,
            },
          })
        );
      }
    };

    // WebSocketメッセージリスナーを追加
    addMessageListener("turnExecutionResult", handleTurnResultSubmitted);

    return () => {
      removeMessageListener("turnExecutionResult", handleTurnResultSubmitted);
    };
  }, [addMessageListener, removeMessageListener]);

  const router = useRouter();

  // 対戦終了関連のWebSocketメッセージ処理
  useEffect(() => {
    const handleCancelMatchingResult = (data: WebSocketResponseType) => {
      if (data.action === "cancelMatchingResult") {
        console.log("対戦終了結果を受信:", data);
        console.log("対戦が正常に終了されました。ホーム画面に戻ります。");
        router.push("/");
      }
    };

    // const handleOpponentCancelledMatch = (data: CancelGameResponse) => {
    //   if (data.action === "opponentCancelledMatch") {
    //     console.log("相手が対戦を終了しました:", data);
    //     alert(
    //       data.message || "相手が対戦を終了しました。ホーム画面に戻ります。"
    //     );
    //     navigate("/", { replace: true });
    //   }
    // };

    // WebSocketメッセージリスナーを追加
    //   addMessageListener("cancelMatchingResult", handleCancelMatchingResult);
    //   addMessageListener(
    //     "opponentCancelledMatch",
    //     handleOpponentCancelledMatch
    //   );

    return () => {
      removeMessageListener(
        "cancelMatchingResult",
        handleCancelMatchingResult
      );
      // removeMessageListener(
      //   "opponentCancelledMatch",
      //   handleOpponentCancelledMatch
      // );
    };
  }, [addMessageListener, removeMessageListener, router]);
  // 行動実行完了の処理
  useEffect(() => {
    const handleActionExecutionCompleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("行動実行完了:", customEvent.detail.message);

      // 設定モードに戻る
      setGameMode("setup");

      setCurrentTurn(customEvent.detail.turnNumber + 1);

      console.log(
        "新しいターンを開始します - ターン",
        customEvent.detail.turnNumber + 1
      );
    };

    actionExecutionCompletedEmitter.addEventListener(
      "actionExecutionCompleted",
      handleActionExecutionCompleted
    );

    return () => {
      actionExecutionCompletedEmitter.removeEventListener(
        "actionExecutionCompleted",
        handleActionExecutionCompleted
      );
    };
  }, []);

  useEffect(() => {
    // キャラクター選択の変更を監視
    const handleCharacterSelection = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { characterId } = customEvent.detail;
      setSelectedCharacterId(characterId);
    };

    characterSelectionEmitter.addEventListener(
      "characterSelected",
      handleCharacterSelection
    );
    return () => {
      characterSelectionEmitter.removeEventListener(
        "characterSelected",
        handleCharacterSelection
      );
    };
  }, [selectedCharacterId]);

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

        // GridSceneクラスを作成（Phaserオブジェクトを渡す）
        // const GridScene = createGridScene(Phaser, fieldView);

        const GridScene = GridCellsScene;

        // Phaserゲームの設定（画面サイズに合わせて調整）
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO, // 自動的にWebGLまたはCanvasを選択
          width: window.innerWidth, // 画面幅に合わせて調整（余白を考慮）
          height: window.innerHeight, // 画面高さに合わせて調整（余白を考慮）
          backgroundColor: "#ffffff", // 背景色（真っ白）
          parent: containerRef.current, // ゲームを表示するDOM要素
          scene: GridScene, // 使用するシーン
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
    };
  }, []); // 空の依存配列で初回のみ実行

  return (
    <div className="game-container relative w-full h-screen overflow-hidden">
      {/* 左側ナビゲーション */}
      <GridLeftNav actionHistories={globalActionHistory} />

      {/* ゲームモード表示 */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <div className="text-center">
          <h3 className="font-bold mb-2">
            {gameMode === "setup" ? "動きの設定モード" : "ユニットの行動モード"}
          </h3>
          <p className="text-xs text-gray-300">ターン {currentTurn}</p>
        </div>
      </div>

      {/* 対戦終了ボタン */}
      <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white p-2 rounded-lg shadow-lg text-sm z-50">
        <button
          onClick={handleEndMatch}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors"
        >
          対戦終了
        </button>
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

// グローバルな履歴配列
let globalActionHistory: Action[] = [];

// React側で履歴を表示するためのイベントエミッター
const historyEventEmitter = new EventTarget();

// 選択されたキャラクターをReact側に通知するためのイベントエミッター
const characterSelectionEmitter = new EventTarget();

// 行動力の変更をReact側に通知するためのイベントエミッター
const actionPointsEmitter = new EventTarget();

// 行動力チェック用のイベントエミッター
const allActionsCompletedEmitter = new EventTarget();

// 全ユニット行動実行用のイベントエミッター
export const executeActionsEmitter = new EventTarget();

// 行動完了通知用のイベントエミッター
const actionExecutionCompletedEmitter = new EventTarget();

// 履歴を追加する関数
function addToGlobalHistory(action: Action) {
  globalActionHistory.push(action);
  historyEventEmitter.dispatchEvent(new CustomEvent("historyUpdated"));
}

// 履歴をクリアする関数
function clearGlobalHistory() {
  globalActionHistory = [];
  historyEventEmitter.dispatchEvent(new CustomEvent("historyUpdated"));
}

// 選択されたキャラクターを通知する関数
function notifyCharacterSelection(
  characterId: string | null,
  actionPoints: number = 0
) {
  characterSelectionEmitter.dispatchEvent(
    new CustomEvent("characterSelected", {
      detail: { characterId, actionPoints },
    })
  );
}

export default GameGrid;
