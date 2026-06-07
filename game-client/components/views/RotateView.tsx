"use client";
import useDeviceOrientation from "@/hooks/device/useDeviceOrientation";
import { Metadata } from "next";

export const metadata: Metadata = {
  viewport: {
    width: "device-width",
    initialScale: 1,
    userScalable: false,
  },
  other: {
    "screen-orientation": "landscape",
  },
};

/**
 * 画面の回転を推奨する表示を行うコンポーネント
 * @returns JSX.Element | null
 */
export default function Index() {

  const { isMobilePortrait } = useDeviceOrientation();

  // フルスクリーン＋画面回転制御
  const enterFullscreenLandscape = async () => {
    try {
      // フルスクリーン要求
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }

      // 画面回転制御（型アサーションで解決）
      if (screen.orientation && "lock" in screen.orientation) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (screen.orientation as any).lock("landscape");
      }
    } catch (error) {
      console.log('フルスクリーン/画面回転制御に失敗:', error);
    }
  };

  if (isMobilePortrait) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white p-8 max-w-sm">
          <div className="mb-8">
            <div className="relative">
              {/* 回転アニメーション */}
              <div className="inline-block animate-pulse">
                <div className="w-24 h-40 bg-white/20 rounded-lg border-4 border-white/40 mb-4"></div>
              </div>
              <div className="inline-block ml-8 animate-bounce">
                <div className="w-40 h-24 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg border-4 border-blue-400"></div>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold mb-4">画面を横向きにしてください</h2>
          <p className="text-lg text-gray-300 mb-8 leading-relaxed">
            ワールドトリガーGridFieldは
            <br />
            横画面でのプレイを推奨しています
          </p>

          <button
            onClick={enterFullscreenLandscape}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-8 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            🔄 フルスクリーンで横画面にする
          </button>

          <div className="mt-8 text-sm text-gray-400">
            または手動でデバイスを回転させてください
          </div>
        </div>
      </div>
    );
  }
  return null;
}