'use client';
import { HexUtils } from "@/game-logics/hexUtils";
import "phaser";

/**
 * ハイライト用の六角形セルを表すクラス
 */
export class HighLightCell extends Phaser.GameObjects.Graphics {

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setVisible(false); // 初期状態では非表示
    this.setDepth(0.5); // 背景より前、キャラクターより後ろ
  }
}