import { Scene3D } from "@enable3d/phaser-extension";
import { GridConfig } from "@/game-logics/types";
import * as THREE from "three";

/**
 * 3D トリガー扇形の中心座標。
 */
export interface ThreeDTriggerCenterPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D盤面上にトリガー扇形を表示するオブジェクト。
 */
export class ThreeDTriggerFanObject extends THREE.Object3D {
  /** 扇形を描画する本体メッシュ。 */
  private fanMesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null = null;

  /**
   * @param scene 3D シーン。
   * @param center 扇形中心。
   * @param color 扇形色。
   * @param directionDeg 方位角（度）。
   * @param triggerAngleDeg 扇形角度（度）。
   * @param triggerRange 射程（グリッド単位）。
   * @param gridConfig グリッド設定。
   * @param visible 初期表示状態。
   */
  constructor(
    private readonly scene: Scene3D,
    center: ThreeDTriggerCenterPosition,
    color: number,
    directionDeg: number,
    triggerAngleDeg: number,
    triggerRange: number,
    private readonly gridConfig: GridConfig,
    visible: boolean,
  ) {
    super();
    this.name = `3d-trigger-fan-${this.id}`;
    this.position.set(center.x, center.y, center.z);
    this.visible = visible;

    this.scene.third.add.existing(this);
    this.updateTriggerAzimuth(directionDeg, center, color, triggerAngleDeg, triggerRange, visible);
  }

  /**
   * 扇形の向き・位置・角度・射程を更新する。
   * @param directionDeg 方位角（度）。
   * @param center 扇形中心。
   * @param color 扇形色。
   * @param triggerAngleDeg 扇形角度（度）。
   * @param triggerRange 射程（グリッド単位）。
   * @param visible 表示状態。
   */
  public updateTriggerAzimuth(
    directionDeg: number,
    center: ThreeDTriggerCenterPosition,
    color: number,
    triggerAngleDeg: number,
    triggerRange: number,
    visible: boolean,
  ): void {
    this.position.set(center.x, center.y, center.z);
    this.visible = visible;
    this.rebuildFanMesh(directionDeg, color, triggerAngleDeg, triggerRange);
  }

  /**
   * 扇形表示に使用するメッシュを破棄する。
   */
  public dispose(): void {
    if (this.fanMesh) {
      this.fanMesh.geometry.dispose();
      this.fanMesh.material.dispose();
      this.fanMesh.removeFromParent();
      this.fanMesh = null;
    }
    this.removeFromParent();
  }

  /**
   * 現在の設定値で扇形メッシュを再生成する。
   * @param directionDeg 方位角（度）。
   * @param color 扇形色。
   * @param triggerAngleDeg 扇形角度（度）。
   * @param triggerRange 射程（グリッド単位）。
   */
  private rebuildFanMesh(
    directionDeg: number,
    color: number,
    triggerAngleDeg: number,
    triggerRange: number,
  ): void {
    if (this.fanMesh) {
      this.fanMesh.geometry.dispose();
      this.fanMesh.material.dispose();
      this.fanMesh.removeFromParent();
      this.fanMesh = null;
    }

    const radius = this.gridConfig.hexHeight * (triggerRange + 0.5);
    const correctedDirectionRad = THREE.MathUtils.degToRad(directionDeg - 90);
    const halfAngle = THREE.MathUtils.degToRad(triggerAngleDeg / 2);
    const thetaStart = correctedDirectionRad - halfAngle;
    const thetaLength = THREE.MathUtils.degToRad(triggerAngleDeg);

    const geometry = new THREE.CircleGeometry(radius, 64, thetaStart, thetaLength);
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.fanMesh = new THREE.Mesh(geometry, material);
    this.fanMesh.renderOrder = 15;
    this.add(this.fanMesh);
  }
}