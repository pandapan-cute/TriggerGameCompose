import * as THREE from 'three';
import { ExtendedObject3D, Scene3D } from '@enable3d/phaser-extension';
import { HexUtils } from '@/game-logics/hexUtils';

/**
 * 立体的な六角形セル（単体）を表すクラス
 */
export class ThreeDHexagonCell extends ExtendedObject3D {

  private hexUtils: HexUtils;
  private centerPos: { x: number; y: number; };
  private mesh: THREE.Mesh;
  private material: THREE.MeshStandardMaterial;

  constructor(hexUtils: HexUtils, scene: Scene3D, pos: { x: number; y: number; }) {
    super();
    this.hexUtils = hexUtils;
    this.centerPos = pos;

    // 1. 六角形の平面形状（パス）を作成
    const hexShape = this.createHexagonShape(this.centerPos);

    // 2. ほんの少しだけ上に押し出す（厚みを持たせる）設定
    const extrudeSettings = {
      depth: 0.1,           // 💡 六角形の厚み（ごくわずか）
      bevelEnabled: true,   // 角を少し滑らかにしてエッジを綺麗に見せる
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1
    };

    const geometry = new THREE.ExtrudeGeometry(hexShape, extrudeSettings);

    // 3. マテリアルの設定（初期値はグレー）
    this.material = new THREE.MeshStandardMaterial({
      color: 0x78909C,
      roughness: 0.4,
      metalness: 0.1
    });

    // 4. メッシュを生成して自身に追加
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.add(this.mesh);

    // 5. 3D空間のシーン（親）に自身を登録
    // ExtrudeGeometry は初期状態だと XY 平面に立つので、地面として使うために寝かせる
    this.rotation.x = -Math.PI / 2;
    this.scale.set(0.1, 0.1, 0.1); // 必要に応じてスケールを調整
    this.position.set(0, 0, 0); // 必要に応じて位置を調整
    scene.third.add.existing(this);
  }

  /**
   * 視認可能エリアのセルに切り替える
   * （白に変更）
   */
  public switchCanSight(): void {
    this.material.color.setHex(0xffffff);
  }

  /**
   * 視認不可能エリアのセルに切り替える
   * （グレーに変更）
   */
  public switchCannotSight(): void {
    this.material.color.setHex(0x78909C);
  }

  /** 六角形の2Dパスを生成するヘルパー関数 */
  private createHexagonShape(pos: { x: number; y: number; }): THREE.Shape {
    const shape = new THREE.Shape();

    // 元のクラス同様、hexUtils から指定座標の頂点配列を取得
    const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);

    if (vertices && vertices.length >= 2) {
      shape.moveTo(vertices[0], vertices[1]);
      for (let i = 2; i < vertices.length; i += 2) {
        shape.lineTo(vertices[i], vertices[i + 1]);
      }
    }

    return shape;
  }
}