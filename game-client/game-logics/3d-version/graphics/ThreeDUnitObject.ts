import { ExtendedObject3D, Scene3D } from "@enable3d/phaser-extension";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { NormalAnimationBlendMode } from "three";

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
  /** 到達後に向けるデフォルト向き（敵陣側）。 */
  private static readonly DEFAULT_ENEMY_TERRITORY_YAW = Math.PI;

  private readonly scene3d: Scene3D;
  private readonly unitTypeId: string;
  private readonly gltfLoader: GLTFLoader;
  private readonly dracoLoader: DRACOLoader;
  private modelRoot: THREE.Object3D | null = null;
  private bodyModel: THREE.Object3D | null = null;
  private currentHeadMesh: THREE.Object3D | null = null;
  private headBone: THREE.Bone | null = null;
  private gltfAnimationMixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private readonly animationNames = new Set<string>();
  private readonly animationActions = new Map<string, THREE.AnimationAction>();
  private selectUnit?: () => void;

  constructor(scene: Scene3D, unitTypeId: string, x: number, y: number, z: number = 0) {
    super();
    this.scene3d = scene;
    this.unitTypeId = unitTypeId;
    this.name = `3d-unit-${unitTypeId}-${this.id}`;
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("/lib/draco/");
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    this.position.set(x, y, z);
    this.scene3d.third.add.existing(this);

    this.scene3d.events.on("update", this.handleSceneUpdate, this);
    this.scene3d.events.once("shutdown", () => {
      console.info(`dispose を実行 unit=${this.unitTypeId}`);
      this.scene3d.events.off("update", this.handleSceneUpdate, this);
      this.dracoLoader.dispose();
    });
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
   * GLBモデルを読み込んで現在のユニット表示を置き換える
   */
  async loadModel(modelPath: string, scale: number): Promise<void> {
    console.info(`[ThreeDUnitObject] loadModel:start unit=${this.unitTypeId} path=${modelPath}`);
    const gltf = await this.gltfLoader.loadAsync(modelPath);
    const object = gltf.scene;

    this.modelRoot?.removeFromParent();
    this.modelRoot = object;
    this.bodyModel = object;
    this.add(object);

    const boundingBox = new THREE.Box3().setFromObject(object);
    const bboxSize = boundingBox.getSize(new THREE.Vector3());
    const bboxCenter = boundingBox.getCenter(new THREE.Vector3());
    console.info(
      `[ThreeDUnitObject] body-bbox unit=${this.unitTypeId} size=(${bboxSize.x.toFixed(3)}, ${bboxSize.y.toFixed(3)}, ${bboxSize.z.toFixed(3)}) center=(${bboxCenter.x.toFixed(3)}, ${bboxCenter.y.toFixed(3)}, ${bboxCenter.z.toFixed(3)})`
    );

    this.traverse((child) => {
      if (!hasShadowProps(child)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    this.scale.set(scale, scale, scale);
    this.gltfAnimationMixer = new THREE.AnimationMixer(object);
    this.animationActions.clear();
    this.animationNames.clear();
    this.currentAction = null;

    if (gltf.animations.length > 0 && this.gltfAnimationMixer) {
      const idleKey = this.toAnimationKey("Idle");
      const idleAction = this.gltfAnimationMixer.clipAction(gltf.animations[0], object);
      this.animationActions.set(idleKey, idleAction);
      this.animationNames.add(idleKey);
      idleAction.play();
      this.currentAction = idleAction;
      console.info(`[ThreeDUnitObject] idle-clip:registered unit=${this.unitTypeId} key=${idleKey}`);
    } else {
      console.warn(`[ThreeDUnitObject] idle-clip:missing unit=${this.unitTypeId} path=${modelPath}`);
    }

    console.info(`[ThreeDUnitObject] loadModel:done unit=${this.unitTypeId} path=${modelPath}`);
  }

  /**
   * ユニット種別に応じた待機モデルを読み込む。
   * 共通の体モデルに頭部モデルを差し込んで表示する。
   */
  async loadDefaultModel(scale: number = 72): Promise<void> {
    try {
      // 共通体モデルを優先して読み込む（現行アセット配置に合わせる）。
      await this.loadModel("/character/3d/motions/Idle.glb", scale);
      await this.attachHeadModel();
      await this.registerDefaultAnimations();
    } catch (error) {
      console.error(`[ThreeDUnitObject] loadDefaultModelの実行に失敗しました。 unit=${this.unitTypeId} error=${error}`);
    }
  }

  /**
   * アニメーション(GLB)を読み込んで登録する
   */
  async addAnimation(name: string, animationPath: string): Promise<void> {
    if (!this.gltfAnimationMixer || !this.modelRoot) {
      console.warn(`[ThreeDUnitObject] addAnimationはスキップしました。 unit=${this.unitTypeId} name=${name} mixerOrBodyMissing=true`);
      return;
    }

    console.info(`[ThreeDUnitObject] addAnimation:start unit=${this.unitTypeId} name=${name} path=${animationPath}`);

    const gltf = await this.gltfLoader.loadAsync(animationPath);
    if (!gltf.animations.length) {
      console.warn(`[ThreeDUnitObject] addAnimation:noClips unit=${this.unitTypeId} name=${name} path=${animationPath}`);
      return;
    }

    const animationKey = this.toAnimationKey(name);
    const action = this.gltfAnimationMixer.clipAction(gltf.animations[0], this.modelRoot!, NormalAnimationBlendMode);
    this.animationActions.set(animationKey, action);
    this.animationNames.add(animationKey);
    console.info(`[ThreeDUnitObject] addAnimation:done unit=${this.unitTypeId} key=${animationKey}`);
  }

  /**
   * 登録済みアニメーションを再生する
   */
  playAnimation(name: string, transitionDurationMs: number = 350): void {
    const resolvedName = this.resolveAnimationName(name);
    if (!resolvedName) return;

    const nextAction = this.animationActions.get(resolvedName);
    if (!nextAction) return;
    if (this.currentAction === nextAction) return;

    if (this.currentAction) {
      this.currentAction.crossFadeTo(nextAction, transitionDurationMs / 1000, false);
    }

    nextAction.reset().play();
    this.currentAction = nextAction;
  }

  /**
   * 盤面上の座標へ移動する
   */
  setWorldPosition(x: number, y: number, z: number = 0): void {
    this.position.set(x, y, z);
  }

  /**
   * 指定座標の方向へ体の向きを合わせる（Y軸のみ）。
   * @param to 向き先のワールド座標。
   */
  faceToward(to: { x: number; y: number; z: number; }): void {
    const deltaX = to.x - this.position.x;
    const deltaZ = to.z - this.position.z;
    const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
    if (distanceSq <= 1e-8) return;

    this.rotation.y = Math.atan2(deltaX, deltaZ);
  }

  /**
   * 体の向きを敵陣側を向くデフォルト角度に戻す。
   */
  faceEnemyTerritoryDefault(): void {
    this.rotation.y = ThreeDUnitObject.DEFAULT_ENEMY_TERRITORY_YAW;
  }

  /**
   * 指定座標まで補間移動する
   */
  moveTo(
    to: { x: number; y: number; z: number; },
    durationMs: number,
    onComplete?: () => void,
  ): void {
    const from = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };

    this.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: durationMs,
      ease: "Linear",
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        this.setWorldPosition(
          from.x + (to.x - from.x) * progress,
          from.y + (to.y - from.y) * progress,
          from.z + (to.z - from.z) * progress,
        );
      },
      onComplete: () => {
        this.setWorldPosition(to.x, to.y, to.z);
        onComplete?.();
      },
    });
  }

  /**
   * ユニットの可視状態を切り替える
   */
  updateVisibility(isVisible: boolean): void {
    this.visible = isVisible;
  }

  /**
   * ユニットのデフォルトアニメーションを登録する
   */
  private async registerDefaultAnimations(): Promise<void> {
    const animationNames = ["Running"];
    console.info(`[ThreeDUnitObject] registerDefaultAnimations:start unit=${this.unitTypeId} names=${animationNames.join(",")}`);
    await Promise.all(
      animationNames.map(async (name) =>
        await this.addAnimation(name, `/character/3d/motions/${name}.glb`)
      )
    );
    console.info(`[ThreeDUnitObject] registerDefaultAnimations:done unit=${this.unitTypeId}`);
  }

  /**
   * 頭部モデルをアタッチする
   * @returns {void}
   */
  private async attachHeadModel(): Promise<void> {
    const bodyModel = this.bodyModel;
    if (!bodyModel) return;

    console.info(`[ThreeDUnitObject] attachHeadModel:start unit=${this.unitTypeId}`);

    this.headBone = this.findHeadBone(bodyModel);
    if (!this.headBone) {
      console.error("頭部のボーン（Head）が見つかりませんでした");
      return;
    }

    if (this.currentHeadMesh) {
      this.headBone.remove(this.currentHeadMesh);
      this.currentHeadMesh = null;
    }

    try {
      console.info(`[ThreeDUnitObject] attachHeadModel:try unitHead unit=${this.unitTypeId}`);
      const headGltf = await this.gltfLoader.loadAsync(`/character/3d/${this.unitTypeId}/head.glb`);
      this.currentHeadMesh = headGltf.scene;
      this.headBone.add(this.currentHeadMesh);
      console.info(`[ThreeDUnitObject] attachHeadModel:done unit=${this.unitTypeId} source=unit`);
      return;
    } catch {
      // ユニット固有の頭部がない場合は UNKNOWN にフォールバック。
      console.warn(`[ThreeDUnitObject] attachHeadModel:unitHeadMissing unit=${this.unitTypeId}`);
    }

    try {
      console.info(`[ThreeDUnitObject] attachHeadModel:try unknownHead unit=${this.unitTypeId}`);
      const unknownHeadGltf = await this.gltfLoader.loadAsync("/character/3d/UNKNOWN/head.glb");
      this.currentHeadMesh = unknownHeadGltf.scene;
      this.headBone.add(this.currentHeadMesh);
      console.info(`[ThreeDUnitObject] attachHeadModel:done unit=${this.unitTypeId} source=unknown`);
      return;
    } catch {
      // UNKNOWN 側にも頭部がない場合は警告のみ出す。
      console.warn(`[ThreeDUnitObject] attachHeadModel:unknownHeadMissing unit=${this.unitTypeId}`);
    }

    console.warn(`[ThreeDUnitObject] ${this.unitTypeId} の頭部モデルが見つかりませんでした`);
  }

  private toAnimationKey(name: string): string {
    if (name.startsWith(`${this.unitTypeId}_`)) {
      return name;
    }
    return `${this.unitTypeId}_${name}`;
  }

  private resolveAnimationName(name: string): string | null {
    const typedName = this.toAnimationKey(name);
    if (this.animationNames.has(typedName)) {
      return typedName;
    }
    if (this.animationNames.has(name)) {
      return name;
    }
    return null;
  }

  /**
   * 頭部のボーン（Head）を検索する
   * @param root ルートオブジェクト
   * @returns 見つかった頭部のボーン、見つからなければnull
   */
  private findHeadBone(root: THREE.Object3D): THREE.Bone | null {
    let found: THREE.Bone | null = null;
    root.traverse((object) => {
      if (found) return;
      if (object instanceof THREE.Bone && object.name.includes("Head")) {
        found = object;
      }
    });
    return found;
  }

  private handleSceneUpdate(_time: number, delta: number): void {
    if (!this.gltfAnimationMixer) return;
    this.gltfAnimationMixer.update(delta / 1000);
  }
}
