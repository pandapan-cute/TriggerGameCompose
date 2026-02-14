'use client';
import { HexUtils } from "@/game-logics/hexUtils";
import "phaser";

export interface HexHighlightStyle {
  fillColor: number;
  fillAlpha: number;
  lineColor: number;
  lineAlpha: number;
  lineWidth: number;
  depth: number;
}

/**
 * 六角形のハイライトを描画するクラス
 */
export class MovableHighlightCell extends Phaser.GameObjects.Graphics {
  private hexUtils: HexUtils;
  private style: HexHighlightStyle;

  constructor(
    hexUtils: HexUtils,
    scene: Phaser.Scene,
    pos: { x: number; y: number; },
    style: HexHighlightStyle
  ) {
    super(scene);
    this.hexUtils = hexUtils;
    this.style = style;

    this.drawHexagon(pos);
    this.setDepth(style.depth);

    scene.add.existing(this);
  }

  private drawHexagon(pos: { x: number; y: number; }) {
    this.clear();
    this.fillStyle(this.style.fillColor, this.style.fillAlpha);
    this.lineStyle(
      this.style.lineWidth,
      this.style.lineColor,
      this.style.lineAlpha
    );

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
