"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { WebSocketRequestType } from "./types/WebSocketRequests";
import { WebSocketResponseType } from "./types/WebSocketResponses";

/**
 * WebSocketコンテキストの型定義
 */
interface WebSocketContextType {
  /** 接続状態 */
  isConnected: boolean;
  /** ゲームID */
  gameId?: string | null;
  /** ゲームIDの設定 */
  setGameId: (gameId: string | null) => void;
  /** プレイヤーID */
  playerId?: string | null;
  /** フィールドの状態 */
  fieldView: boolean[][] | null;
  // メッセージ送信
  sendMessage: (message: WebSocketRequestType) => void;
  // メッセージリスナー
  addMessageListener: (
    action: string,
    callback: (data: WebSocketResponseType) => void
  ) => void;
  removeMessageListener: (
    action: string,
    callback: (data: WebSocketResponseType) => void
  ) => void;

  // 接続制御
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

/**
 * WebSocketプロバイダーコンポーネント
 */
export const WebSocketProvider: React.FC<{ children: ReactNode; }> = ({
  children,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  // 接続状態管理
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // プレイヤーID管理
  const [playerId, setPlayerId] = useState<string | null>(null);
  // ゲームID管理
  const [gameId, setGameId] = useState<string | null>(null);
  // フィールドビュー情報
  const [fieldView, setFieldView] = useState<boolean[][] | null>(null);

  // メッセージリスナーを管理
  const messageListeners = useRef<
    Map<string, Set<(data: WebSocketResponseType) => void>>
  >(new Map());

  // 再接続用のタイマー
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  // プレイヤーIDの初期化
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedPlayerId = localStorage.getItem("playerId");
      if (storedPlayerId) {
        setPlayerId(storedPlayerId);
      } else {
        const newPlayerId = crypto.randomUUID();
        console.log("新しいプレイヤーIDを生成:", newPlayerId);
        setPlayerId(newPlayerId);
        localStorage.setItem("playerId", newPlayerId);
      }
    }
  }, []);

  // WebSocket接続関数
  const connect = async () => {
    // サーバーサイドでは何もしない
    if (typeof window === "undefined") {
      console.log("サーバー環境のため WebSocket 接続をスキップします");
      return;
    }

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket is already connected");
      return;
    }

    try {
      // 環境に応じてWebSocket URLを取得
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      console.log("WebSocket接続先:", wsUrl);

      if (!wsUrl) {
        console.error("WebSocket URLが取得できませんでした");
        return;
      }

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket接続が確立されました");
        setIsConnected(true);
        setReconnectAttempts(0);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketResponseType = JSON.parse(event.data);
          console.log("WebSocketメッセージ受信:", data);

          // リスナーに通知
          const listeners = messageListeners.current.get(data.action);
          if (listeners) {
            listeners.forEach((callback) => callback(data));
          }
        } catch (error) {
          console.error("WebSocketメッセージの解析に失敗:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        setIsConnected(false);
        console.error("WebSocketエラー:", error);
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        console.log("WebSocket接続が閉じられました:", event.code, event.reason);

        // 意図的でない切断の場合は再接続を試行
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connect();
          }, delay);
        } else {
        }
      };
    } catch (error) {
      console.error("WebSocket接続エラー:", error);
    }
  };

  // WebSocket切断関数
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket接続を切断します");
      wsRef.current.close(1000, "Manual disconnect");
    }
  };

  // メッセージ送信関数
  const sendMessage = (message: WebSocketRequestType) => {
    // サーバーサイドでは何もしない
    if (typeof window === "undefined") {
      console.warn(
        "サーバー環境のため WebSocket メッセージ送信をスキップします"
      );
      return;
    }
    console.log("WebSocket接続状態(ref):", wsRef.current?.readyState);

    // 実際のWebSocketの状態もチェック
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      console.log("WebSocketメッセージ送信:", message);
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error(
        `WebSocketが接続されていません - メッセージ: ${JSON.stringify(
          message
        )} | readyState(ref): ${wsRef.current?.readyState
        } |`
      ); // エラーメッセージに両方の状態を追加
    }
  };

  // メッセージリスナー追加
  const addMessageListener = (
    type: string,
    callback: (data: WebSocketResponseType) => void
  ) => {
    if (!messageListeners.current.has(type)) {
      messageListeners.current.set(type, new Set());
    }
    messageListeners.current.get(type)!.add(callback);
  };

  // メッセージリスナー削除
  const removeMessageListener = (
    type: string,
    callback: (data: WebSocketResponseType) => void
  ) => {
    const listeners = messageListeners.current.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        messageListeners.current.delete(type);
      }
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const contextValue: WebSocketContextType = {
    isConnected,
    gameId,
    setGameId,
    playerId,
    fieldView,
    sendMessage,
    addMessageListener,
    removeMessageListener,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * WebSocketコンテキストを使用するためのフック
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

export default WebSocketProvider;
