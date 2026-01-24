"use client";
import { WebSocketResponseType } from "@/contexts/types/WebSocketResponses";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { MatchingStatus } from "@/types/MatchingTypes";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

/**
 * マッチング管理用のカスタムフック
 */
export const useManageMatching = () => {
  const router = useRouter();
  const [matchingStatus, setMatchingStatus] = useState<MatchingStatus>("InProgress");

  const {
    isConnected,
    playerId,
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
          router.push("/game");
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

  // マッチング開始
  useEffect(() => {
    console.log("マッチング開始のチェック:", isConnected);
    if (isConnected) {
      if (!playerId) {
        console.error("プレイヤーIDが存在しません。マッチングを開始できません。");
        return;
      }
      // マッチング開始メッセージを送信
      sendMessage({
        action: "matchmaking",
        playerId: playerId || "",
      });
      console.log("マッチング開始メッセージを送信しました");
    } else {
      // 接続していない場合は接続を開始
      connect();
    }
  }, [isConnected, playerId]); // readyStateの変更時およびplayerIdの変更時に実行

  // マッチングキャンセル
  const cancelMatching = () => {
    // sendMessage({
    //   action: "cancel_matching",
    //   playerId: playerId || undefined,
    // });
    router.push("/");
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