'use client';
import { HexUtils } from "@/game-logics/hexUtils";
import "phaser";

/**
 * 六角形セルを表すクラス
 */
export class HexagonCell extends Phaser.GameObjects.Graphics {

  private hexUtils: HexUtils;

  constructor(hexUtils: HexUtils, scene: Phaser.Scene, pos: { x: number; y: number; }) {
    super(scene);
    this.hexUtils = hexUtils;
    this.createHexagon(pos);
    this.fillStyle(0xB0BEC5, 1); // グレーの塗りつぶし
    this.setDepth(0); // 背景レイヤー

    scene.add.existing(this);
  }

  /**
   * 視認可能エリアのセルに切り替える
    * （白で塗りつぶす）
   */
  switchCanSight() {
    // 白で塗りつぶし
    this.fillStyle(0xffffff, 1);
    this.createHexagon({ x: this.x, y: this.y });
  }

  /**
   * 視認不可能エリアのセルに切り替える
   * （グレーで塗りつぶす）
   */
  switchCannotSight() {
    // グレーで塗りつぶし
    this.fillStyle(0xB0BEC5, 1);
    this.createHexagon({ x: this.x, y: this.y });
  }

  /** 六角形を描画するヘルパー関数 */
  private createHexagon(pos: { x: number; y: number; }) {
    this.lineStyle(1, 0x000000, 0.3);
    const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
    this.beginPath();
    this.moveTo(vertices[0], vertices[1]);
    for (let i = 2; i < vertices.length; i += 2) {
      this.lineTo(vertices[i], vertices[i + 1]);
    }
    this.closePath();
    this.fillPath();
    this.strokePath();
  }
}