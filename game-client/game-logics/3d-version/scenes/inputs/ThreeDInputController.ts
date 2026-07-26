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
  /** 3Dカメラ操作を有効/無効化する。 */
  setCameraControlEnabled?: (enabled: boolean) => void;
}

/**
 * 3Dシーン用の入力コントローラ。
 * レイキャストによるユニット選択を担当する。
 */
export class ThreeDInputController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  /** トリガー方位設定中のドラッグ操作状態。 */
  private isTriggerDragging = false;
  /** トリガー設定のためにカメラ操作をロックしているか。 */
  private isCameraControlLockedByTrigger = false;
  /** トリガー設定中に固定するカメラ位置。 */
  private lockedCameraPosition: THREE.Vector3 | null = null;
  /** トリガー設定中に固定するカメラ姿勢。 */
  private lockedCameraQuaternion: THREE.Quaternion | null = null;

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
    this.scene.input.on("pointerup", this.handlePointerUp, this);
    this.scene.events.on("postupdate", this.handlePostUpdate, this);
  }

  /** pointer 系イベントを解除する */
  public unbind(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.events.off("postupdate", this.handlePostUpdate, this);
    this.isTriggerDragging = false;
    this.unlockCameraControlIfNeeded();
    this.clearLockedCameraPose();
  }

  /** クリック位置からユニットをレイキャストして選択する */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.deps.isTriggerSettingMode?.()) {
      this.lockCameraControlForTriggerIfNeeded();
      this.captureCameraPoseIfNeeded();
      this.restoreLockedCameraPose();
      this.suppressPointerEvent(pointer);
      this.isTriggerDragging = true;
      this.updateTriggerDirectionFromPointer(pointer);
      return;
    }

    this.unlockCameraControlIfNeeded();

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
   * トリガー方位設定中のポインタ解放を検知し、現在角度を確定する。
   */
  private handlePointerUp(): void {
    if (!this.deps.isTriggerSettingMode?.()) {
      this.isTriggerDragging = false;
      this.unlockCameraControlIfNeeded();
      this.clearLockedCameraPose();
      return;
    }

    if (!this.isTriggerDragging) return;

    this.isTriggerDragging = false;
    this.deps.onCompleteTriggerSetting?.();
    this.syncCameraControlWithTriggerMode();
    if (!this.deps.isTriggerSettingMode?.()) {
      this.clearLockedCameraPose();
    }
  }

  /**
   * ポインタ移動に応じて、トリガー方位角の更新イベントを発火する。
   * @param pointer 現在のポインタ。
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.deps.isTriggerSettingMode?.()) {
      this.unlockCameraControlIfNeeded();
      return;
    }

    this.lockCameraControlForTriggerIfNeeded();
    this.captureCameraPoseIfNeeded();
    this.restoreLockedCameraPose();
    this.suppressPointerEvent(pointer);
    if (!this.isTriggerDragging) return;

    this.updateTriggerDirectionFromPointer(pointer);
  }

  /** トリガー設定モードに合わせてカメラ操作ロック状態を同期する。 */
  private syncCameraControlWithTriggerMode(): void {
    if (this.deps.isTriggerSettingMode?.()) {
      this.lockCameraControlForTriggerIfNeeded();
      this.captureCameraPoseIfNeeded();
      return;
    }

    this.unlockCameraControlIfNeeded();
    this.clearLockedCameraPose();
  }

  /** トリガー設定用にカメラ操作を無効化する。 */
  private lockCameraControlForTriggerIfNeeded(): void {
    if (this.isCameraControlLockedByTrigger) return;
    this.deps.setCameraControlEnabled?.(false);
    this.isCameraControlLockedByTrigger = true;
  }

  /** トリガー設定用のカメラ操作ロックを解除する。 */
  private unlockCameraControlIfNeeded(): void {
    if (!this.isCameraControlLockedByTrigger) return;
    this.deps.setCameraControlEnabled?.(true);
    this.isCameraControlLockedByTrigger = false;
  }

  /** 可能であればネイティブポインタイベントの伝播を止める。 */
  private suppressPointerEvent(pointer: Phaser.Input.Pointer): void {
    const nativeEvent = (pointer as Phaser.Input.Pointer & { event?: Event; }).event;
    nativeEvent?.preventDefault?.();
    nativeEvent?.stopPropagation?.();
  }

  /** postupdate ごとに、トリガー設定中のカメラ姿勢を固定する。 */
  private handlePostUpdate(): void {
    if (!this.deps.isTriggerSettingMode?.()) {
      if (this.lockedCameraPosition || this.lockedCameraQuaternion) {
        this.clearLockedCameraPose();
      }
      return;
    }

    this.captureCameraPoseIfNeeded();
    this.restoreLockedCameraPose();
  }

  /** まだ未固定なら、現在のカメラ姿勢を固定値として保持する。 */
  private captureCameraPoseIfNeeded(): void {
    if (this.lockedCameraPosition && this.lockedCameraQuaternion) return;

    this.lockedCameraPosition = this.camera.position.clone();
    this.lockedCameraQuaternion = this.camera.quaternion.clone();
  }

  /** 固定値へカメラ姿勢を戻す。 */
  private restoreLockedCameraPose(): void {
    if (!this.lockedCameraPosition || !this.lockedCameraQuaternion) return;

    this.camera.position.copy(this.lockedCameraPosition);
    this.camera.quaternion.copy(this.lockedCameraQuaternion);
    this.camera.updateMatrixWorld(true);
  }

  /** カメラ固定情報をクリアする。 */
  private clearLockedCameraPose(): void {
    this.lockedCameraPosition = null;
    this.lockedCameraQuaternion = null;
  }

  /**
   * 現在のポインタ位置からトリガー方位角を計算して通知する。
   * @param pointer 現在のポインタ。
   */
  private updateTriggerDirectionFromPointer(pointer: Phaser.Input.Pointer): void {
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
