'use client';
import "phaser";

/**
 * キャラクターのイメージを読み込むクラス
 * PhaserのLoaderPluginを拡張して、キャラクター画像の読み込みを行う
 */
export class UnitImageLoader {

  constructor(scene: Phaser.Scene) {
    scene.load.image("UNKNOWN", "/character/UNKNOWN.svg");
    scene.load.image("MIKUMO_OSAMU", "/character/MIKUMO_OSAMU.svg");
    scene.load.image("KUGA_YUMA", "/character/KUGA_YUMA.svg");
    scene.load.image("AMATORI_CHIKA", "/character/AMATORI_CHIKA.svg");
    scene.load.image("HYUSE_KURONIN", "/character/HYUSE_KURONIN.svg");
  }
}