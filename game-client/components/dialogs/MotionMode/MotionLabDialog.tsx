"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * 親コンポーネントから ref 経由で呼び出せる関数。
 * dialogRef.current?.show() のように使う。
 */
export interface MotionLabDialogHandle {
  show: () => void;
}

interface MotionLabDialogProps {
  /** 表示したいターン数だけは呼び出し元から受け取る */
  turn: number;
  /** アニメーション完了後に必要なら呼び出す */
  onAnimationEnd?: () => void;
}

type AnimationPhase = "hidden" | "enter" | "hold" | "exit";

/**
 * このコンポーネント専用の固定表示文言。
 * 毎回変えないので props ではなく定数にしている。
 */
const TITLE = "Motion Lab";
const SUBTITLE = "- 動きの設定 -";

/**
 * アニメーション時間も固定値として管理する。
 * 左から 0.5 秒で登場 → 1 秒停止 → 右へ 0.5 秒で退場。
 */
const ENTER_DURATION_MS = 500;
const HOLD_DURATION_MS = 1000;
const EXIT_DURATION_MS = 500;
const ENTER_PREPARE_DELAY_MS = 10;

/**
 * forwardRef を使う理由:
 * このコンポーネントは「props で表示状態を受け取る」のではなく、
 * 親から ref 経由で show() を実行して表示したいから。
 *
 * つまり親側は以下のように使える。
 * const dialogRef = useRef<MotionLabDialogHandle>(null);
 * dialogRef.current?.show();
 */
const MotionLabDialog = forwardRef<MotionLabDialogHandle, MotionLabDialogProps>(
  /**
   * ここに書いている MotionLabDialog は、forwardRef に渡している描画関数の名前。
   * 自分で直接呼び出しているわけではなく、<MotionLabDialog ... /> と書かれたときに
   * React がこの関数を呼んで描画する。
   */
  function MotionLabDialog({ turn, onAnimationEnd }, ref) {
    /** true の間だけオーバーレイ自体を表示する */
    const [isVisible, setIsVisible] = useState(false);

    /** アニメーションの今の段階を管理する */
    const [phase, setPhase] = useState<AnimationPhase>("hidden");

    /** setTimeout の ID を貯めて、再実行時や unmount 時にまとめて止める */
    const timerIdsRef = useRef<number[]>([]);

    const clearTimers = useCallback(() => {
      timerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timerIdsRef.current = [];
    }, []);

    useEffect(() => {
      return () => {
        clearTimers();
      };
    }, [clearTimers]);

    /**
     * 表示開始用の関数。
     * 親から dialogRef.current?.show() で実行される。
     */
    const show = useCallback(() => {
      clearTimers();
      setIsVisible(true);

      /**
       * いったん左画面外に置いてから enter にすることで、
       * CSS transition が正しく発火する。
       */
      setPhase("hidden");

      timerIdsRef.current.push(
        window.setTimeout(() => {
          setPhase("enter");
        }, ENTER_PREPARE_DELAY_MS),
      );

      timerIdsRef.current.push(
        window.setTimeout(() => {
          setPhase("hold");
        }, ENTER_DURATION_MS + ENTER_PREPARE_DELAY_MS),
      );

      timerIdsRef.current.push(
        window.setTimeout(() => {
          setPhase("exit");
        }, ENTER_DURATION_MS + HOLD_DURATION_MS + ENTER_PREPARE_DELAY_MS),
      );

      timerIdsRef.current.push(
        window.setTimeout(() => {
          setPhase("hidden");
          setIsVisible(false);
          onAnimationEnd?.();
        },
          ENTER_DURATION_MS +
          HOLD_DURATION_MS +
          EXIT_DURATION_MS +
          ENTER_PREPARE_DELAY_MS),
      );
    }, [clearTimers, onAnimationEnd]);

    /**
     * useImperativeHandle で、親が ref 経由で触れる API を定義する。
     * 今回は show だけ公開している。
     */
    useImperativeHandle(
      ref,
      () => ({
        show,
      }),
      [show],
    );

    if (!isVisible) {
      return null;
    }

    /**
     * hidden: 左画面外
     * enter / hold: 中央
     * exit: 右画面外
     */
    const animationClass =
      phase === "enter" || phase === "hold"
        ? "translate-x-0 opacity-100"
        : phase === "exit"
          ? "translate-x-[120vw] opacity-0"
          : "-translate-x-[120vw] opacity-0";

    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden px-4 bg-black/90">
        <div
          className={`w-full max-w-5xl transform-gpu transition-all ease-in-out ${animationClass}`}
          style={{
            transitionDuration:
              phase === "exit" ? `${EXIT_DURATION_MS}ms` : `${ENTER_DURATION_MS}ms`,
          }}
        >
          <div className="flex w-full items-center justify-between gap-4 text-white">
            <div className="select-none text-4xl font-light tracking-[0.2em] text-slate-300 md:text-6xl">
              &gt;&gt;
            </div>

            <div className="flex-1 text-center">
              <p
                className="whitespace-nowrap text-[clamp(2rem,5vw,4.2rem)] italic text-lime-400"
                style={{ fontFamily: "michroma, sans-serif" }}
              >
                {TITLE}
              </p>
              <p className="text-[clamp(1.6rem,2vw,4.2rem)] text-lime-400">
                {SUBTITLE}
              </p>
              <p
                className="mt-2 whitespace-nowrap text-[clamp(2.2rem,5vw,4rem)] text-white"
                style={{ fontFamily: "michroma, sans-serif" }}
              >
                Turn {turn}
              </p>
            </div>

            <div className="select-none text-4xl font-light tracking-[0.2em] text-slate-300 md:text-6xl">
              &gt;&gt;
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);

MotionLabDialog.displayName = "MotionLabDialog";

export default MotionLabDialog;
