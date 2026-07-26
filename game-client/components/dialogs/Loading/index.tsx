"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NormalFullDialog from "../NormalFullDialog";

/**
 * LoadingDialog コンポーネントの props。
 */
interface LoadingDialogProps {
  /** 六角形インジケータの下に表示するメッセージ。 */
  message: string;
  /** ダイアログ表示状態。未指定時は表示する。 */
  isOpen?: boolean;
}

/**
 * SVG 上の座標点。
 */
interface Point {
  x: number;
  y: number;
}

/** アクティブな辺の発光色。 */
const HIGHLIGHT_COLOR = "#00e5ff";
/** 非アクティブな辺の発光色。 */
const BASE_COLOR = "#ffffff";
/** 発光する辺を次の辺へ移動する間隔 (ms)。 */
const EDGE_MOVE_INTERVAL_MS = 1000;

/**
 * 六角形の各頂点座標を生成する。
 *
 * @param centerX 六角形中心の X 座標。
 * @param centerY 六角形中心の Y 座標。
 * @param radius 六角形の外接円半径。
 * @returns 六角形の頂点配列。
 */
const createHexPoints = (centerX: number, centerY: number, radius: number): Point[] => {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 90);
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
};

/**
 * 1 辺の両端を少し内側へ縮め、頂点がつながらない線分を作る。
 *
 * @param from 辺の始点。
 * @param to 辺の終点。
 * @param trimRatio 辺の両端を削る比率。
 * @returns 描画用の短縮済み線分座標。
 */
const getTrimmedEdge = (from: Point, to: Point, trimRatio: number) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    x1: from.x + dx * trimRatio,
    y1: from.y + dy * trimRatio,
    x2: to.x - dx * trimRatio,
    y2: to.y - dy * trimRatio,
  };
};

/**
 * ローディング用の全画面ダイアログ。
 *
 * @param props 表示メッセージと開閉状態。
 * @returns 発光する六角形インジケータを表示するダイアログ。
 */
export default function LoadingDialog({ message, isOpen = true }: LoadingDialogProps) {
  /** dialog 要素への参照。 */
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** 現在アクティブな辺インデックス。 */
  const [activeEdgeIndex, setActiveEdgeIndex] = useState(0);

  /** 六角形の 6 辺座標を初回レンダリング時に生成する。 */
  const edges = useMemo(() => {
    const points = createHexPoints(60, 60, 42);
    return points.map((point, index) => {
      const nextPoint = points[(index + 1) % points.length];
      return getTrimmedEdge(point, nextPoint, 0.12);
    });
  }, []);

  /** isOpen に応じて dialog の open/close を同期する。 */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  /** 表示中のみ 1 秒ごとにアクティブ辺を進める。 */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timerId = window.setInterval(() => {
      setActiveEdgeIndex((prev) => (prev + 1) % 6);
    }, EDGE_MOVE_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isOpen]);

  return (
    <NormalFullDialog ref={dialogRef}>
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-2">
          <svg
            width="160"
            height="160"
            viewBox="0 0 120 120"
            fill="none"
            aria-hidden="true"
          >
            {edges.map((edge, index) => {
              const isActive = index === activeEdgeIndex;
              const strokeColor = isActive ? HIGHLIGHT_COLOR : BASE_COLOR;

              return (
                <line
                  key={`hex-edge-${index}`}
                  x1={edge.x1}
                  y1={edge.y1}
                  x2={edge.x2}
                  y2={edge.y2}
                  stroke={strokeColor}
                  strokeWidth={isActive ? 4 : 3}
                  strokeLinecap="round"
                  style={{
                    filter: isActive
                      ? "drop-shadow(0 0 8px #00e5ff) drop-shadow(0 0 14px #00e5ff)"
                      : "drop-shadow(0 0 6px rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,255,255,0.45))",
                  }}
                />
              );
            })}
          </svg>

          <p className="text-center text-lg text-white sm:text-xl font-michroma">{message}</p>
        </div>
      </div>
    </NormalFullDialog>
  );
}
