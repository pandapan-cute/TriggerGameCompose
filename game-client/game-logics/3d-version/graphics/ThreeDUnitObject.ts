import { ExtendedObject3D, Scene3D } from "@enable3d/phaser-extension";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { NormalAnimationBlendMode } from "three";
import { TRIGGER_STATUS } from "@/game-logics/config/status";

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
  /** ジャンプ前動作に使う時間の比率。 */
  private static readonly JUMP_TAKEOFF_RATIO = 0.3;
  /** 着地動作に使う時間の比率。 */
  private static readonly JUMP_LANDING_RATIO = 0.3;
  /** 右手ボーン探索時に許容するボーン名候補。 */
  private static readonly RIGHT_HAND_BONE_KEYWORDS = ["RightHand", "Hand.R", "右手", "mixamorigRightHand"];
  /** 左手ボーン探索時に許容するボーン名候補。 */
  private static readonly LEFT_HAND_BONE_KEYWORDS = ["LeftHand", "Hand.L", "左手", "mixamorigLeftHand"];

  private readonly scene3d: Scene3D;
  private readonly unitTypeId: string;
  private readonly gltfLoader: GLTFLoader;
  private readonly dracoLoader: DRACOLoader;
  private modelRoot: THREE.Object3D | null = null;
  private bodyModel: THREE.Object3D | null = null;
  private currentHeadMesh: THREE.Object3D | null = null;
  private currentHeadUnitTypeId: string | null = null;
  private headBone: THREE.Bone | null = null;
  private headModelUpdateToken = 0;
  private gltfAnimationMixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private readonly animationNames = new Set<string>();
  private readonly animationActions = new Map<string, THREE.AnimationAction>();
  private selectUnit?: () => void;
  /** 手持ちトリガー同期に使う右手ボーン。 */
  private rightHandBone: THREE.Bone | null = null;
  /** 手持ちトリガー同期に使う左手ボーン。 */
  private leftHandBone: THREE.Bone | null = null;
  /** 現在右手に表示中のトリガーID。 */
  private currentRightTriggerId: TriggerStatusKey | null = null;
  /** 現在左手に表示中のトリガーID。 */
  private currentLeftTriggerId: TriggerStatusKey | null = null;
  /** 現在右手にアタッチされているトリガーモデル。 */
  private rightHandTriggerModel: THREE.Object3D | null = null;
  /** 現在左手にアタッチされているトリガーモデル。 */
  private leftHandTriggerModel: THREE.Object3D | null = null;
  /** モデル未ロード時に後から適用するメイントリガーID。 */
  private pendingMainTriggerId: string | null = null;
  /** モデル未ロード時に後から適用するサブトリガーID。 */
  private pendingSubTriggerId: string | null = null;
  /** 右手トリガー更新の競合を防ぐ更新トークン。 */
  private rightHandTriggerUpdateToken = 0;
  /** 左手トリガー更新の競合を防ぐ更新トークン。 */
  private leftHandTriggerUpdateToken = 0;

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
    this.resetHandTriggerState();
    this.modelRoot = object;
    this.bodyModel = object;
    this.add(object);
    this.resolveHandBones();

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

    // モデル差し替え前に要求されていたトリガー表示を、ボーン解決後に再適用する。
    await this.applyPendingTriggerVisuals();

    console.info(`[ThreeDUnitObject] loadModel:done unit=${this.unitTypeId} path=${modelPath}`);
  }

  /**
   * ユニット種別に応じた待機モデルを読み込む。
   * 共通の体モデルに頭部モデルを差し込んで表示する。
   */
  async loadDefaultModel(scale: number = 36): Promise<void> {
    try {
      // 共通体モデルを優先して読み込む（現行アセット配置に合わせる）。
      await this.loadModel("/character/3d/motions/Idle.glb", scale);
      await this.attachHeadModel(this.unitTypeId);
      await this.registerDefaultAnimations();
    } catch (error) {
      console.error(`[ThreeDUnitObject] loadDefaultModelの実行に失敗しました。 unit=${this.unitTypeId} error=${error}`);
    }
  }

  /**
   * 3Dユニットの head を指定ユニット種別に差し替える。
   *
   * 敵ユニットが視界に入ったときなど、後から unitTypeId が判明した場合に使う。
   */
  public async updateHeadModel(headUnitTypeId: string): Promise<void> {
    if (this.currentHeadUnitTypeId === headUnitTypeId) {
      return;
    }

    await this.attachHeadModel(headUnitTypeId);
  }

  /**
   * 3Dユニットの見た目をまとめて同期する。
   *
   * CharacterImageState のように、呼び出し側は 1 回の更新で
   * 座標・可視状態・ head の差し替えをまとめて扱える。
   */
  public syncVisualState(options: {
    unitTypeId?: string;
    visible?: boolean;
    position?: { x: number; y: number; z: number; };
    usingMainTriggerId?: string;
    usingSubTriggerId?: string;
  }): void {
    if (options.position) {
      this.setWorldPosition(options.position.x, options.position.y, options.position.z);
    }

    if (typeof options.visible === "boolean") {
      this.updateVisibility(options.visible);
    }

    if (options.unitTypeId) {
      if (this.currentHeadUnitTypeId !== options.unitTypeId) {
        void this.updateHeadModel(options.unitTypeId);
      }
    }

    if (options.usingMainTriggerId !== undefined || options.usingSubTriggerId !== undefined) {
      this.syncEquippedTriggers({
        usingMainTriggerId: options.usingMainTriggerId,
        usingSubTriggerId: options.usingSubTriggerId,
      });
    }
  }

  /**
   * 現在装備中トリガー情報を元に、右手/左手の武器モデルを同期する。
   *
   * - メイントリガー: 右手
   * - サブトリガー: 左手
   */
  public syncEquippedTriggers(options: {
    usingMainTriggerId?: string;
    usingSubTriggerId?: string;
  }): void {
    if (options.usingMainTriggerId !== undefined) {
      this.pendingMainTriggerId = options.usingMainTriggerId;
    }
    if (options.usingSubTriggerId !== undefined) {
      this.pendingSubTriggerId = options.usingSubTriggerId;
    }

    // モデル未ロード時は pending のみ更新し、loadModel 後にまとめて反映する。
    if (!this.bodyModel) {
      return;
    }

    void this.updateHandTrigger("main", this.pendingMainTriggerId);
    void this.updateHandTrigger("sub", this.pendingSubTriggerId);
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
  playAnimation(
    name: string,
    transitionDurationMs: number = 350,
    options?: { loop?: boolean; }
  ): void {
    const resolvedName = this.resolveAnimationName(name);
    if (!resolvedName) return;

    const nextAction = this.animationActions.get(resolvedName);
    if (!nextAction) return;
    if (this.currentAction === nextAction) return;

    if (this.currentAction) {
      this.currentAction.crossFadeTo(nextAction, transitionDurationMs / 1000, false);
    }

    const shouldLoop = options?.loop ?? true;
    if (shouldLoop) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
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
   * モデルを左右反転する。
   *
   * サブトリガー攻撃の見た目を反転させるために使う。
   */
  setHorizontalMirror(isMirrored: boolean): void {
    const currentScaleX = Math.abs(this.scale.x);
    this.scale.x = isMirrored ? -currentScaleX : currentScaleX;
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
    onUpdate?: (position: { x: number; y: number; z: number; }) => void,
  ): void {
    const from = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
    if (!this.isJumpMovement(from.y, to.y)) {
      this.playAnimation("Running", 120);
      this.startMoveTween(from, to, durationMs, onComplete, onUpdate);
      return;
    }

    const takeoffDurationMs = Math.max(
      80,
      Math.round(durationMs * ThreeDUnitObject.JUMP_TAKEOFF_RATIO),
    );
    const landingDurationMs = Math.max(
      80,
      Math.round(durationMs * ThreeDUnitObject.JUMP_LANDING_RATIO),
    );
    const travelDurationMs = Math.max(80, durationMs - takeoffDurationMs - landingDurationMs);

    this.playAnimation("JumpUp", takeoffDurationMs, { loop: false });
    this.scene3d.time.delayedCall(takeoffDurationMs, () => {
      this.startMoveTween(
        from,
        to,
        travelDurationMs,
        () => {
          this.playAnimation("JumpDown", landingDurationMs, { loop: false });
          this.scene3d.time.delayedCall(landingDurationMs, () => {
            this.setWorldPosition(to.x, to.y, to.z);
            onUpdate?.({ x: to.x, y: to.y, z: to.z });
            onComplete?.();
          });
        },
        onUpdate,
      );
    });
  }

  /**
   * 指定座標まで tween で補間移動する。
   */
  private startMoveTween(
    from: { x: number; y: number; z: number; },
    to: { x: number; y: number; z: number; },
    durationMs: number,
    onComplete?: () => void,
    onUpdate?: (position: { x: number; y: number; z: number; }) => void,
  ): void {
    this.scene3d.tweens.addCounter({
      from: 0,
      to: 1,
      duration: durationMs,
      ease: "Linear",
      onUpdate: (tween) => {
        const progress = tween.getValue() ?? 0;
        const currentPosition = {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
          z: from.z + (to.z - from.z) * progress,
        };

        this.setWorldPosition(
          currentPosition.x,
          currentPosition.y,
          currentPosition.z,
        );
        onUpdate?.(currentPosition);
      },
      onComplete: () => {
        this.setWorldPosition(to.x, to.y, to.z);
        onUpdate?.({ x: to.x, y: to.y, z: to.z });
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
    const animationNames = ["Running", "JumpUp", "JumpDown"];
    console.info(`[ThreeDUnitObject] registerDefaultAnimations:start unit=${this.unitTypeId} names=${animationNames.join(",")}`);
    await Promise.all(
      animationNames.map(async (name) =>
        await this.addAnimation(name, `/character/3d/motions/${name}.glb`)
      )
    );
    console.info(`[ThreeDUnitObject] registerDefaultAnimations:done unit=${this.unitTypeId}`);
  }

  /**
   * 右手・左手に紐づくトリガー表示状態を初期化する。
   */
  private resetHandTriggerState(): void {
    this.rightHandTriggerModel?.removeFromParent();
    this.leftHandTriggerModel?.removeFromParent();
    this.rightHandTriggerModel = null;
    this.leftHandTriggerModel = null;
    this.rightHandBone = null;
    this.leftHandBone = null;
    this.currentRightTriggerId = null;
    this.currentLeftTriggerId = null;
  }

  /**
   * 現在の bodyModel から手ボーンを探索して保持する。
   */
  private resolveHandBones(): void {
    if (!this.bodyModel) {
      this.rightHandBone = null;
      this.leftHandBone = null;
      return;
    }

    this.rightHandBone = this.findBoneByKeywords(this.bodyModel, ThreeDUnitObject.RIGHT_HAND_BONE_KEYWORDS);
    this.leftHandBone = this.findBoneByKeywords(this.bodyModel, ThreeDUnitObject.LEFT_HAND_BONE_KEYWORDS);

    if (!this.rightHandBone) {
      console.warn(`[ThreeDUnitObject] 右手ボーンが見つかりませんでした unit=${this.unitTypeId}`);
    }
    if (!this.leftHandBone) {
      console.warn(`[ThreeDUnitObject] 左手ボーンが見つかりませんでした unit=${this.unitTypeId}`);
    }
  }

  /**
   * モデル未ロード時に積んでいたトリガー反映要求を適用する。
   */
  private async applyPendingTriggerVisuals(): Promise<void> {
    await Promise.all([
      this.updateHandTrigger("main", this.pendingMainTriggerId),
      this.updateHandTrigger("sub", this.pendingSubTriggerId),
    ]);
  }

  /**
   * main/sub の種別に応じて対応する手へトリガーモデルを適用する。
   */
  private async updateHandTrigger(hand: "main" | "sub", triggerId: string | null): Promise<void> {
    const triggerKey = this.toTriggerStatusKey(triggerId);
    const shouldHoldHand = triggerKey ? TRIGGER_STATUS[triggerKey].isHoldHand : false;
    const expectedTriggerKey = shouldHoldHand ? triggerKey : null;

    const targetBone = hand === "main" ? this.rightHandBone : this.leftHandBone;
    const currentTriggerId = hand === "main" ? this.currentRightTriggerId : this.currentLeftTriggerId;
    const currentModel = hand === "main" ? this.rightHandTriggerModel : this.leftHandTriggerModel;

    if (!targetBone) {
      return;
    }

    if (expectedTriggerKey === currentTriggerId) {
      return;
    }

    // 表示対象がない場合は、既存モデルを外して同期完了。
    if (!expectedTriggerKey) {
      currentModel?.removeFromParent();
      if (hand === "main") {
        this.rightHandTriggerModel = null;
        this.currentRightTriggerId = null;
      } else {
        this.leftHandTriggerModel = null;
        this.currentLeftTriggerId = null;
      }
      return;
    }

    const updateToken = hand === "main"
      ? ++this.rightHandTriggerUpdateToken
      : ++this.leftHandTriggerUpdateToken;

    try {
      const gltf = await this.gltfLoader.loadAsync(`/game/weapon/${expectedTriggerKey}.glb`);
      const latestToken = hand === "main" ? this.rightHandTriggerUpdateToken : this.leftHandTriggerUpdateToken;
      if (updateToken !== latestToken) {
        gltf.scene.removeFromParent();
        return;
      }

      currentModel?.removeFromParent();
      targetBone.add(gltf.scene);

      if (hand === "main") {
        this.rightHandTriggerModel = gltf.scene;
        this.currentRightTriggerId = expectedTriggerKey;
      } else {
        this.leftHandTriggerModel = gltf.scene;
        this.currentLeftTriggerId = expectedTriggerKey;
      }

      console.info(`[ThreeDUnitObject] trigger-attached unit=${this.unitTypeId} hand=${hand} trigger=${expectedTriggerKey}`);
    } catch (error) {
      console.warn(`[ThreeDUnitObject] trigger-load-failed unit=${this.unitTypeId} hand=${hand} trigger=${expectedTriggerKey} error=${error}`);
    }
  }

  /**
   * 頭部モデルをアタッチする
   * @returns {void}
   */
  private async attachHeadModel(headUnitTypeId: string = this.unitTypeId): Promise<void> {
    const bodyModel = this.bodyModel;
    if (!bodyModel) return;

    const updateToken = ++this.headModelUpdateToken;
    console.info(`[ThreeDUnitObject] attachHeadModel:start unit=${this.unitTypeId} headUnit=${headUnitTypeId}`);

    this.headBone = this.findHeadBone(bodyModel);
    if (!this.headBone) {
      console.error("頭部のボーン（Head）が見つかりませんでした");
      return;
    }

    try {
      console.info(`[ThreeDUnitObject] attachHeadModel:try unitHead unit=${this.unitTypeId} headUnit=${headUnitTypeId}`);
      const headGltf = await this.gltfLoader.loadAsync(`/character/3d/${headUnitTypeId}/head.glb`);
      if (updateToken !== this.headModelUpdateToken) {
        headGltf.scene.removeFromParent();
        return;
      }

      this.currentHeadMesh?.removeFromParent();
      this.currentHeadMesh = headGltf.scene;
      this.headBone.add(this.currentHeadMesh);
      this.currentHeadUnitTypeId = headUnitTypeId;
      console.info(`[ThreeDUnitObject] attachHeadModel:done unit=${this.unitTypeId} source=unit headUnit=${headUnitTypeId}`);
      return;
    } catch {
      // ユニット固有の頭部がない場合は UNKNOWN にフォールバック。
      console.warn(`[ThreeDUnitObject] attachHeadModel:unitHeadMissing unit=${this.unitTypeId} headUnit=${headUnitTypeId}`);
    }

    try {
      console.info(`[ThreeDUnitObject] attachHeadModel:try unknownHead unit=${this.unitTypeId} headUnit=${headUnitTypeId}`);
      const unknownHeadGltf = await this.gltfLoader.loadAsync("/character/3d/UNKNOWN/head.glb");
      if (updateToken !== this.headModelUpdateToken) {
        unknownHeadGltf.scene.removeFromParent();
        return;
      }

      this.currentHeadMesh?.removeFromParent();
      this.currentHeadMesh = unknownHeadGltf.scene;
      this.headBone.add(this.currentHeadMesh);
      this.currentHeadUnitTypeId = headUnitTypeId;
      console.info(`[ThreeDUnitObject] attachHeadModel:done unit=${this.unitTypeId} source=unknown headUnit=${headUnitTypeId}`);
      return;
    } catch {
      // UNKNOWN 側にも頭部がない場合は警告のみ出す。
      console.warn(`[ThreeDUnitObject] attachHeadModel:unknownHeadMissing unit=${this.unitTypeId} headUnit=${headUnitTypeId}`);
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
   * 高さ差のある移動かどうかを返す。
   */
  private isJumpMovement(fromY: number, toY: number): boolean {
    return Math.abs(toY - fromY) > 1e-3;
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

  /**
   * 指定キーワード群でボーン名を部分一致検索する。
   */
  private findBoneByKeywords(root: THREE.Object3D, keywords: string[]): THREE.Bone | null {
    let found: THREE.Bone | null = null;
    root.traverse((object) => {
      if (found) return;
      if (!(object instanceof THREE.Bone)) return;

      if (keywords.some((keyword) => object.name.includes(keyword))) {
        found = object;
      }
    });
    return found;
  }

  /**
   * 文字列IDを TRIGGER_STATUS のキーへ安全に変換する。
   */
  private toTriggerStatusKey(triggerId: string | null): TriggerStatusKey | null {
    if (!triggerId) return null;
    if (triggerId in TRIGGER_STATUS) {
      return triggerId as TriggerStatusKey;
    }
    return null;
  }

  private handleSceneUpdate(_time: number, delta: number): void {
    if (!this.gltfAnimationMixer) return;
    this.gltfAnimationMixer.update(delta / 1000);
  }
}

type TriggerStatusKey = keyof typeof TRIGGER_STATUS;
