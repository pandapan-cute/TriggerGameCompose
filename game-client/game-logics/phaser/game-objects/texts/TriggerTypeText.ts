'use client';
import { GridConfig } from "@/game-logics/types";
import "phaser";

/**
 * トリガータイプテキストを表示するクラス
 */
export class TriggerTypeText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, color: number, gridConfig: GridConfig, correctedDirection: number, triggerRange: number, triggerName: string, visible: boolean) {
    super(scene,
      x + Math.cos((correctedDirection * Math.PI) / 180) * gridConfig.hexRadius * triggerRange + 1.0,
      y + Math.sin((correctedDirection * Math.PI) / 180) * gridConfig.hexRadius * triggerRange + 1.0,
      triggerName,
      {
        fontSize: "14px",
        color: `#${color.toString(16).padStart(6, '0')}`,
        backgroundColor: "#ffffffdd",
        padding: { x: 8, y: 4 },
        fontStyle: "bold",
      });

    this.setOrigin(0.5);
    this.setDepth(3);
    this.visible = visible;

    scene.add.existing(this);
  }
}