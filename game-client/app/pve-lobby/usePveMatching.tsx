"use client";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import useDeviceOrientation from "@/hooks/device/useDeviceOrientation";
import { MatchingStatus } from "@/types/MatchingTypes";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

/**
 * PVEマッチング管理用のカスタムフック
 * 
 * モバイル端末で縦画面でマッチング中のとき -> マッチング開始をキャンセルする
 * 接続していないとき -> Websocket接続を開始する
 * 接続中でモバイル縦画面でない、マッチング開始前のとき -> マッチング開始メッセージを送信する
 * マッチング結果の受信 -> ステータスを更新してゲーム画面に遷移
 */
export const usePveMatching = () => {
  const router = useRouter();
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>("NotStarted");

  const {
    isConnected,
    playerId,
    setGameId,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    addConnectionListener,
    removeConnectionListener,
    connect,
  } = useWebSocket();

  // メッセージリスナーの設定
  useEffect(() => {

    const handleMatchingResult = (data: WebSocketResponseType) => {
      if (data.action === "matchmakingResult" && data.status === "Completed") {
        setMatchingStatus("Completed");
        if (data.gameId) {
          setGameId(data.gameId);
        }

        // 3秒後にゲーム画面に遷移
        setTimeout(() => {
          router.push(`/game/${data.gameId}`);
        }, 3000);
      }
    };

    const handleError = (data: WebSocketResponseType) => {
      if (data.action === "error") {
        console.error("マッチングエラー:", data.message);
      }
    };

    // リスナーを追加
    addMessageListener("matchmakingResult", handleMatchingResult);
    addMessageListener("error", handleError);

    return () => {
      // クリーンアップ
      removeMessageListener("matchmakingResult", handleMatchingResult);
      removeMessageListener("error", handleError);
    };
  }, [addMessageListener, removeMessageListener, router, setGameId]);

  // 接続リスナーのクリーンアップ
  useEffect(() => {
    // コンポーネントマウント時に接続を試みる
    if (!isConnected) {
      connect();
    }
  }, [connect, isConnected]);

  // 画面の向きが変わったときの処理
  const { isMobilePortrait } = useDeviceOrientation({
    onOrientationChange: (isMobilePortrait) => {
      console.log("画面の向きが変わりました。isMobilePortrait:", isMobilePortrait);
      if (isMobilePortrait === true && matchingStatus === "InProgress") {
        // モバイル縦画面でマッチング中のときはマッチングをキャンセルする
        handleCancelMatching();
      } else if (isConnected && isMobilePortrait === false && matchingStatus === "NotStarted") {
        // 接続中でモバイル縦画面でない、マッチング開始前のとき
        startMatchmaking();
      }
    }
  });

  /** マッチングキャンセル送信処理 */
  const sendCancelMatching = useCallback(() => {
    sendMessage({
      action: "cancelMatching",
    });
  }, [sendMessage]);


  // --- マッチングを開始する専用の関数（ハンドラ）を作る ---
  const startMatchmaking = useCallback(() => {
    if (!playerId) {
      console.error("プレイヤーIDが存在しません。マッチングを開始できません。");
      return;
    }

    if (matchingStatus === "InProgress") {
      console.warn("すでにマッチングが進行中です。");
      return;
    }

    sendMessage({
      action: "pveMatchmaking",
      playerId: playerId,
      units: [
        {
          unitTypeId: "MIKUMO_OSAMU",
          initialX: 4,
          initialY: 34,
          usingMainTriggerId: "RAYGUST",
          usingSubTriggerId: "ASTEROID",
          mainTriggerIds: ["RAYGUST", "THRUSTER", "SHIELD", "BAGWORM"],
          subTriggerIds: ["ASTEROID", "SHIELD", "SPIDER"],
        },
        {
          unitTypeId: "KUGA_YUMA",
          initialX: 12,
          initialY: 34,
          usingMainTriggerId: "SCORPION",
          usingSubTriggerId: "SHIELD",
          mainTriggerIds: ["SCORPION", "SHIELD", "GRASSHOPPER"],
          subTriggerIds: ["SCORPION", "SHIELD", "GRASSHOPPER", "BAGWORM"],
        },
        {
          unitTypeId: "AMATORI_CHIKA",
          initialX: 20,
          initialY: 34,
          usingMainTriggerId: "IBIS",
          usingSubTriggerId: "BAGWORM",
          mainTriggerIds: ["IBIS", "LIGHTNING", "HOUND", "SHIELD"],
          subTriggerIds: ["REDBULLET", "SHIELD", "BAGWORM"],
        },
        {
          unitTypeId: "HYUSE_KURONIN",
          initialX: 28,
          initialY: 34,
          usingMainTriggerId: "KOGETSU",
          usingSubTriggerId: "SHIELD",
          mainTriggerIds: ["KOGETSU", "SENKU", "SHIELD",],
          subTriggerIds: ["VIPER", "ESCUDE", "SHIELD", "BAGWORM"],
        }
      ],
    });

    // Stateの更新は、この関数が「呼び出されたとき」に1回だけ行う
    setMatchingStatus("InProgress");
    console.log("マッチング開始メッセージを送信しました");
  }, [matchingStatus, playerId, sendMessage]);

  // --- マッチングをキャンセルする専用の関数 ---
  const handleCancelMatching = useCallback(() => {
    sendCancelMatching();
    setMatchingStatus("NotStarted");
  }, [sendCancelMatching]);

  // 接続イベントはここで1回だけ登録してクリーンアップする
  useEffect(() => {
    const onDisconnect = () => {
      if (matchingStatus === "InProgress") {
        setMatchingStatus("Interrupted");
      }
    };

    const onConnect = () => {
      if (matchingStatus !== "InProgress" && isMobilePortrait === false) {
        startMatchmaking();
      }
    };

    addConnectionListener("disconnect", onDisconnect);
    addConnectionListener("connect", onConnect);

    return () => {
      removeConnectionListener("disconnect", onDisconnect);
      removeConnectionListener("connect", onConnect);
    };
  }, [addConnectionListener, removeConnectionListener, matchingStatus, isMobilePortrait, startMatchmaking]);

  /** マッチングのキャンセルと画面の移動 */
  const cancelMatching = useCallback(() => {
    sendCancelMatching();
    setMatchingStatus("NotStarted");
    router.push("/");
  }, [sendCancelMatching, router]);

  // 再接続ボタン
  const retryConnection = () => {
    connect();
  };

  return {
    matchingStatus,
    cancelMatching,
    retryConnection,
  };
};