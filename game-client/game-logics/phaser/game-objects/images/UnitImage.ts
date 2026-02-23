import { GridConfig } from "@/app/game/[gameId]/page";
import { Position } from "@/game-logics/types";

/**
 * ユニットの画像を表すクラス
 */
export class UnitImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number, unitTypeId: string, gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId);
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(
      gridConfig.hexRadius * 1.2,
      gridConfig.hexRadius * 1.2
    ); // 六角形に合わせたサイズ
    this.setDepth(2); // 前面に表示

    // キャラクターをクリック可能にする
    this.setInteractive();
  }

  /** ユニットを移動させるアニメーション */
  moveUnitTween(targetX: number, targetY: number, onUpdate: () => void, onComplete: () => void) {
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 750,
      ease: "Power2",
      onUpdate: onUpdate,
      onComplete: onComplete
    });
  }

  /** 回避テキストを表示する */
  showAvoidImage() {
    const avoidImage = this.scene.add.image(
      this.x,
      this.y,
      "avoid"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: avoidImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        avoidImage.destroy();
      },
    });
  }

  /**
   * ダメージテキストを表示する
   * @param damage - ダメージによってシールドカラーを変更
   */
  showShieldImage(
    damage: number
  ) {
    const shieldImage = this.scene.add.image(
      this.x,
      this.y,
      damage >= 50 ? "shield_hexagon_blue" : damage >= 20 ? "shield_hexagon_yellow" : "shield_hexagon_red"
    );

    // 一秒で消す
    this.scene.tweens.add({
      targets: shieldImage,
      alpha: 0,
      duration: 1000,
      ease: "Power2",
      onComplete: () => {
        shieldImage.destroy();
      },
    });
  }

  /**
   * アニメーション付きの矢印を描画
   * @param fromCharacter - 矢印の始点となるキャラクターのImageオブジェクト
   * @param toCharacter - 矢印の終点となるキャラクターのImageオブジェクト
   * @param color - 矢印の色（デフォルトは赤色0xff0000）
   * @returns 描画した矢印のGraphicsオブジェクト
   */
  drawAnimatedArrowBetweenCharacters(
    defenderPos: { x: number; y: number; },
  ): Phaser.GameObjects.Graphics {
    const fromX = this.x;
    const fromY = this.y;
    const toX = defenderPos.x;
    const toY = defenderPos.y;
    const arrowGraphics = this.drawArrow(this.scene, fromX, fromY, toX, toY);
    arrowGraphics.setAlpha(0);

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: arrowGraphics,
      alpha: 1,
      duration: 250,
      delay: 0,
      ease: "Power2",
      onComplete: () => {
        arrowGraphics.destroy();
      },
    });
    return arrowGraphics;
  }


  /**
   * 2点間に矢印を描画する関数
   * @param {Phaser.Scene} scene - シーンオブジェクト
   * @param {number} x1 - 始点のX座標
   * @param {number} y1 - 始点のY座標
   * @param {number} x2 - 終点のX座標
   * @param {number} y2 - 終点のY座標
   * @returns {Phaser.GameObjects.Graphics} Graphicsオブジェクト
   */
  private drawArrow(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics({
      lineStyle: { width: 4, color: 0x0091EA },
      fillStyle: { color: 0x0091EA }
    });

    const arrowSize = 15; // 矢印の先端の大きさ

    // 線の描画
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.stroke();
    graphics.setDepth(1); // トリガー扇形より前面に表示

    // 矢印の角度を計算 (ラジアン)
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);

    // 先端の三角形を描画
    // 角度から少しずらした3点を計算し、終点に配置
    graphics.fillTriangle(
      x2,
      y2,
      x2 - Math.cos(angle - Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle - Math.PI / 6) * arrowSize,
      x2 - Math.cos(angle + Math.PI / 6) * arrowSize,
      y2 - Math.sin(angle + Math.PI / 6) * arrowSize
    );

    return graphics;
  }

  /**
   * ベイルアウト表示と撃破されたキャラクターの削除
   * @param character - 撃破されたキャラクター
   * @param onDestroy - キャラクター削除時に実行するコールバック関数
   */
  showBailOutAndRemoveCharacter() {
    // ベイルアウトテキストを作成
    const bailOutText = this.scene.add.text(
      this.x,
      this.y - 20,
      "ベイルアウト",
      {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        backgroundColor: "#000000",
        padding: { x: 6, y: 3 },
      }
    );
    bailOutText.setOrigin(0.5);
    bailOutText.setDepth(10); // 最前面に表示

    // ベイルアウトテキストのアニメーション
    this.scene.tweens.add({
      targets: bailOutText,
      y: this.y - 40,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        bailOutText.destroy();
      },
    });

    // キャラクターを徐々に透明にして削除
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 1000,
      delay: 500, // ベイルアウトテキスト表示後少し待ってから開始
      ease: "Power2",
      onComplete: () => {
        this.destroy();
      },
    });
  }
}