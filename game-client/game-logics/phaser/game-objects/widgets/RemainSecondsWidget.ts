import { RemainSecondsImage } from "../images/RemainSecondsImage";
import { RemainSecondsText } from "../texts/RemainSecondsText";

/**
 * 残り時間表示ウィジェットを管理するクラス
 */
export class RemainSecondsWidget {

  /** 残り時間アイコン */
  private remainSecondsImage: RemainSecondsImage | null = null;
  /** 残り時間テキスト */
  private remainSecondsText: RemainSecondsText | null = null;

  constructor(private scene: Phaser.Scene) { }

  public updateRemainSecondsDisplay(pixelPos: { x: number; y: number; }, remainSeconds: number) {
    if (this.remainSecondsText && this.remainSecondsImage) {
      this.remainSecondsImage.setPosition(pixelPos.x, pixelPos.y + 22);
      this.remainSecondsText.setPosition(pixelPos.x, pixelPos.y + 22);
      this.remainSecondsText.updateRemainSeconds(remainSeconds);
      return;
    }

    // 新しいアイコンを作成
    this.remainSecondsImage = new RemainSecondsImage(
      this.scene,
      pixelPos.x,
      pixelPos.y + 22
    );
    this.scene.add.existing(this.remainSecondsImage);

    // 新しいテキストを作成
    this.remainSecondsText = new RemainSecondsText(
      this.scene,
      pixelPos.x,
      pixelPos.y + 22,
      remainSeconds
    );

    this.scene.add.existing(this.remainSecondsText);
  }

  public destroy() {
    this.remainSecondsText?.destroy();
    this.remainSecondsText = null;
    this.remainSecondsImage?.destroy();
    this.remainSecondsImage = null;
  }
}