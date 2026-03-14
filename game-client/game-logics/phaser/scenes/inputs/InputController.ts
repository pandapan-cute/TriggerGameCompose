'use client';
import { HexUtils } from '@/game-logics/hexUtils';
import { GridConfig } from '@/game-logics/types';
import 'phaser';

/**
 * InputController が Scene へ依存しすぎないようにするための依存定義。
 * 実処理は GridCellsScene 側で関数を渡して委譲する。
 */
export interface InputControllerDeps {
  /** 入力を受け付けられない状態かどうかを返す。 */
  isInteractionLocked: () => boolean;
  /** トリガー扇形が表示中かどうかを返す。 */
  hasTriggerFan: () => boolean;
  /** トリガー設定モード中かどうかを返す。 */
  isTriggerSettingMode: () => boolean;
  /** トリガー扇形ドラッグ中かどうかを返す。 */
  isTriggerDragging: () => boolean;
  /** トリガー扇形ドラッグ状態を更新する。 */
  setTriggerDragging: (isDragging: boolean) => void;
  /** pointer 位置に応じてトリガー角度を更新する。 */
  updateTriggerAngleFromPointer: (pointer: Phaser.Input.Pointer) => void;
  /** pointer 位置に応じてホバーセル表示を更新する。 */
  updateHoverFromPointer: (pointer: Phaser.Input.Pointer) => void;
  /** クリック確定時の六角形セル操作を実行する。 */
  commitGridClick: (pointer: Phaser.Input.Pointer) => void;
  /** トリガー角度確定処理を実行する。 */
  completeTriggerSetting: () => void;
  /** ネイティブタッチによるピンチ処理を有効化する。 */
  setupNativePinchGesture: (camera: Phaser.Cameras.Scene2D.Camera) => void;
}

/**
 * GridCellsScene の入力処理を担当するコントローラ。
 *
 * 配置先方針:
 * - `game-client/game-logics/phaser/scenes/inputs/` 配下
 * - Scene は初期化と委譲のみを担当し、入力イベント詳細は本クラスへ集約する
 */
export class InputController {
  private readonly dragThreshold = 10;

  private isPointerDown = false;
  private isDraggingCamera = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  private isPinching = false;
  private initialDistance = 0;
  private initialZoom = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly camera: Phaser.Cameras.Scene2D.CameraManager,
    private readonly deps: InputControllerDeps,
    private readonly gridConfig: GridConfig,
    private readonly hexUtils: HexUtils,
  ) { }

  /**
   * pointer 系イベントを登録する。
   *
   * @returns なし
   * @remarks 移動元: `game-client/game-logics/phaser/scenes/GridCellsScene.ts:144-407`
   */
  public bind(): void {
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.setupNativePinchGesture();
  }

  /**
   * pointer 系イベントを解除する。
   *
   * @returns なし
   * @remarks 新規追加想定。Scene の destroy 時に呼び出す。
   */
  public unbind(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.resetPointerState();
  }

  /**
   * pointermove イベント時の処理を実行する。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:159-252`
   */
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    // 2本指ピンチ中はズーム操作を最優先し、他操作を受け付けない。
    if (this.isPinching && this.scene.input.pointer2?.isDown) {
      this.applyPinchZoom(this.scene.input.activePointer, this.scene.input.pointer2);
      return;
    }

    // トリガー設定中でない場合は、ドラッグ距離に応じてカメラ移動を優先する。
    if (!this.deps.hasTriggerFan() && this.isPointerDown && pointer.leftButtonDown()) {
      if (this.updateCameraDrag(pointer)) {
        return;
      }
    }

    // 行動再生中など、入力を受け付けない状態では以降の処理を中断する。
    if (this.deps.isInteractionLocked()) {
      return;
    }

    // トリガー扇形のドラッグ中は角度更新のみを行う。
    if (this.updateTriggerDrag(pointer)) {
      return;
    }

    // 通常状態ではホバー対象セルのみ更新する。
    this.updateHover(pointer);
  }

  /**
   * pointerdown イベント時の処理を実行する。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:254-287`
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.isPointerDown = true;

    // 2本指入力ならピンチ開始として初期距離とズーム倍率を記録する。
    if (this.scene.input.pointer2?.isDown) {
      this.initialDistance = this.hexUtils.calculateDistance(
        this.scene.input.activePointer.x,
        this.scene.input.activePointer.y,
        this.scene.input.pointer2.x,
        this.scene.input.pointer2.y,
      );
      this.isPinching = true;
      this.initialZoom = this.camera.main.zoom;
      return;
    }

    // 1本指入力ではカメラドラッグ開始情報とトリガードラッグ状態を初期化する。
    this.beginCameraDrag(pointer);
    this.beginTriggerDragIfNeeded();
  }

  /**
   * pointerup イベント時の処理を実行する。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:289-405`
   */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.isPointerDown = false;

    // 指が1本以下になったらピンチ状態を解除する。
    if (!this.scene.input.pointer2?.isDown) {
      this.isPinching = false;
      this.initialDistance = 0;
    }

    // カメラドラッグ終了イベントの場合はクリック処理へ進まない。
    if (this.endCameraDragIfNeeded()) {
      return;
    }

    // 行動再生中などは入力を無効化する。
    if (this.deps.isInteractionLocked()) {
      console.log('行動実行中のため操作できません');
      return;
    }

    // トリガードラッグ中なら角度確定処理を優先する。
    if (this.completeTriggerDragIfNeeded()) {
      return;
    }

    // それ以外は通常のグリッドクリックとして処理する。
    this.handleGridClick(pointer);
  }

  /**
   * 2本指ピンチ中のズームを適用する。
   *
   * @param pointer1 1本目のポインター
   * @param pointer2 2本目のポインター
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:161-183`, `254-270`, `292-296`
   */
  private applyPinchZoom(
    pointer1: Phaser.Input.Pointer,
    pointer2: Phaser.Input.Pointer
  ): void {
    const currentDistance = this.hexUtils.calculateDistance(
      pointer1.x,
      pointer1.y,
      pointer2.x,
      pointer2.y,
    );

    // 初期距離が不正な場合はズーム計算できないため中断する。
    if (this.initialDistance <= 0) {
      return;
    }

    const scale = currentDistance / this.initialDistance;
    const newZoom = this.initialZoom * scale;
    const clampedZoom = Phaser.Math.Clamp(newZoom, 0.25, 3.0);
    this.camera.main.setZoom(clampedZoom);
  }

  /**
   * カメラドラッグ開始情報を記録する。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:272-276`
   */
  private beginCameraDrag(pointer: Phaser.Input.Pointer): void {
    this.dragStartX = pointer.x;
    this.dragStartY = pointer.y;
    this.cameraStartX = this.camera.main.scrollX;
    this.cameraStartY = this.camera.main.scrollY;
  }

  /**
   * カメラドラッグを更新する。
   *
   * @param pointer 現在のポインター情報
   * @returns ドラッグとして処理した場合は true
   * @remarks 移動元: `GridCellsScene.ts:185-199`
   */
  private updateCameraDrag(pointer: Phaser.Input.Pointer): boolean {
    const deltaX = pointer.x - this.dragStartX;
    const deltaY = pointer.y - this.dragStartY;

    // しきい値を超えた移動をカメラドラッグとして扱う。
    if (
      Math.abs(deltaX) > this.dragThreshold ||
      Math.abs(deltaY) > this.dragThreshold
    ) {
      this.camera.main.scrollX = this.cameraStartX - deltaX;
      this.camera.main.scrollY = this.cameraStartY - deltaY;
      this.isDraggingCamera = true;
      return true;
    }

    return false;
  }

  /**
   * カメラドラッグ状態を終了する。
   *
   * @returns ドラッグ終了として処理した場合は true
   * @remarks 移動元: `GridCellsScene.ts:297-301`
   */
  private endCameraDragIfNeeded(): boolean {
    // pointerup 時点でドラッグ中なら、クリック扱いせずドラッグ終了として処理する。
    if (this.isDraggingCamera) {
      this.isDraggingCamera = false;
      return true;
    }

    return false;
  }

  /**
   * トリガー扇形のドラッグ開始判定を行う。
   *
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:278-286`
   */
  private beginTriggerDragIfNeeded(): void {
    // トリガー設定モードかつ扇形表示中のみ、ドラッグ開始を有効化する。
    if (this.deps.isTriggerSettingMode() && this.deps.hasTriggerFan()) {
      this.deps.setTriggerDragging(true);
    }
  }

  /**
   * トリガー扇形のドラッグ更新を行う。
   *
   * @param pointer 現在のポインター情報
   * @returns ドラッグ更新として処理した場合は true
   * @remarks 移動元: `GridCellsScene.ts:206-226`
   */
  private updateTriggerDrag(pointer: Phaser.Input.Pointer): boolean {
    // トリガードラッグ中でない場合はこの分岐をスキップする。
    if (!this.deps.isTriggerDragging() || !this.deps.hasTriggerFan()) {
      return false;
    }

    this.deps.updateTriggerAngleFromPointer(pointer);
    return true;
  }

  /**
   * トリガー扇形のドラッグ確定処理を行う。
   *
   * @returns 確定処理を実行した場合は true
   * @remarks 移動元: `GridCellsScene.ts:309-313`
   */
  private completeTriggerDragIfNeeded(): boolean {
    // ドラッグ中かつ設定モード中のみ、角度確定処理を実行する。
    if (!this.deps.isTriggerDragging() || !this.deps.isTriggerSettingMode()) {
      return false;
    }

    this.deps.setTriggerDragging(false);
    this.deps.completeTriggerSetting();
    return true;
  }

  /**
   * 通常時のホバー更新を行う。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:228-251`
   */
  private updateHover(pointer: Phaser.Input.Pointer): void {
    // トリガー設定中や右/中クリック中はホバー更新を行わない。
    if (
      this.deps.isTriggerSettingMode() ||
      pointer.rightButtonDown() ||
      pointer.middleButtonDown()
    ) {
      return;
    }

    this.deps.updateHoverFromPointer(pointer);
  }

  /**
   * クリック確定時のセル操作を実行する。
   *
   * @param pointer 現在のポインター情報
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:315-405`
   */
  private handleGridClick(pointer: Phaser.Input.Pointer): void {
    const hexCoord = this.hexUtils.pixelToHex(pointer.x, pointer.y, this.camera.main);

    // グリッド外クリックは無効入力として破棄する。
    if (
      hexCoord.col < 0 ||
      hexCoord.col >= this.gridConfig.gridWidth ||
      hexCoord.row < 0 ||
      hexCoord.row >= this.gridConfig.gridHeight
    ) {
      return;
    }

    this.deps.commitGridClick(pointer);
  }

  /**
   * ネイティブピンチジェスチャーを有効化する。
   *
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:406-407`
   */
  private setupNativePinchGesture(): void {
    this.deps.setupNativePinchGesture(this.camera.main);
  }

  /**
   * ピンチ/ドラッグの一時状態をリセットする。
   *
   * @returns なし
   * @remarks 移動元: `GridCellsScene.ts:145-157`, `291-296`
   */
  private resetPointerState(): void {
    this.isPointerDown = false;
    this.isDraggingCamera = false;
    this.isPinching = false;
    this.initialDistance = 0;
    this.initialZoom = 1;
  }
}
