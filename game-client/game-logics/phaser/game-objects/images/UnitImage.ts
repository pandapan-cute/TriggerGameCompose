import { GridConfig } from "@/app/game/[gameId]/page";

/**
 * ユニットの画像を表すクラス
 */
export class UnitImage extends Phaser.GameObjects.Image {

  constructor(scene: Phaser.Scene, x: number, y: number, unitTypeId: string, private gridConfig: GridConfig) {

    super(scene, x, y, unitTypeId);
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(
      this.gridConfig.hexRadius * 1.2,
      this.gridConfig.hexRadius * 1.2
    ); // 六角形に合わせたサイズ
    this.setDepth(2); // 前面に表示

    // キャラクターをクリック可能にする
    this.setInteractive();
  }

  /**
   * ユニットの画像を更新する
   * @param unitTypeId - 新しいユニットのタイプID。これが画像のパスになる。
   */
  updateUnitImage(unitTypeId: string) {
    this.setTexture(unitTypeId);
    this.setDisplaySize(
      this.gridConfig.hexRadius * 1.2,
      this.gridConfig.hexRadius * 1.2
    );
  }

  /**
   * ユニットの可視性を更新する
   */
  updateVisibility(isVisible: boolean) {
    this.setVisible(isVisible);
  }

  /** ユニットを移動させるアニメーション */
  moveUnitTween(targetX: number, targetY: number, duration: number = 750, onUpdate: () => void, onComplete: () => void) {
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: duration,
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