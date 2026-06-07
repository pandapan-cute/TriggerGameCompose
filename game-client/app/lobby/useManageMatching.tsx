"use client";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import useDeviceOrientation from "@/hooks/device/useDeviceOrientation";
import { MatchingStatus } from "@/types/MatchingTypes";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * マッチング管理用のカスタムフック
 * 
 * モバイル端末で縦画面でマッチング中のとき -> マッチング開始をキャンセルする
 * 接続していないとき -> Websocket接続を開始する
 * 接続中でモバイル縦画面でないとき -> マッチング開始メッセージを送信する
 * マッチング結果の受信 -> ステータスを更新してゲーム画面に遷移
 */
export const useManageMatching = () => {
  const router = useRouter();
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>("NotStarted");

  const {
    isConnected,
    playerId,
    setGameId,
    sendMessage,
    addMessageListener,
    removeMessageListener,
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
        // if (
        //   data.result &&
        //   typeof data.result === "object" &&
        //   "fieldView" in data.result
        // ) {
        //   // フィールドビュー情報を設定
        //   setFieldView((data.result as MatchmakingResponse).fieldView);
        // }

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
  }, [addMessageListener, removeMessageListener, router]);


  const { isMobilePortrait } = useDeviceOrientation();

  // マッチング開始
  useEffect(() => {
    console.log(`マッチング開始のチェック: isConnected=${isConnected}, playerId=${playerId}, isMobilePortrait=${isMobilePortrait}`);
    if (isConnected && !isMobilePortrait && matchingStatus === "NotStarted") {
      // 接続状態かつモバイル縦向きでない場合にマッチング開始
      if (!playerId) {
        console.error("プレイヤーIDが存在しません。マッチングを開始できません。");
        return;
      }
      // マッチング開始メッセージを送信
      sendMessage({
        action: "matchmaking",
        playerId: playerId || "",
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
      setMatchingStatus("InProgress");
      console.log("マッチング開始メッセージを送信しました");

    } else if (isMobilePortrait && matchingStatus === "InProgress") {
      // モバイル縦向きかつ接続中の場合、マッチングをキャンセルしてステータスをリセット
      sendCancelMatching();
      setMatchingStatus("NotStarted");

    } else if (!isConnected) {
      // 接続していない場合は接続を開始
      connect();
      setMatchingStatus("NotStarted");
    }
  }, [isConnected, playerId, isMobilePortrait]); // readyStateの変更時およびplayerIdの変更時に実行

  // マッチングキャンセル
  const cancelMatching = () => {
    sendCancelMatching();
    router.push("/");
  };

  /** マッチングキャンセル送信処理 */
  const sendCancelMatching = () => {
    sendMessage({
      action: "cancelMatching",
    });
  };

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