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
  private static readonly FIELD_MODEL_PATH = "/game/field/3Dfieldglb.glb";
  private static readonly FIELD_MODEL_SCALE = 375;
  /** 味方側/敵側マップの中央ギャップ（ワールド座標）。 */
  private static readonly FIELD_MODEL_CENTER_GAP = 64;

  /** フィールド状態を保持する2次元配列 */
  protected fieldView: FieldViewCell[][];
  /** 3D配置の座標変換サービス */
  private readonly placementService: ThreeDCharacterPlacementService;
  /** 3D地形モデル（味方側/敵側）。 */
  private fieldModels: THREE.Object3D[] = [];

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

      friendSideModel.position.set(
        anchor.x - friendCenter.x,
        anchor.y - friendBbox.min.y,
        anchor.z - halfMapDepth * 0.5 - halfGap - friendCenter.z,
      );

      enemySideModel.updateMatrixWorld(true);
      const enemyBbox = new THREE.Box3().setFromObject(enemySideModel);
      const enemyCenter = enemyBbox.getCenter(new THREE.Vector3());
      enemySideModel.position.set(
        anchor.x - enemyCenter.x,
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