import { ActionPointCircle } from "../graphics/ActionPointCircle";
import { ActionPointImage } from "../images/ActionPointImage";
/**
 * 行動力表示ウィジェットを管理するクラス
 */
export class ActionPointsWidget {

  /** 行動力アイコン */
  private actionPointImage: ActionPointImage | null = null;
  /** 行動力の円形グラフィック */
  private actionPointCircle: ActionPointCircle | null = null;

  constructor(private scene: Phaser.Scene, pixelPos: { x: number; y: number; }) {
    // 新しいアイコンを作成
    this.actionPointImage = new ActionPointImage(
      this.scene,
      pixelPos.x,
      pixelPos.y
    );
    this.scene.add.existing(this.actionPointImage);

    // 新しい円形グラフィックを作成
    this.actionPointCircle = new ActionPointCircle(
      this.scene,
      { x: pixelPos.x, y: pixelPos.y }
    );

    this.scene.add.existing(this.actionPointCircle);
  }

  public updateActionPointsDisplay(pixelPos: { x: number; y: number; }, maxPoints: number, currentPoints: number) {
    if (this.actionPointCircle && this.actionPointImage) {
      this.actionPointCircle.updatePoint(pixelPos, maxPoints, currentPoints);
      this.actionPointImage.setPosition(pixelPos.x, pixelPos.y);
      return;
    }

    if (!this.actionPointCircle) {
      this.actionPointCircle = new ActionPointCircle(
        this.scene,
        { x: pixelPos.x, y: pixelPos.y }
      );
      this.scene.add.existing(this.actionPointCircle);
      this.actionPointCircle.updatePoint(pixelPos, maxPoints, currentPoints);
    }

    if (!this.actionPointImage) {
      this.actionPointImage = new ActionPointImage(
        this.scene,
        pixelPos.x,
        pixelPos.y
      );
      this.scene.add.existing(this.actionPointImage);
    }
  }

  public destroy() {
    this.actionPointCircle?.destroy();
    this.actionPointCircle = null;
    this.actionPointImage?.destroy();
    this.actionPointImage = null;
  }
}