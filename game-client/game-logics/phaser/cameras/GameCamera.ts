'use client';
import { GridConfig } from "@/app/game/[gameId]/page";
import "phaser";

/**
 * ゲームのカメラを管理するクラス
 */
export class GameCamera {

  constructor(scene: Phaser.Scene, gridConfig: GridConfig) {
    this.initializeCamera(scene, gridConfig);

    // マウスホイールでズーム切り替え
    this.setUpMouseWheelZoom(scene);
  }

  /**
   * カメラの初期設定やイベントリスナーの登録などを行う
   * @param scene 
   * @param gridConfig 
   */
  private initializeCamera(scene: Phaser.Scene, gridConfig: GridConfig) {
    // カメラの境界を設定（グリッド全体をカバー + 余白）
    const gridWidth =
      gridConfig.gridWidth * gridConfig.hexWidth * 0.75 +
      gridConfig.hexWidth;
    const gridHeight =
      gridConfig.gridHeight * gridConfig.hexHeight +
      gridConfig.hexHeight;

    // 余白を含めたワールドサイズ
    const worldWidth = gridWidth + gridConfig.marginLeft * 2;
    const worldHeight = gridHeight + gridConfig.marginTop * 2;

    // カメラの境界を設定
    scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // 初期位置を中央に設定（余白を考慮）
    scene.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
  }

  /**
   * マウスホイールでズーム切り替えの設定
   * @param scene 
   */
  private setUpMouseWheelZoom(scene: Phaser.Scene) {

    let currentZoomIndex = 1; // 初期値は普通（1.0）

    // マウスホイールでズーム切り替え
    scene.input.on("wheel", (pointer: Phaser.Input.Pointer) => {
      const camera = scene.cameras.main;
      const deltaY = pointer.deltaY;
      console.log("Current Zoom Index:", currentZoomIndex, deltaY);

      if (deltaY >= 0) {
        // ズームアウト（縮小方向）
        currentZoomIndex *= 0.5;
      } else {
        // ズームイン（拡大方向）
        currentZoomIndex *= 1.5;
      }
      camera.setZoom(currentZoomIndex);
    });
  }
}