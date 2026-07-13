import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import * as THREE from "three";
import "phaser";

export interface ThreeDInputControllerDeps {
  getSelectableUnits: () => ThreeDUnitObject[];
  onSelectUnit: (unit: ThreeDUnitObject) => void;
  getMovableCells: () => THREE.Mesh[];
  onSelectMovableCell: (cell: THREE.Mesh) => void;
  /** 移動先選択をキャンセルしてハイライト表示を解除する。 */
  onCancelMoveSelection?: () => void;
  /** トリガー方位設定モードかどうかを返す。 */
  isTriggerSettingMode?: () => boolean;
  /** トリガー方位角計算の原点座標を返す。 */
  getTriggerDirectionOrigin?: () => { x: number; y: number; z: number; } | null;
  /** 計算したトリガー方位角（度）を通知する。 */
  onUpdateTriggerDirection?: (directionDeg: number) => void;
  /** 現在のトリガー方位設定を確定する。 */
  onCompleteTriggerSetting?: () => void;
}

/**
 * 3Dシーン用の入力コントローラ。
 * レイキャストによるユニット選択を担当する。
 */
export class ThreeDInputController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.Camera,
    private readonly deps: ThreeDInputControllerDeps,
  ) { }

  /** pointer 系イベントを登録する */
  public bind(): void {
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
    this.scene.input.on("pointermove", this.handlePointerMove, this);
  }

  /** pointer 系イベントを解除する */
  public unbind(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
  }

  /** クリック位置からユニットをレイキャストして選択する */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.deps.isTriggerSettingMode?.()) {
      this.deps.onCompleteTriggerSetting?.();
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();

    this.pointerNdc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const units = this.deps.getSelectableUnits();
    const intersections = this.raycaster.intersectObjects(units, true);
    if (intersections.length) {
      const clickedObject = intersections[0].object;
      const selectedUnit = units.find((unit) => {
        let node: THREE.Object3D | null = clickedObject;
        while (node) {
          if (node === unit) return true;
          node = node.parent;
        }
        return false;
      });

      if (!selectedUnit) return;

      this.deps.onSelectUnit(selectedUnit);
      return;
    }

    const movableCells = this.deps.getMovableCells();
    if (!movableCells.length) return;

    const cellIntersections = this.raycaster.intersectObjects(movableCells, true);
    if (!cellIntersections.length) {
      this.deps.onCancelMoveSelection?.();
      return;
    }

    const clickedCellObject = cellIntersections[0].object;
    const targetCell = movableCells.find((cell) => {
      let node: THREE.Object3D | null = clickedCellObject;
      while (node) {
        if (node === cell) return true;
        node = node.parent;
      }
      return false;
    });

    if (!targetCell) {
      this.deps.onCancelMoveSelection?.();
      return;
    }

    this.deps.onSelectMovableCell(targetCell);
  }

  /**
   * ポインタ移動に応じて、トリガー方位角の更新イベントを発火する。
   * @param pointer 現在のポインタ。
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.deps.isTriggerSettingMode?.()) return;

    const origin = this.deps.getTriggerDirectionOrigin?.();
    if (!origin) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const ray = this.raycaster.ray;
    const directionY = ray.direction.y;
    if (Math.abs(directionY) < 1e-6) return;

    const t = (origin.y - ray.origin.y) / directionY;
    if (t <= 0) return;

    const hitPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(t));
    const deltaX = hitPoint.x - origin.x;
    const deltaZ = hitPoint.z - origin.z;
    const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
    if (distanceSq <= 1e-8) return;

    const directionDeg = (THREE.MathUtils.radToDeg(Math.atan2(deltaX, -deltaZ)) + 360) % 360;
    this.deps.onUpdateTriggerDirection?.(directionDeg);
  }
}
