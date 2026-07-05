import { MAX_UNIT_EXEC_SECONDS } from "@/game-logics/config/game-config";
import { ThreeDCharacterManager } from "@/game-logics/3d-version/characterManager";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { FriendUnit } from "@/types/FriendUnit";
import { HexUtils } from "@/game-logics/hexUtils";
import * as THREE from "three";

export interface ThreeDSelectionServiceDeps {
  characterManager: ThreeDCharacterManager;
  playerUnits: Map<ThreeDUnitObject, FriendUnit>;
  unitGridPositions: Map<ThreeDUnitObject, { col: number; row: number; }>;
  hexUtils: HexUtils;
  placementService: ThreeDCharacterPlacementService;
  addObjectToScene: (object: THREE.Object3D) => void;
}

/**
 * 3D版のユニット選択と移動可能セル表示を担当するサービス。
 */
export class ThreeDSelectionService {
  private movableCellHighlights: THREE.Mesh[] = [];

  constructor(private readonly deps: ThreeDSelectionServiceDeps) { }

  /** ユニットを選択し、移動可能セル表示を更新する。 */
  public selectCharacter(unitObject: ThreeDUnitObject): void {
    this.deps.characterManager.selected3DCharacter = unitObject;
    this.showMovableHexes();
  }

  /** 選択中ユニットの移動可能セルを緑で表示する。 */
  public showMovableHexes(): void {
    this.clearMovableHexes();

    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    if (!selectedUnit) return;

    // まずは味方ユニット選択時のみ表示する。
    const playerUnit = this.deps.playerUnits.get(selectedUnit);
    if (!playerUnit) return;

    const currentPosition =
      this.deps.unitGridPositions.get(selectedUnit) ?? playerUnit.position;
    const actionPoints = Math.max(0, playerUnit.currentActionPoints ?? 0);
    const movableHexes = this.deps.hexUtils.getAdjacentHexes(
      currentPosition.col,
      currentPosition.row,
      actionPoints,
      MAX_UNIT_EXEC_SECONDS,
    );

    movableHexes.forEach((hex) => {
      const isCurrentCell =
        hex.col === currentPosition.col && hex.row === currentPosition.row;
      if (isCurrentCell || this.isUnitAt(hex.col, hex.row, selectedUnit)) {
        return;
      }

      const highlight = this.createMovableCellHighlight(hex.col, hex.row);
      this.movableCellHighlights.push(highlight);
    });
  }

  /** シーン終了時などに選択関連オブジェクトを破棄する。 */
  public dispose(): void {
    this.clearMovableHexes();
  }

  private clearMovableHexes(): void {
    this.movableCellHighlights.forEach((mesh) => {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.movableCellHighlights = [];
  }

  private isUnitAt(col: number, row: number, ignoreUnit?: ThreeDUnitObject): boolean {
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

  private createMovableCellHighlight(col: number, row: number): THREE.Mesh {
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
      depthWrite: false,
    });

    const highlight = new THREE.Mesh(geometry, material);
    const worldPosition = this.deps.placementService.fromGridOnGround(
      this.deps.hexUtils,
      col,
      row,
      0.06,
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
    this.deps.addObjectToScene(highlight);

    return highlight;
  }
}
