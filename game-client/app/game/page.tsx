'use client';
import { useWebSocket } from "@/contexts/WebSocketContext";
import GameGrid from "@/game-logics/GameGrid";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function GamePage() {
  // WebSocketコンテキストを使用
  const { isConnected } = useWebSocket();

  const router = useRouter();

  // WebSocketの接続状態が変わったらマッチングページにリダイレクト
  useEffect(() => {
    if (!isConnected) {
      router.replace("/lobby");
    }
  }, [isConnected, router]);
  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* ゲーム画面 */}
      <div className="w-full h-full">
        <GameGrid />
      </div>
    </div>
  );
}
