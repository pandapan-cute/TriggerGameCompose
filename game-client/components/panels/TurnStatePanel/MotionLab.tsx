"use client";

import { useEffect, useState } from "react";
import LonghexOutline from "@/components/outlines/LonghexOutline";
import styles from "./index.module.css";

interface MotionLabProps {
  endtime: Date;
  turn: number;
  maxTurn: number;
}

export default function TurnStateMotionLabPanel(props: MotionLabProps) {
  const { endtime, turn, maxTurn } = props;
  const endTimestamp = endtime.getTime();

  const [initialDurationMs, setInitialDurationMs] = useState(() => {
    return Math.max(1, endTimestamp - Date.now());
  });

  // 残り時間を0.01秒単位で管理
  const [remainingCentiseconds, setRemainingCentiseconds] = useState(() => {
    return Math.max(0, Math.ceil((endTimestamp - Date.now()) / 10));
  });

  useEffect(() => {
    setInitialDurationMs(Math.max(1, endTimestamp - Date.now()));

    const updateRemainingTime = () => {
      setRemainingCentiseconds(
        Math.max(0, Math.ceil((endTimestamp - Date.now()) / 10)),
      );
    };

    updateRemainingTime();

    const intervalId = window.setInterval(updateRemainingTime, 10);

    return () => window.clearInterval(intervalId);
  }, [endTimestamp]);

  const remainingRatio = Math.max(
    0,
    Math.min(1, (remainingCentiseconds * 10) / initialDurationMs),
  );
  const timerColor = `hsl(${remainingRatio * 113} 81% 40%)`;

  return (
    <>
      <div className={styles.container}>
        <LonghexOutline>
          <div>
            <p className={`${styles.motionState} text-lime-400`}>Motion Lab</p>
            <p className={`${styles.motionStateJa} text-lime-400`}>- 動きの設定 -</p>
            <p className={styles.remainingTime} style={{ color: timerColor }}>
              {(remainingCentiseconds / 100).toFixed(2)}
            </p>
          </div>
          <div className={styles.turnInfo}>
            <p>Turn</p>
            <p><span className={styles.currentTurn}>{turn}</span><span className={styles.maxTurn}> / {maxTurn}</span></p>
          </div>

        </LonghexOutline>

      </div>
    </>
  );
}