"use client";

import { useEffect, useState } from "react";
import LonghexOutline from "@/components/outlines/LonghexOutline";
import styles from "./index.module.css";

interface MotionExecuteProps {
  endtime: Date;
  turn: number;
  maxTurn: number;
}

export default function TurnStateMotionExecutePanel(props: MotionExecuteProps) {
  const { endtime, turn, maxTurn } = props;
  const endTimestamp = endtime.getTime();

  // 残り時間を1秒単位で管理
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    return Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
  });

  useEffect(() => {
    const updateRemainingTime = () => {
      setRemainingSeconds(
        Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000)),
      );
    };

    updateRemainingTime();

    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => window.clearInterval(intervalId);
  }, [endTimestamp]);

  const timerColor = `hsl(113 81% 40%)`;

  return (
    <>
      <div className={styles.container}>
        <LonghexOutline>
          <div>
            <p className={`${styles.motionState} text-lime-400`}>Motion Execute</p>
            <p className={styles.remainingTime} style={{ color: timerColor }}>
              {remainingSeconds}
            </p>
          </div>
          <div className={styles.turnInfo}>
            <p>Turn</p>
            <p><span className={styles.currentTurn}>{turn}</span> / {maxTurn}</p>
          </div>
        </LonghexOutline>
      </div>
    </>
  );
}