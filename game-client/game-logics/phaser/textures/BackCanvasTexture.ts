'use client';
import { GridConfig } from "@/game-logics/types";
import "phaser";

/**
 * 背景テクスチャを作成するクラス
 */
export class BackCanvasTexture extends Phaser.Textures.TextureManager {

  constructor(scene: Phaser.Scene, gridConfig: GridConfig) {
    super(scene.game);
    // HTMLのCanvasを作成
    const canvas = document.createElement("canvas");
    canvas.width = gridConfig.gridSize;
    canvas.height = gridConfig.gridSize;
    const ctx = canvas.getContext("2d")!;

    // 背景色を設定（真っ白）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, gridConfig.gridSize, gridConfig.gridSize);

    // 作成したCanvasをPhaserテクスチャとして登録
    scene.textures.addCanvas("whiteTile", canvas);
  }
}