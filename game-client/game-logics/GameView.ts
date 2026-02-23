import { CharacterImageState } from "./entities/CharacterImageState";
import { HexUtils } from "./hexUtils";
import { GridConfig } from "./types";
import { Position } from "./types";

export class GameView {

  private hexUtils: HexUtils;
  constructor(private scene: Phaser.Scene, private gridConfig: GridConfig) {
    this.hexUtils = new HexUtils(gridConfig);
  }

  /**
   * ネイティブタッチイベントによるピンチジェスチャー設定
   */
  setupNativePinchGesture(camera: Phaser.Cameras.Scene2D.Camera) {
    const canvas = this.scene.sys.canvas;
    const touches: Map<number, { x: number; y: number; }> = new Map();
    const gestureState = {
      isPinching: false,
      initialDistance: 0,
      initialZoom: 1,
      lastDistance: 0,
      centerX: 0,
      centerY: 0,
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      // 全てのタッチポイントを記録
      Array.from(e.touches).forEach((touch) => {
        touches.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY,
        });
      });

      // 2本指の場合はピンチ開始
      if (touches.size === 2) {
        const touchArray = Array.from(touches.values());

        // 2本指の中点を計算
        gestureState.centerX = (touchArray[0].x + touchArray[1].x) / 2;
        gestureState.centerY = (touchArray[0].y + touchArray[1].y) / 2;

        gestureState.initialDistance = this.hexUtils.calculateDistance(
          touchArray[0].x,
          touchArray[0].y,
          touchArray[1].x,
          touchArray[1].y
        );

        gestureState.lastDistance = gestureState.initialDistance;
        gestureState.isPinching = true;
        gestureState.initialZoom = camera.zoom;

        console.log(
          `ネイティブピンチ開始: 距離=${gestureState.initialDistance.toFixed(
            1
          )}px, ズーム=${gestureState.initialZoom.toFixed(2)}x`
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      // タッチ位置を更新
      Array.from(e.touches).forEach((touch) => {
        touches.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY,
        });
      });

      // ピンチ処理
      if (gestureState.isPinching && touches.size === 2) {
        const touchArray = Array.from(touches.values());
        const currentDistance = this.hexUtils.calculateDistance(
          touchArray[0].x,
          touchArray[0].y,
          touchArray[1].x,
          touchArray[1].y
        );

        // 現在の2本指の中点
        const currentCenterX = (touchArray[0].x + touchArray[1].x) / 2;
        const currentCenterY = (touchArray[0].y + touchArray[1].y) / 2;

        if (gestureState.initialDistance > 0) {
          // スケール計算
          const scale = currentDistance / gestureState.initialDistance;
          const newZoom = gestureState.initialZoom * scale;
          const clampedZoom = Phaser.Math.Clamp(newZoom, 0.25, 4.0);

          // ピンチ中心を維持するようにカメラを調整
          const canvas = this.scene.sys.canvas;
          const canvasRect = canvas.getBoundingClientRect();

          // スクリーン座標をワールド座標に変換（ズーム適用前）
          const worldPointBefore = camera.getWorldPoint(
            currentCenterX - canvasRect.left,
            currentCenterY - canvasRect.top
          );

          // ズームを適用
          camera.setZoom(clampedZoom);

          // ズーム適用後の同じスクリーン座標のワールド座標
          const worldPointAfter = camera.getWorldPoint(
            currentCenterX - canvasRect.left,
            currentCenterY - canvasRect.top
          );

          // ピンチ中心を維持するようにカメラをオフセット
          camera.scrollX += worldPointAfter.x - worldPointBefore.x;
          camera.scrollY += worldPointAfter.y - worldPointBefore.y;

          gestureState.lastDistance = currentDistance;

          // デバッグ用ログ（頻度を抑制）
          if (Math.abs(currentDistance - gestureState.lastDistance) > 10) {
            console.log(`ピンチズーム: ${clampedZoom.toFixed(2)}x`);
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      // 終了したタッチを削除
      Array.from(e.changedTouches).forEach((touch) => {
        touches.delete(touch.identifier);
      });

      // 2本指未満になったらピンチ終了
      if (touches.size < 2) {
        if (gestureState.isPinching) {
          console.log(
            `ネイティブピンチ終了: 最終ズーム=${camera.zoom.toFixed(
              2
            )}x`
          );
        }
        gestureState.isPinching = false;
        gestureState.initialDistance = 0;
      }
    };

    // ネイティブイベントリスナーを追加
    canvas.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, {
      passive: false,
    });
  }
}