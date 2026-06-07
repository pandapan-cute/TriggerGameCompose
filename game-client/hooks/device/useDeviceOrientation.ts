import { useEffect, useState } from "react";

/**
 * カスタムフック: デバイスの向きとモバイル判定
 * @returns isMobilePortrait: モバイルデバイスかつ縦向きかどうか
 */
export default function useDeviceOrientation() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    const checkOrientation = () => {
      if (isMobile) {
        const portrait = window.innerHeight > window.innerWidth;
        setIsPortrait(portrait);
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
  }, [isMobile]);

  return { isMobilePortrait: isMobile && isPortrait };
}