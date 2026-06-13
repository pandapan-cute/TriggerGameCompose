import { useEffect, useRef, useState } from "react";

interface UseDeviceOrientationProps {
  // 画面の向きが変わったときに呼び出したい関数を受け取る
  onOrientationChange?: (isMobilePortrait: boolean | null) => void;
}

/**
 * カスタムフック: デバイスの向きとモバイル判定
 * @returns isMobilePortrait: モバイルデバイスかつ縦向きかどうか
 * - true: モバイルデバイスで縦向き
 * - false: モバイルデバイスで横向き、またはPC
 * - null: 判定中または不明
 */
export default function useDeviceOrientation({ onOrientationChange }: UseDeviceOrientationProps = {}) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isPortrait, setIsPortrait] = useState<boolean | null>(null);

  useEffect(() => {
    const checkDevice = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    const checkOrientation = () => {
      if (isMobile === true) {
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);
      } else if (isMobile === false) {
        setIsPortrait(false);
      }
    };

    checkDevice();
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkOrientation, 100); // orientationchange後の遅延
    });

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [isMobile, isPortrait]);


  // コールバック関数を最新の状態で保持するためのRef（無限ループ防止）
  const callbackRef = useRef(onOrientationChange);
  useEffect(() => {
    callbackRef.current = onOrientationChange;
  }, [onOrientationChange]);

  useEffect(() => {
    const checkOrientation = () => {
      if (!callbackRef.current) {
        return null;
      }
      if (isMobile === true && isPortrait === true) {
        callbackRef.current(true);
      } else if (isMobile === false || isPortrait === false) {
        callbackRef.current(false);
      } else {
        callbackRef.current(null);
      }
    };

    checkOrientation();
  }, [isMobile, isPortrait]);

  return { isMobilePortrait: isMobile !== null && isPortrait !== null ? isMobile && isPortrait : null };
}