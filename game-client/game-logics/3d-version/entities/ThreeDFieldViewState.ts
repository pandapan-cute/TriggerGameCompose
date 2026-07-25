import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";
import { ThreeDHexagonCell } from "../graphics/ThreeDHexagonCell";
import { Scene3D } from "@enable3d/phaser-extension/dist/scene3d";
import { ThreeDCharacterPlacementService } from "../services/ThreeDCharacterPlacementService";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

interface FieldViewCell {
  /** 可視性の色付けグラフィック */
  backGroundGraphic: ThreeDHexagonCell | null;
  /** そのセルが視認可能かどうか */
  canSight: boolean;
}

/**
 * 3D版のフィールドの視界領域の表示などを管理するクラス
 */
export class ThreeDFieldViewState {
  // ===== 地形モデル調整値（見た目調整用） =====
  private static readonly FIELD_MODEL_PATH = "/game/field/3Dfieldglb.glb";
  /** 地形モデル全体の拡大率。大きくするとマップが広がる。 */
  private static readonly FIELD_MODEL_SCALE = 375;
  /**
   * 味方側/敵側マップの中央ギャップ（ワールド座標）。
   * 値を増やすほど中央の隙間が広がる。
   */
  private static readonly FIELD_MODEL_CENTER_GAP = 64;
  /**
   * 味方側地形モデルの X 位置調整（列幅ベース）。
   *
   * 1.0 で「1列分の横ステップ(= hexWidth * 0.75)」移動。
   * 正で右、負で左に動く。
   */
  private static readonly FIELD_MODEL_FRIEND_X_OFFSET_COL = 0.5;
  /**
   * 敵側地形モデルの X 位置調整（列幅ベース）。
   *
   * 回転反転の都合で味方側と逆方向にズレる場合があるため、独立して調整する。
   * 正で右、負で左に動く。
   */
  private static readonly FIELD_MODEL_ENEMY_X_OFFSET_COL = -0.5;

  // ===== 環境（空・地面・太陽）調整値 =====
  /** 空の背景色。 */
  private static readonly SKY_COLOR = 0xcfe8ff;
  /** 地面プレーンのコンクリート風カラー。 */
  private static readonly GROUND_COLOR = 0xa0a4a8;
  /** 太陽光の色。 */
  private static readonly SUN_LIGHT_COLOR = 0xfff6df;
  /**
   * 太陽光の強さ。
   * 大きくすると全体が明るくなり、影とのコントラストも強く見える。
   */
  private static readonly SUN_LIGHT_INTENSITY = 1.25;

  /** フィールド状態を保持する2次元配列 */
  protected fieldView: FieldViewCell[][];
  /** 3D配置の座標変換サービス */
  private readonly placementService: ThreeDCharacterPlacementService;
  /** 3D地形モデル（味方側/敵側）。 */
  private fieldModels: THREE.Object3D[] = [];
  /** 盤面下に敷く地面プレーン。 */
  private concreteGroundMesh: THREE.Mesh | null = null;
  /** 太陽光の平行光源。 */
  private sunLight: THREE.DirectionalLight | null = null;
  /** 太陽光の照射ターゲット。 */
  private sunLightTarget: THREE.Object3D | null = null;

  constructor(protected hexUtils: HexUtils, protected scene: Scene3D, protected gridConfig: GridConfig, protected fieldSteps: number[][], visibility: boolean[][]) {
    this.placementService = new ThreeDCharacterPlacementService(gridConfig);

    // フィールドビューを初期化（列×行）
    this.fieldView = Array.from({ length: gridConfig.gridWidth }, () =>
      Array.from({ length: gridConfig.gridHeight }, (): FieldViewCell => ({
        backGroundGraphic: null,
        canSight: false,
      }))
    );
    // 背景タイルの作成
    this.createBackgroundTiles();
    // 初期の視認可能エリアを設定
    this.setSightAreaFieldView(visibility);
  }

  /**
   * 背景タイルを六角形グリッドに敷き詰める
   */
  protected createBackgroundTiles() {
    // 各グリッドセルに六角形の背景を配置
    for (let col = 0; col < this.gridConfig.gridWidth; col++) {
      for (let row = 0; row < this.gridConfig.gridHeight; row++) {
        const pos = this.placementService.fromGrid(this.hexUtils, col, row);

        // ★ 作成したHexagonCellを保存
        const hexagon = new ThreeDHexagonCell(this.hexUtils, this.scene, pos);
        // 通常時は床セルを表示しない。
        hexagon.visible = false;
        this.fieldView[col][row].backGroundGraphic = hexagon;
      }
    }
  }


  /** 
   * 視認可能エリアのフィールドビューを設定する
   * @param visibilty 視認可能エリアの2次元配列
   */
  public setSightAreaFieldView(visibilty: boolean[][]) {

    if (this.scene === null) {
      console.warn("Sceneが未初期化のため、視認可能エリアのフィールドビューを設定できません。");
      return;
    }
    for (const [colIndex, col] of visibilty.entries()) {
      for (const [rowIndex, row] of col.entries()) {
        if (row === true && this.fieldView[rowIndex][colIndex].canSight !== true) {
          // 視認可能エリアのセルに切り替える
          this.fieldView[rowIndex][colIndex].canSight = true;
          this.fieldView[rowIndex][colIndex].backGroundGraphic?.switchCanSight();
        } else if (row === false && this.fieldView[rowIndex][colIndex].canSight !== false) {
          // 視認不可能エリアのセルに切り替える
          this.fieldView[rowIndex][colIndex].canSight = false;
          this.fieldView[rowIndex][colIndex]?.backGroundGraphic?.switchCannotSight();
        }
      }
    }
  }

  /**
   * 3D地形モデルを読み込み、シーンへ配置する。
   */
  public async loadFieldModel(): Promise<void> {
    this.setupEnvironmentVisuals();

    if (this.fieldModels.length > 0) {
      return;
    }

    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/lib/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);

    try {
      const gltf = await gltfLoader.loadAsync(ThreeDFieldViewState.FIELD_MODEL_PATH);
      const friendSideModel = gltf.scene;
      const enemySideModel = gltf.scene.clone(true);
      this.fieldModels = [friendSideModel, enemySideModel];

      for (const model of this.fieldModels) {
        model.scale.setScalar(ThreeDFieldViewState.FIELD_MODEL_SCALE);
      }

      // 味方側は既存向き、敵側は反転向きで配置する。
      friendSideModel.rotation.set(0, 0, 0);
      enemySideModel.rotation.set(0, Math.PI, 0);

      // 盤面座標系から求めたアンカーへ、2つの半面を前後に並べる。
      const anchor = this.resolveFieldModelAnchor();
      friendSideModel.updateMatrixWorld(true);
      const friendBbox = new THREE.Box3().setFromObject(friendSideModel);
      const friendCenter = friendBbox.getCenter(new THREE.Vector3());
      const friendSize = friendBbox.getSize(new THREE.Vector3());
      const halfMapDepth = friendSize.z;
      const halfGap = ThreeDFieldViewState.FIELD_MODEL_CENTER_GAP * 0.5;
      const oneColStep = this.gridConfig.hexWidth * 0.75;
      const friendOffsetX = oneColStep * ThreeDFieldViewState.FIELD_MODEL_FRIEND_X_OFFSET_COL;
      const enemyOffsetX = oneColStep * ThreeDFieldViewState.FIELD_MODEL_ENEMY_X_OFFSET_COL;

      friendSideModel.position.set(
        anchor.x + friendOffsetX - friendCenter.x,
        anchor.y - friendBbox.min.y,
        anchor.z - halfMapDepth * 0.5 - halfGap - friendCenter.z,
      );

      enemySideModel.updateMatrixWorld(true);
      const enemyBbox = new THREE.Box3().setFromObject(enemySideModel);
      const enemyCenter = enemyBbox.getCenter(new THREE.Vector3());
      enemySideModel.position.set(
        anchor.x + enemyOffsetX - enemyCenter.x,
        anchor.y - enemyBbox.min.y,
        anchor.z + halfMapDepth * 0.5 + halfGap - enemyCenter.z,
      );

      for (const model of this.fieldModels) {
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) {
            return;
          }

          child.castShadow = true;
          child.receiveShadow = true;
        });

        this.scene.third.add.existing(model);
      }
    } catch (error) {
      console.warn("3D地形モデルの読み込みに失敗しました", error);
    } finally {
      dracoLoader.dispose();
    }
  }

  /**
   * 読み込んだ3D地形モデルを破棄する。
   */
  public dispose(): void {
    this.disposeEnvironmentVisuals();

    if (this.fieldModels.length === 0) {
      return;
    }

    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();

    for (const model of this.fieldModels) {
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }

        if (!disposedGeometries.has(child.geometry)) {
          child.geometry.dispose();
          disposedGeometries.add(child.geometry);
        }

        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            if (disposedMaterials.has(material)) {
              return;
            }
            material.dispose();
            disposedMaterials.add(material);
          });
          return;
        }

        if (disposedMaterials.has(child.material)) {
          return;
        }
        child.material.dispose();
        disposedMaterials.add(child.material);
      });

      model.removeFromParent();
    }

    this.fieldModels = [];
  }

  /**
   * 背景色（空）と地面プレーンを設定する。
   */
  private setupEnvironmentVisuals(): void {
    const threeScene = this.scene.third.scene as THREE.Scene;
    threeScene.background = new THREE.Color(ThreeDFieldViewState.SKY_COLOR);

    const topLeft = this.placementService.fromGridOnGround(this.hexUtils, 0, 0, 0);
    const bottomRight = this.placementService.fromGridOnGround(
      this.hexUtils,
      this.gridConfig.gridWidth - 1,
      this.gridConfig.gridHeight - 1,
      0,
    );

    const width = Math.abs(bottomRight.x - topLeft.x) + this.gridConfig.hexWidth * 6;
    const depth = Math.abs(bottomRight.z - topLeft.z) + this.gridConfig.hexHeight * 10;
    const centerX = (topLeft.x + bottomRight.x) * 0.5;
    const centerZ = (topLeft.z + bottomRight.z) * 0.5;

    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshStandardMaterial({
      color: ThreeDFieldViewState.GROUND_COLOR,
      // 粗さ。大きいほどマットなコンクリ質感になる。
      roughness: 0.95,
      // 金属感。小さくすると自然な地面っぽさを保てる。
      metalness: 0.04,
    });

    const groundMesh = new THREE.Mesh(geometry, material);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(centerX, -0.08, centerZ);
    groundMesh.receiveShadow = true;
    groundMesh.name = "3d-field-concrete-ground";

    if (!this.concreteGroundMesh) {
      this.scene.third.add.existing(groundMesh);
      this.concreteGroundMesh = groundMesh;
    } else {
      geometry.dispose();
      material.dispose();
    }

    if (!this.sunLight || !this.sunLightTarget) {
      const sunLight = new THREE.DirectionalLight(
        ThreeDFieldViewState.SUN_LIGHT_COLOR,
        ThreeDFieldViewState.SUN_LIGHT_INTENSITY,
      );
      // 太陽の見立て位置。x/z で方角、y で太陽高度を調整する。
      sunLight.position.set(centerX - 1200, 1800, centerZ + 800);
      sunLight.castShadow = true;

      // 影の解像度。高いほどくっきりするが負荷も上がる。
      sunLight.shadow.mapSize.set(2048, 2048);
      // 影のチラつき/アクネ軽減用バイアス。
      sunLight.shadow.bias = -0.0002;

      // 影を計算する範囲。必要以上に広いと解像感が落ちる。
      sunLight.shadow.camera.near = 50;
      sunLight.shadow.camera.far = 5000;
      sunLight.shadow.camera.left = -2000;
      sunLight.shadow.camera.right = 2000;
      sunLight.shadow.camera.top = 2000;
      sunLight.shadow.camera.bottom = -2000;

      const target = new THREE.Object3D();
      target.position.set(centerX, 0, centerZ);
      sunLight.target = target;

      this.scene.third.add.existing(target);
      this.scene.third.add.existing(sunLight);
      this.sunLight = sunLight;
      this.sunLightTarget = target;
    }
  }

  /**
   * 生成済みの環境表現リソースを破棄する。
   */
  private disposeEnvironmentVisuals(): void {
    if (this.sunLight) {
      this.sunLight.removeFromParent();
      this.sunLight = null;
    }

    if (this.sunLightTarget) {
      this.sunLightTarget.removeFromParent();
      this.sunLightTarget = null;
    }

    if (!this.concreteGroundMesh) {
      return;
    }

    this.concreteGroundMesh.removeFromParent();
    this.concreteGroundMesh.geometry.dispose();
    if (Array.isArray(this.concreteGroundMesh.material)) {
      this.concreteGroundMesh.material.forEach((material) => material.dispose());
    } else {
      this.concreteGroundMesh.material.dispose();
    }
    this.concreteGroundMesh = null;
  }

  /**
   * 盤面全体の中心付近を、3D地形モデル配置のアンカーとして返す。
   *
   * 画面サイズ依存の margin が変化しても、キャラ配置と同じ座標変換系で
   * 求めることで相対位置のズレを防ぐ。
   */
  private resolveFieldModelAnchor(): { x: number; y: number; z: number; } {
    const topLeft = this.placementService.fromGridOnGround(this.hexUtils, 0, 0, 0);
    const bottomRight = this.placementService.fromGridOnGround(
      this.hexUtils,
      this.gridConfig.gridWidth - 1,
      this.gridConfig.gridHeight - 1,
      0,
    );

    return {
      x: (topLeft.x + bottomRight.x) * 0.5,
      y: 0,
      z: (topLeft.z + bottomRight.z) * 0.5,
    };
  }

}