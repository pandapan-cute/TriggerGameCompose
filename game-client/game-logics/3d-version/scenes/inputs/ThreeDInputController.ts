import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import * as THREE from "three";
import "phaser";

export interface ThreeDInputControllerDeps {
  getSelectableUnits: () => ThreeDUnitObject[];
  onSelectUnit: (unit: ThreeDUnitObject) => void;
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
  }

  /** pointer 系イベントを解除する */
  public unbind(): void {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
  }

  /** クリック位置からユニットをレイキャストして選択する */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const rect = this.renderer.domElement.getBoundingClientRect();

    this.pointerNdc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const units = this.deps.getSelectableUnits();
    const intersections = this.raycaster.intersectObjects(units, true);
    if (!intersections.length) return;

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

    selectedUnit.triggerSelectUnit();
    this.deps.onSelectUnit(selectedUnit);
  }
}
