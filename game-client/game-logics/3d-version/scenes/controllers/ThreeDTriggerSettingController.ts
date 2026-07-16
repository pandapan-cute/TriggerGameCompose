import { ThreeDCharacterManager } from "@/game-logics/3d-version/characterManager";
import { ThreeDPlayerCharacterState } from "@/game-logics/3d-version/entities/ThreeDPlayerCharacterState";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";
import { ThreeDTriggerFanObject } from "@/game-logics/3d-version/graphics/ThreeDTriggerFanObject";
import { ThreeDCharacterPlacementService } from "@/game-logics/3d-version/services/ThreeDCharacterPlacementService";
import { GridConfig } from "@/game-logics/types";
import { TRIGGER_STATUS } from "@/game-logics/config/status";
import { HexUtils } from "@/game-logics/hexUtils";
import { Scene3D } from "@enable3d/phaser-extension";
import { TriggerDirection } from "@/game-logics/types";

/**
 * 3Dトリガー設定コントローラの依存関係。
 */
export interface ThreeDTriggerSettingControllerDeps {
  scene3d: Scene3D;
  characterManager: ThreeDCharacterManager;
  playerCharacterStates: Map<ThreeDUnitObject, ThreeDPlayerCharacterState>;
  placementService: ThreeDCharacterPlacementService;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
  /** main/sub 両トリガーの確定完了時に呼び出す。 */
  onTriggerPairConfirmed?: (unitObject: ThreeDUnitObject, direction: TriggerDirection) => void;
  /** トリガー方位設定の完了後に実行するコールバック。 */
  onTriggerSettingFinished?: () => void;
}

/**
 * 3Dシーンのトリガー方位設定表示を管理するコントローラ。
 */
export class ThreeDTriggerSettingController {
  /** 現在表示中の 3D 扇形オブジェクト。 */
  private triggerFan: ThreeDTriggerFanObject | null = null;

  /** 現在調整中の方位角（度）。 */
  private currentTriggerAngle = 0;

  /** トリガー方位設定モードが有効か。 */
  private triggerSettingMode = false;

  /** 現在設定中のトリガー種別。 */
  private triggerSettingType: "main" | "sub" | null = null;

  /** 各ユニットのトリガー方位設定値。 */
  private readonly triggerDirections = new Map<ThreeDUnitObject, TriggerDirection>();

  /**
   * @param deps 3Dトリガー方位設定に必要な依存。
   */
  constructor(private readonly deps: ThreeDTriggerSettingControllerDeps) { }

  /**
   * 選択中ユニットのトリガー方位設定表示を開始する。
   */
  public startTriggerSettingForSelectedUnit(): void {
    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    if (!selectedUnit) return;

    this.triggerSettingMode = true;
    this.triggerSettingType = "main";
    this.currentTriggerAngle = this.getInitialTriggerAngle(selectedUnit, "main", 0);
    this.showTriggerFan(selectedUnit, this.currentTriggerAngle);
  }

  /**
   * 現在角度を更新し、扇形表示に反映する。
   * @param angleDeg 新しい方位角（度）。
   */
  public updateCurrentTriggerAngle(angleDeg: number): void {
    if (!this.triggerSettingMode) return;

    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    if (!selectedUnit) return;

    this.currentTriggerAngle = ((Math.round(angleDeg) % 360) + 360) % 360;
    this.showTriggerFan(selectedUnit, this.currentTriggerAngle);
  }

  /**
   * 現在設定中の角度を返す。
   * @returns 方位角（度）。
   */
  public getCurrentTriggerAngle(): number {
    return this.currentTriggerAngle;
  }

  /**
   * トリガー方位設定モードかどうかを返す。
   * @returns トリガー方位設定モードなら true。
   */
  public isTriggerSettingMode(): boolean {
    return this.triggerSettingMode;
  }

  /**
   * 選択中ユニットのトリガー方位計算用の中心座標を返す。
   * @returns 中心座標。選択中ユニットがいなければ null。
   */
  public getTriggerCenterPosition(): { x: number; y: number; z: number; } | null {
    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    if (!selectedUnit) return null;

    return {
      x: selectedUnit.position.x,
      y: selectedUnit.position.y,
      z: selectedUnit.position.z,
    };
  }

  /**
   * トリガー方位設定モードを終了し、表示を破棄する。
   */
  public stopTriggerSetting(): void {
    this.triggerSettingMode = false;
    this.triggerSettingType = null;
    this.clearTriggerDisplay();
  }

  /**
   * 現在の角度を確定し、main->sub->完了の順に遷移する。
   */
  public completeCurrentTriggerSetting(): void {
    if (!this.triggerSettingMode) return;

    const selectedUnit = this.deps.characterManager.selected3DCharacter;
    const settingType = this.triggerSettingType;
    if (!selectedUnit || !settingType) return;

    const current = this.triggerDirections.get(selectedUnit) ?? { main: 0, sub: 0 };
    current[settingType] = this.currentTriggerAngle;
    this.triggerDirections.set(selectedUnit, current);

    if (settingType === "main") {
      this.triggerSettingType = "sub";
      this.currentTriggerAngle = this.getInitialTriggerAngle(selectedUnit, "sub", this.currentTriggerAngle);
      this.showTriggerFan(selectedUnit, this.currentTriggerAngle);
      return;
    }

    // sub まで確定したタイミングで、呼び出し元へ最終方向を通知する。
    this.deps.onTriggerPairConfirmed?.(selectedUnit, current);
    this.stopTriggerSetting();
    this.deps.onTriggerSettingFinished?.();
  }

  /**
   * 指定ユニットのトリガー方位設定を返す。
   * @param unitObject 対象ユニット。
   * @returns 設定済み方位。未設定なら null。
   */
  public getTriggerDirection(unitObject: ThreeDUnitObject): TriggerDirection | null {
    return this.triggerDirections.get(unitObject) ?? null;
  }

  /**
   * 現在のトリガー表示を破棄する。
   */
  public clearTriggerDisplay(): void {
    if (!this.triggerFan) return;
    this.triggerFan.dispose();
    this.triggerFan = null;
  }

  /**
   * 扇形表示を更新または新規作成する。
   * @param selectedUnit 対象ユニット。
   * @param directionDeg 方位角（度）。
   */
  private showTriggerFan(selectedUnit: ThreeDUnitObject, directionDeg: number): void {
    const state = this.deps.playerCharacterStates.get(selectedUnit);
    if (!state) return;

    const settingType = this.triggerSettingType;
    if (!settingType) return;

    const friendUnit = state.getFriendUnit();
    const triggerName =
      settingType === "main"
        ? friendUnit.usingMainTriggerId as keyof typeof TRIGGER_STATUS
        : friendUnit.usingSubTriggerId as keyof typeof TRIGGER_STATUS;
    const triggerStatus = TRIGGER_STATUS[triggerName];
    if (!triggerStatus) return;

    const fanColor = settingType === "main" ? 0xff6b6b : 0x6b6bff;

    const position = state.getPosition();
    const center = this.deps.placementService.fromGridOnGround(
      this.deps.hexUtils,
      position.col,
      position.row,
      selectedUnit.position.y + 0.02,
    );

    if (!this.triggerFan) {
      this.triggerFan = new ThreeDTriggerFanObject(
        this.deps.scene3d,
        center,
        fanColor,
        directionDeg,
        triggerStatus.angle,
        triggerStatus.range,
        this.deps.gridConfig,
        true,
      );
      return;
    }

    this.triggerFan.updateTriggerAzimuth(
      directionDeg,
      center,
      fanColor,
      triggerStatus.angle,
      triggerStatus.range,
      true,
    );
  }

  /**
   * 既に設定済みのトリガー方位があれば、その角度を初期値として返す。
   * @param unitObject 対象ユニット。
   * @param settingType main/sub のどちらを復元するか。
   * @param fallbackAngle 未設定時の初期角度。
   * @returns 初期表示に使う角度。
   */
  private getInitialTriggerAngle(
    unitObject: ThreeDUnitObject,
    settingType: "main" | "sub",
    fallbackAngle: number,
  ): number {
    const existingDirection = this.triggerDirections.get(unitObject);
    if (!existingDirection) {
      return fallbackAngle;
    }

    return existingDirection[settingType] ?? fallbackAngle;
  }
}