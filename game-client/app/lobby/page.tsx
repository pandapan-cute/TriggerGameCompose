"use client";
import { useManageMatching } from './useManageMatching';
import Link from 'next/link';

/**
 * マッチング待機中ページコンポーネント
 */
export default function LobbyPage() {

  // マッチング管理フックの利用
  const { matchingStatus, cancelMatching, retryConnection } = useManageMatching();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center border border-white/20">
        {/* ヘッダー */}
        <h1 className="text-3xl font-bold text-white mb-8">マッチング</h1>

        {/* ステータス表示 */}
        <div className="mb-8">
          {matchingStatus === "InProgress" && (
            <div className="text-white">
              <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
              <p className="text-lg">
                {"マッチング中..."}
              </p>
            </div>
          )}

          {matchingStatus === "Completed" && (
            <div className="text-white">
              <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-lg text-green-300">マッチング完了！</p>
              <div className="animate-pulse text-sm text-white/70 mt-2">
                ゲーム画面に移動中...
              </div>
            </div>
          )}

          {matchingStatus === "Interrupted" && (
            <div className="text-white">
              <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-lg text-red-300 mb-4">
                {matchingStatus}
              </p>
              <button
                onClick={retryConnection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                再接続
              </button>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="space-y-3">
          {matchingStatus === "InProgress" && (
            <button
              onClick={cancelMatching}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg transition-colors"
            >
              マッチングをキャンセル
            </button>
          )}

          <Link
            href="/"
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-colors"
          >
            ホームに戻る
          </Link>
        </div>

        {/* デバッグ情報（開発時のみ） */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 text-left bg-black/20 rounded-lg p-3 text-xs text-white/50 font-mono">
          </div>
        )}
      </div>
    </div>
  );
}