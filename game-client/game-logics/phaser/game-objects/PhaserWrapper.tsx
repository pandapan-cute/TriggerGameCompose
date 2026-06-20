import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export type PhaserWrapperProps = { config?: Phaser.Types.Core.GameConfig; };

/**
 * Phaserのゲーム内で使うオブジェクトをstorybookで表示するためのラッパーコンポーネント
 * @param {PhaserWrapperProps} config - Phaserのゲーム設定。必要に応じて上書き可能
 * @returns {JSX.Element} Phaserのゲームオブジェクトを表示するためのdiv要素
 */
export default function PhaserWrapper({ config }: PhaserWrapperProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const cfg: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 480,
      height: 320,
      parent: mountRef.current,
      backgroundColor: '#FFFFFF',
      ...config,
    };
    gameRef.current = new Phaser.Game(cfg);
    return () => { gameRef.current?.destroy(true); gameRef.current = null; };
  }, [config]);

  return <div style={{ width: 480, height: 320 }} ref={mountRef} />;
}