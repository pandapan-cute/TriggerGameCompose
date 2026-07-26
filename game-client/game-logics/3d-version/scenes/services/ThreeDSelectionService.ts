import { ThreeDCharacterManager } from "@/game-logics/3d-version/characterManager";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { HexUtils } from "@/game-logics/hexUtils";
import * as THREE from "three";

/**
 * ThreeDSelectionService が参照する依存関係。
 */
export interface ThreeDSelectionServiceDeps {
  characterManager: ThreeDCharacterManager;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  unitGridPositions: Map<ThreeDUnitObject, { col: number; row: number; }>;
  hexUtils: HexUtils;
  placementService: ThreeDCharacterPlacementService;
  /** 指定グリッド座標でのユニット配置高さを返す。 */
  resolveUnitHeightAtGrid?: (col: number, row: number) => number;
  addObjectToScene: (object: THREE.Object3D) => void;
  /** 移動後に視界更新を行うコールバック。 */
  updateFieldViewVisibility?: () => boolean[][] | undefined;
  /** 移動完了後にトリガー方位設定表示を開始するコールバック。 */
  startTriggerSettingForSelectedUnit?: () => void;
  /** 選択変更・終了時にトリガー方位設定表示をクリアするコールバック。 */
  clearTriggerSettingDisplay?: () => void;
}

/**
 * 3D版のユニット選択と移動可能セル表示を担当するサービス。
 */
export class ThreeDSelectionService {
  /** 現在シーン上に表示している移動候補セルのメッシュ一覧。 */
  private movableCellHighlights: THREE.Mesh[] = [];
  /**
   * 各ハイライトメッシュに対応するグリッド情報。
   * クリックされたメッシュから移動先セルを逆引きするために保持する。
   */
  private readonly movableCellStateByMesh = new Map<
    THREE.Mesh,
    { col: number; row: number; remainActionPoints: number; remainSeconds: number; }
  >();
  /** 移動アニメーション中の二重操作を防止するフラグ。 */
  private isMoving = false;

  /**
   * @param deps ユニット選択・移動・視界更新に必要な依存関係。
   */
  constructor(private readonly deps: ThreeDSelectionServiceDeps) { }

  /** ユニットを選択し、移動可能セル表示を更新する。 */
  public selectCharacter(unitObject: ThreeDUnitObject): void {
    this.deps.clearTriggerSettingDisplay?.();

    const currentSelectedUnit = this.deps.characterManager.selected3DCharacter;
    // 同じ味方ユニットを再クリックした場合は、その場に待機したものとして残り時間だけを消費する。
    if (currentSelectedUnit === unitObject) {
      this.consumeWaitInPlace(unitObject);
      return;
    }

    // 現在の選択対象を差し替える。
    this.deps.characterManager.selected3DCharacter = unitObject;
    // 選択状態に応じて移動候補セルを再生成する。
    this.showMovableHexes();
  }

  /** 選択中ユニットの移動可能セルを緑で表示する。 */
  public showMovableHexes(): void {
    // 前回分の候補表示が残っていると二重描画になるため、最初に全消去する。
    this.clearMovableHexes();

    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    // 何も選択されていない場合は表示対象がないため終了。
    if (!selectedUnit) return;

    // まずは味方ユニット選択時のみ表示する。
    const playerCharacterState = this.deps.playerCharacterStates.get(selectedUnit);
    // 敵ユニット選択時は移動候補を表示しない。
    if (!playerCharacterState) return;

    // 直近のグリッド座標を優先して取得し、なければ初期ユニット座標を使う。
    const currentPosition =
      this.deps.unitGridPositions.get(selectedUnit) ?? playerCharacterState.getPosition();
    // 残り行動力が負になることはない前提に正規化する。
    const actionPoints = Math.max(0, playerCharacterState.getActionPoints());
    const remainSeconds = Math.max(0, playerCharacterState.getRemainSeconds());
    // 2D版と同じ経路探索ロジックで移動可能セルを列挙する。
    const movableHexes = this.deps.hexUtils.getAdjacentHexes(
      currentPosition.col,
      currentPosition.row,
      actionPoints,
      remainSeconds,
    );

    movableHexes.forEach((hex) => {
      const isCurrentCell =
        hex.col === currentPosition.col && hex.row === currentPosition.row;
      // 現在地と占有セル（他ユニットがいるセル）は移動先として除外する。
      if (isCurrentCell || this.isUnitAt(hex.col, hex.row, selectedUnit)) {
        return;
      }

      // 移動可能セルを緑メッシュとして表示し、後でクリック判定できるように保持する。
      const highlight = this.createMovableCellHighlight(hex.col, hex.row);
      this.movableCellHighlights.push(highlight);
      this.movableCellStateByMesh.set(highlight, {
        col: hex.col,
        row: hex.row,
        remainActionPoints: hex.remainActionPoints,
        remainSeconds: hex.remainSeconds,
      });
    });
  }

  /** 入力コントローラ向け: 現在有効な移動候補セルメッシュ一覧を返す。 */
  public getMovableCellHighlights(): THREE.Mesh[] {
    return this.movableCellHighlights;
  }

  /**
   * 移動先選択をキャンセルし、緑ハイライトと選択状態を解除する。
   */
  public cancelMoveSelection(): void {
    this.clearMovableHexes();
    this.deps.characterManager.selected3DCharacter = null;
    this.deps.clearTriggerSettingDisplay?.();
  }

  /** 移動候補セルクリック時に、選択中ユニットを対象セルへ移動する。 */
  public moveSelectedCharacterByHighlight(cellMesh: THREE.Mesh): void {
    if (this.isMoving) return;

    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    // 選択対象が無い場合は移動操作として成立しない。
    if (!selectedUnit) return;

    // クリックされたメッシュに紐づく移動先セル情報を取得する。
    const target = this.movableCellStateByMesh.get(cellMesh);
    // 管理外メッシュが渡された場合は無視する。
    if (!target) return;

    // グリッド座標をワールド座標へ変換し、現在の高さを保ったまま移動させる。
    const worldPosition = this.deps.placementService.fromGridOn3D(
      this.deps.hexUtils,
      target.col,
      target.row,
      this.deps.resolveUnitHeightAtGrid?.(target.col, target.row) ?? selectedUnit.position.y,
    );

    // 移動中は候補セルを一旦隠し、Running アニメーションへ切り替える。
    this.isMoving = true;
    this.clearMovableHexes();
    selectedUnit.faceToward(worldPosition);

    selectedUnit.moveTo(
      { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      500,
      () => {
        // 移動完了後に内部状態を確定し、Idleへ戻す。
        this.deps.unitGridPositions.set(selectedUnit, {
          col: target.col,
          row: target.row,
        });

        const playerCharacterState = this.deps.playerCharacterStates.get(selectedUnit);
        if (playerCharacterState) {
          playerCharacterState.setPosition({ col: target.col, row: target.row });
          playerCharacterState.setActionPoints(target.remainActionPoints);
          playerCharacterState.setRemainSeconds(target.remainSeconds);
        }
        this.deps.updateFieldViewVisibility?.();
        // トリガー方位設定中は移動候補セルを表示しない（2D版挙動に揃える）。
        this.clearMovableHexes();
        this.deps.startTriggerSettingForSelectedUnit?.();
        // selectedUnit.faceEnemyTerritoryDefault(); // 移動後に敵陣向きにする場合はコメントアウトを外す。
        selectedUnit.playAnimation("Idle");
        this.isMoving = false;
      },
    );
  }

  /** シーン終了時などに選択関連オブジェクトを破棄する。 */
  public dispose(): void {
    this.deps.clearTriggerSettingDisplay?.();
    this.clearMovableHexes();
  }

  /** 同一ユニット再クリック時の待機処理。 */
  private consumeWaitInPlace(unitObject: ThreeDUnitObject): void {
    const playerCharacterState = this.deps.playerCharacterStates.get(unitObject);
    if (!playerCharacterState) return;

    const currentRemainSeconds = Math.max(0, playerCharacterState.getRemainSeconds());
    if (currentRemainSeconds <= 0) {
      this.clearMovableHexes();
      return;
    }

    // 待機でも 2D 版と同様に残り秒数を消費してトリガー設定へ遷移する。
    playerCharacterState.setRemainSeconds(currentRemainSeconds - 1);
    this.clearMovableHexes();
    this.deps.startTriggerSettingForSelectedUnit?.();
  }


  /**
   * 現在の選択状態、ハイライト表示、および関連UI状態をクリアする。
   */
  public clearSelection(): void {
    // 選択中キャラクターがいる場合のみ表示色を元に戻す。
    if (this.deps.characterManager.selectedCharacter) {
      // プレイヤー/敵で復帰色を切り替える。
      if (
        this.deps.characterManager.playerCharacters.includes(
          this.deps.characterManager.selectedCharacter
        )
      ) {
        // プレイヤーキャラクターの場合の復帰色。
        this.deps.characterManager.selectedCharacter.image.setTint(0xadd8e6);
      } else {
        // 敵キャラクターの場合の復帰色。
        this.deps.characterManager.selectedCharacter.image.setTint(0xffb6c1);
      }
    }

    this.deps.characterManager.movableHexes.forEach((hex) => hex.destroy());
    this.deps.characterManager.movableHexes = [];

    this.clearMovableHexes();

    // TODO: トリガー方位設定表示のクリアを行う。

    this.deps.characterManager.selectedCharacter = null;
    this.deps.characterManager.selected3DCharacter = null;
  }

  /**
   * 前回表示していた移動可能セルハイライトを破棄して初期化する。
   */
  private clearMovableHexes(): void {
    // シーン上のメッシュとGPUリソースを破棄してリークを防ぐ。
    this.movableCellHighlights.forEach((mesh) => {
      mesh.traverse((child) => {
        if (child === mesh) {
          return;
        }
        const childWithGeometry = child as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        childWithGeometry.geometry?.dispose();
        if (Array.isArray(childWithGeometry.material)) {
          childWithGeometry.material.forEach((material) => material.dispose());
        } else {
          childWithGeometry.material?.dispose();
        }
      });
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    // 参照配列と逆引きマップを初期化する。
    this.movableCellHighlights = [];
    this.movableCellStateByMesh.clear();
  }

  /**
   * 指定セルにユニットが存在するかを判定する。
   * @param col 判定対象セルの列。
   * @param row 判定対象セルの行。
   * @param ignoreUnit 判定から除外したいユニット。
   * @returns 占有されていれば true。
   */
  private isUnitAt(col: number, row: number, ignoreUnit?: ThreeDUnitObject): boolean {
    // 管理中ユニット座標を走査し、対象セルの占有有無を判定する。
    for (const [unitObject, position] of this.deps.unitGridPositions) {
      if (ignoreUnit && unitObject === ignoreUnit) {
        continue;
      }
      if (position.col === col && position.row === row) {
        return true;
      }
    }
    return false;
  }

  /**
   * 移動可能セルを示すハイライトメッシュを生成して配置する。
   * @param col 対象セルの列。
   * @param row 対象セルの行。
   * @returns 生成したハイライトメッシュ。
   */
  private createMovableCellHighlight(col: number, row: number): THREE.Mesh {
    // 六角形の輪郭頂点をもとにハイライト形状を生成する。
    const vertices = this.deps.hexUtils.getHexVertices(0, 0);
    const shape = new THREE.Shape();
    shape.moveTo(vertices[0], vertices[1]);
    for (let i = 2; i < vertices.length; i += 2) {
      shape.lineTo(vertices[i], vertices[i + 1]);
    }

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.02,
      bevelEnabled: false,
    });
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.42,
      // 背面セルと重なったときの見え方を優先して深度書き込みを無効化する。
      depthWrite: false,
    });

    const highlight = new THREE.Mesh(geometry, material);
    const outlineGeometry = new THREE.EdgesGeometry(geometry);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x0b4f17,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.position.z = 0.012;
    outline.renderOrder = 3;
    highlight.add(outline);

    const baseHeight = this.deps.resolveUnitHeightAtGrid?.(col, row) ?? 0;
    // グリッド座標をワールド座標へ変換して、盤面上に少し浮かせて配置する。
    const worldPosition = this.deps.placementService.fromGridOn3D(
      this.deps.hexUtils,
      col,
      row,
      baseHeight + 0.06,
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
    this.deps.addObjectToScene(highlight);

    return highlight;
  }
}
