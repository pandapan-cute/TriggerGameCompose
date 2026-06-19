import { RemainSecondsText } from "../texts/RemainSecondsText";

/**
 * 行動力表示ウィジェットを管理するクラス
 */
export class RemainSecondsWidget {

  private remainSecondsText: RemainSecondsText | null = null;

  constructor(private scene: Phaser.Scene) { }

  public updateRemainSecondsDisplay(pixelPos: { x: number; y: number; }, remainSeconds: number) {
    if (this.remainSecondsText) {
      this.remainSecondsText.setPosition(pixelPos.x, pixelPos.y + 43);
      this.remainSecondsText.updateRemainSeconds(remainSeconds);
      return;
    }

    // 新しいテキストを作成
    this.remainSecondsText = new RemainSecondsText(
      this.scene,
      pixelPos.x,
      pixelPos.y + 43,
      remainSeconds
    );

    this.scene.add.existing(this.remainSecondsText);
  }

  public destroy() {
    this.remainSecondsText?.destroy();
    this.remainSecondsText = null;
  }
}