'use client';
import "phaser";

/**
 * ゲームのアセットを読み込むクラス
 * PhaserのLoaderPluginを拡張して、ゲーム関連の画像の読み込みを行う
 */
export class GameAssetsLoader {

  constructor(scene: Phaser.Scene) {
    scene.load.image("gameBackground", "/game/field/field.svg");
    scene.load.image(
      "shield_hexagon_blue",
      "/game/shields/shield_hexagon_blue.svg"
    );
    scene.load.image(
      "shield_hexagon_red",
      "/game/shields/shield_hexagon_red.svg"
    );
    scene.load.image(
      "shield_hexagon_yellow",
      "/game/shields/shield_hexagon_yellow.svg"
    );
    scene.load.image("avoid", "/game/avoid/avoid.svg");
  }
}