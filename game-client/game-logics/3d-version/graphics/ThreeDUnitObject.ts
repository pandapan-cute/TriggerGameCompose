import { ExtendedObject3D, Scene3D } from "@enable3d/phaser-extension";
import * as THREE from "three";

const hasShadowProps = (object: THREE.Object3D): object is THREE.Object3D & {
  castShadow: boolean;
  receiveShadow: boolean;
} => {
  return "castShadow" in object && "receiveShadow" in object;
};

/**
 * 3D版のユニット表示オブジェクト
 *
 * - 盤面上への配置
 * - FBXモデルの読み込み
 * - 可視状態の切り替え
 * - 最低限のアニメーション再生
 */
export class ThreeDUnitObject extends ExtendedObject3D {
  private readonly scene3d: Scene3D;
  private readonly fallbackMesh: THREE.Mesh;
  private modelRoot: THREE.Object3D | null = null;
  private readonly animationNames = new Set<string>();
  private selectUnit?: () => void;

  constructor(scene: Scene3D, unitTypeId: string, x: number, y: number, z: number = 0) {
    super();
    this.scene3d = scene;
    this.name = `3d-unit-${unitTypeId}-${this.id}`;

    // モデルロード前でも盤面で位置確認できるように簡易メッシュを持たせる
    this.fallbackMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4f83cc, roughness: 0.45, metalness: 0.1 }),
    );
    this.fallbackMesh.castShadow = true;
    this.fallbackMesh.receiveShadow = true;
    this.add(this.fallbackMesh);

    this.position.set(x, y, z);
    this.scene3d.third.add.existing(this);
  }

  /** ユニット選択時のハンドラを設定する */
  setSelectUnitHandler(handler: () => void): void {
    this.selectUnit = handler;
  }

  /** ユニット選択処理を実行する */
  triggerSelectUnit(): void {
    this.selectUnit?.();
  }

  /**
   * FBXモデルを読み込んで現在のユニット表示を置き換える
   */
  async loadModel(modelPath: string, scale: number = 0.05): Promise<void> {
    const object = await this.scene3d.third.load.fbx(modelPath);

    this.modelRoot?.removeFromParent();
    this.modelRoot = object;
    this.add(object);

    this.fallbackMesh.visible = false;

    this.traverse((child) => {
      if (!hasShadowProps(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    this.scale.set(scale, scale, scale);
    this.scene3d.third.animationMixers.add(this.anims.mixer);

    if (object.animations.length > 0) {
      this.anims.add("Idle", object.animations[0]);
      this.animationNames.add("Idle");
      this.anims.play("Idle");
    }
  }

  /**
   * 追加アニメーションを読み込んで登録する
   */
  async addAnimation(name: string, animationPath: string): Promise<void> {
    const object = await this.scene3d.third.load.fbx(animationPath);
    if (!object.animations.length) return;

    this.anims.add(name, object.animations[0]);
    this.animationNames.add(name);
  }

  /**
   * 登録済みアニメーションを再生する
   */
  playAnimation(name: string, transitionDurationMs: number = 350): void {
    if (!this.animationNames.has(name)) return;
    this.anims.play(name, transitionDurationMs);
  }

  /**
   * 盤面上の座標へ移動する
   */
  setWorldPosition(x: number, y: number, z: number = 0): void {
    this.position.set(x, y, z);
  }

  /**
   * ユニットの可視状態を切り替える
   */
  updateVisibility(isVisible: boolean): void {
    this.visible = isVisible;
  }
}
