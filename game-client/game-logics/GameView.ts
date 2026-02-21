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

  /**
  * 回避テキストを表示する
  * @param position - 表示する位置
  */
  showAvoidImage(position: Position) {
    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

    const avoidImage = this.scene.add.image(
      pixelPos.x,
      pixelPos.y,
      "avoid"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: avoidImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        avoidImage.destroy();
      },
    });
  }

  /**
   * ダメージテキストを表示する
   */
  showShieldImage(
    position: Position,
    damage: number
  ) {
    const pixelPos = this.hexUtils.getHexPosition(position.col, position.row);

    const shieldImage = this.scene.add.image(
      pixelPos.x,
      pixelPos.y,
      damage >= 50 ? "shield_hexagon_blue" : damage >= 20 ? "shield_hexagon_yellow" : "shield_hexagon_red"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: shieldImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        shieldImage.destroy();
      },
    });
  }

  /**
   * ベイルアウト表示と撃破されたキャラクターの削除
   * @param character - 撃破されたキャラクター
   * @param onDestroy - キャラクター削除時に実行するコールバック関数
   */
  showBailOutAndRemoveCharacter(character: CharacterImageState, onDestroy?: () => void) {

    const pixelPos = this.hexUtils.getHexPosition(character.position.col, character.position.row);

    // ベイルアウトテキストを作成
    const bailOutText = this.scene.add.text(
      pixelPos.x,
      pixelPos.y - this.gridConfig.hexRadius * 0.8,
      "ベイルアウト",
      {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
      }
    );
    bailOutText.setOrigin(0.5);
    bailOutText.setDepth(10); // 最前面に表示

    // ベイルアウトテキストのアニメーション
    this.scene.tweens.add({
      targets: bailOutText,
      y: pixelPos.y - this.gridConfig.hexRadius * 2,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        bailOutText.destroy();
      },
    });

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: character,
      alpha: 0,
      duration: 1000,
      delay: 500, // ベイルアウトテキスト表示後少し待ってから開始
      ease: "Power2",
      onComplete: () => {
        character.image.destroy();
        // 削除時の実行関数があれば呼び出す
        onDestroy?.();
      },
    });
  }

  /**
   * アニメーション付きの矢印を描画
   * @param fromCharacter - 矢印の始点となるキャラクターのImageオブジェクト
   * @param toCharacter - 矢印の終点となるキャラクターのImageオブジェクト
   * @param color - 矢印の色（デフォルトは赤色0xff0000）
   * @returns 描画した矢印のGraphicsオブジェクト
   */
  drawAnimatedArrowBetweenCharacters(
    fromCharacter: Phaser.GameObjects.Image,
    toCharacter: Phaser.GameObjects.Image,
  ): Phaser.GameObjects.Graphics {
    const fromX = fromCharacter.x;
    const fromY = fromCharacter.y;
    const toX = toCharacter.x;
    const toY = toCharacter.y;
    const arrowGraphics = this.drawArrow(this.scene, fromX, fromY, toX, toY);
    arrowGraphics.setAlpha(0);

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: arrowGraphics,
      alpha: 1,
      duration: 250,
      delay: 0,
      ease: "Power2",
      onComplete: () => { },
    });
    return arrowGraphics;
  }


  /**
 * 2点間に矢印を描画する関数
 * @param {Phaser.Scene} scene - シーンオブジェクト
 * @param {number} x1 - 始点のX座標
 * @param {number} y1 - 始点のY座標
 * @param {number} x2 - 終点のX座標
 * @param {number} y2 - 終点のY座標
 * @returns {Phaser.GameObjects.Graphics} Graphicsオブジェクト
 */
  private drawArrow(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics({
      lineStyle: { width: 4, color: 0x263238 },
      fillStyle: { color: 0xECEFF1 }
    });

    const arrowSize = 15; // 矢印の先端の大きさ

    // 線の描画
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke();
    graphics.setDepth(1); // トリガー扇形より前面に表示

    // 矢印の角度を計算 (ラジアン)
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);

    // 先端の三角形を描画
    // 角度から少しずらした3点を計算し、終点に配置
    graphics.fillTriangle(
      x2,
      y2,
      x2 - Math.cos(angle - Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle - Math.PI / 6) * arrowSize,
      x2 - Math.cos(angle + Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle + Math.PI / 6) * arrowSize
    );

    return graphics;
  }
}