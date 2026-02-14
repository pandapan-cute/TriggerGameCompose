'use client';
import { GameState } from "@/game-logics/models/GameState";
import "phaser";

/**
 * ゲームの入力を管理するクラス
 * PhaserのInputPluginを拡張して、ゲームの入力処理を行う
 * @deprecated ちょっとうまく動かないので要修正
 */
export class GameInput {

  private gameState: GameState;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera, gameState: GameState) {
    this.gameState = gameState;
    this.camera = camera;

    // マウス移動イベント
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {

      switch (this.gameState.getGameState()) {
        case "TriggerSetting":
          // トリガー設定モードの処理
          break;
        case "Default":
          // デフォルトモードの処理
          break;
      }
    });

    // タッチ開始イベント
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {

    });

    // マウスクリックイベント
    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    });


    let currentZoomIndex = 1; // 初期値は普通（1.0）

    // マウスホイールでズーム切り替え
    scene.input.on("wheel", (pointer: Phaser.Input.Pointer) => {
      const deltaY = pointer.deltaY;
      console.log("Current Zoom Index:", currentZoomIndex, deltaY);

      if (deltaY >= 0) {
        // ズームアウト（縮小方向）
        currentZoomIndex *= 0.5;
      } else {
        // ズームイン（拡大方向）
        currentZoomIndex *= 1.5;
      }
      this.camera.setZoom(currentZoomIndex);
    });
  }
}