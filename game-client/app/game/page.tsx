'use client';
import { GameGridBackgroundView } from "@/components/views/GameGridBackgroundView";
import { useWebSocket } from "@/contexts/WebSocketContext";
import GameGrid from "@/game-logics/GameGrid";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

/** グリッドの設定値 */
const gridConfig: GridConfig = {
  gridSize: 32,
  gridWidth: 36,
  gridHeight: 36,
  hexRadius: 24,
  hexWidth: 24 * 2,
  hexHeight: 24 * Math.sqrt(3),
  marginLeft: 0,
  marginTop: 0,
};

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
