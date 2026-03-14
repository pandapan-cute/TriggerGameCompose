import { CharacterManager } from "@/game-logics/characterManager";
import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";
import { CHARACTER_STATUS, TRIGGER_STATUS } from "@/game-logics/config/status";
import { FieldViewState } from "@/game-logics/entities/FieldViewState";
import { TriggerFanShape } from "../../game-objects/graphics/TriggerFanShape";

/**
 * TriggerSettingController が参照する依存関係。
 *
 * 補足:
 * この段階ではスケルトン用の最小構成にしている。
 * GridCellsScene から実装を移す進捗に合わせてコールバックを追加する。
 */
export interface TriggerSettingControllerDeps {
  characterManager: CharacterManager;
  fieldViewState: FieldViewState;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
  isTriggerDragging: () => boolean;
  getTriggerSettingType: () => "main" | "sub" | null;
  setTriggerSettingType: (triggerType: "main" | "sub" | null) => void;
  setTriggerSettingMode: (isEnabled: boolean) => void;
  getCurrentTriggerAngle: () => number;
  setCurrentTriggerAngle: (angle: number) => void;
  getTriggerFan: () => TriggerFanShape | null;
  setTriggerFan: (fan: TriggerFanShape | null) => void;
  getTriggerPoints: () => Phaser.GameObjects.Graphics[] | null;
  setTriggerPoints: (points: Phaser.GameObjects.Graphics[] | null) => void;
  recordActionHistory: () => void;
  showMovableHexes: () => void;
  clearSelection: () => void;
  showActionCompletedText: (character: Phaser.GameObjects.Image) => void;
  checkAllCharactersActionPointsCompleted: () => void;
}

/**
 * 移動・選択後のトリガー角度設定フローを扱う。
 */
export class TriggerSettingController {
  constructor(private readonly scene: Phaser.Scene, private readonly deps: TriggerSettingControllerDeps) { }

  /**
   * 現在選択中のキャラクターでトリガー設定モードに入る。
   */
  public startTriggerSetting(): void {
    // トリガー設定を開始できる選択状態かを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      return;
    }

    this.deps.setTriggerSettingMode(true);
    this.deps.setTriggerSettingType("main");

    this.deps.characterManager.selectedCharacter.image.setTint(0xff00ff);
    this.deps.fieldViewState.changeTileText("position");
    this.showTriggerFan();
  }

  /**
   * 現在のトリガー種別に応じた扇形を描画する。
   */
  public showTriggerFan(): void {
    const selectedCharacter = this.deps.characterManager.selectedCharacter;
    const triggerSettingType = this.deps.getTriggerSettingType();
    // 描画に必要な前提状態（選択キャラ/トリガー種別）が揃っているかを判定する。
    if (!selectedCharacter || !triggerSettingType) {
      return;
    }

    const characterState = this.deps.characterManager.findCharacterByImage(
      selectedCharacter.image
    );
    // キャラクター状態の取得可否を判定する。
    if (!characterState) {
      return;
    }

    const characterKey =
      characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS;
    const characterStatus = CHARACTER_STATUS[characterKey];
    // キャラクター定義情報の取得可否を判定する。
    if (!characterStatus) {
      return;
    }

    const triggerName =
      triggerSettingType === "main" ? characterStatus.main : characterStatus.sub;
    const triggerStatus =
      TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
    // トリガー定義情報の取得可否を判定する。
    if (!triggerStatus) {
      return;
    }

    const angle = triggerStatus.angle;
    const range = triggerStatus.range;

    console.log(
      `${triggerName}（${triggerSettingType}）トリガーの向きを設定してください（角度範囲: ${angle}度, 射程: ${range}）`
    );
    console.log(
      "扇形をドラッグして角度を調整し、マウスを離すかクリックで確定してください"
    );

    const initialAngle = characterState.direction
      ? characterState.direction[triggerSettingType]
      : 0;
    this.deps.setCurrentTriggerAngle(initialAngle);

    const color = triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;
    const pixelPos = this.deps.hexUtils.getHexPosition(
      selectedCharacter.position.col,
      selectedCharacter.position.row
    );

    const triggerFan = new TriggerFanShape(
      this.scene,
      pixelPos.x,
      pixelPos.y,
      color,
      this.deps.getCurrentTriggerAngle(),
      angle,
      range,
      triggerName,
      this.deps.gridConfig,
      this.deps.hexUtils,
      true
    );

    this.deps.setTriggerFan(triggerFan);
    this.deps.setTriggerPoints(
      triggerFan.drawTriggerRangePoints(
        selectedCharacter.position.col,
        selectedCharacter.position.row,
        color
      )
    );
  }

  /**
   * 現在角度に合わせてトリガー扇形の描画を更新する。
   */
  public updateTriggerFan(): void {
    const triggerFan = this.deps.getTriggerFan();
    const selectedCharacter = this.deps.characterManager.selectedCharacter;
    const triggerSettingType = this.deps.getTriggerSettingType();
    // 更新に必要な前提（既存扇形/選択キャラ/トリガー種別）が揃っているかを判定する。
    if (!triggerFan || !selectedCharacter || !triggerSettingType) {
      return;
    }

    const characterState = this.deps.characterManager.findCharacterByImage(
      selectedCharacter.image
    );
    // キャラクター状態の取得可否を判定する。
    if (!characterState) {
      return;
    }

    const characterKey =
      characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS;
    const characterStatus = CHARACTER_STATUS[characterKey];
    // キャラクター定義情報の取得可否を判定する。
    if (!characterStatus) {
      return;
    }

    const triggerName =
      triggerSettingType === "main" ? characterStatus.main : characterStatus.sub;
    const triggerStatus =
      TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
    // トリガー定義情報の取得可否を判定する。
    if (!triggerStatus) {
      return;
    }

    triggerFan.getData("label").destroy();
    triggerFan.destroy();
    this.deps.getTriggerPoints()?.forEach((point) => point.destroy());

    const angle = triggerStatus.angle;
    const range = triggerStatus.range;
    const color = triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;
    const pixelPos = this.deps.hexUtils.getHexPosition(
      selectedCharacter.position.col,
      selectedCharacter.position.row
    );

    const newTriggerFan = new TriggerFanShape(
      this.scene,
      pixelPos.x,
      pixelPos.y,
      color,
      this.deps.getCurrentTriggerAngle(),
      angle,
      range,
      triggerName,
      this.deps.gridConfig,
      this.deps.hexUtils,
      true
    );
    this.deps.setTriggerFan(newTriggerFan);

    this.deps.setTriggerPoints(
      newTriggerFan.drawTriggerRangePoints(
        selectedCharacter.position.col,
        selectedCharacter.position.row,
        color
      )
    );
  }

  /**
   * ポインタ位置に応じて現在のトリガー角度を更新する。
   *
   * @param pointer Phaser 入力で取得した現在のポインタ情報。
   */
  public updateTriggerAngleFromPointer(pointer: Phaser.Input.Pointer): void {
    // ドラッグ更新を実行できる前提（ドラッグ中/選択キャラ/扇形存在）が揃っているかを判定する。
    if (
      !this.deps.isTriggerDragging() ||
      !this.deps.characterManager.selectedCharacter ||
      !this.deps.getTriggerFan()
    ) {
      return;
    }

    const centerPos = this.deps.hexUtils.getHexPosition(
      this.deps.characterManager.selectedCharacter.position.col,
      this.deps.characterManager.selectedCharacter.position.row
    );
    const newAngle = this.deps.hexUtils.calculateMouseAngle(
      centerPos.x,
      centerPos.y,
      pointer.x,
      pointer.y,
      this.scene.cameras.main
    );

    this.deps.setCurrentTriggerAngle(newAngle);
    this.updateTriggerFan();
  }

  /**
   * 現在のトリガー方向を確定し、次の設定フローへ進める。
   *
   * @param direction 設定する方向角度（度）。
   */
  public completeTriggerSetting(direction: number): void {
    const selectedCharacter = this.deps.characterManager.selectedCharacter;
    const triggerSettingType = this.deps.getTriggerSettingType();
    // 設定確定に必要な前提（選択キャラ/トリガー種別）が揃っているかを判定する。
    if (!selectedCharacter || !triggerSettingType) {
      return;
    }

    const characterState = this.deps.characterManager.findCharacterByImage(
      selectedCharacter.image
    );
    // キャラクター状態の取得可否を判定する。
    if (!characterState) {
      return;
    }

    let directions = characterState.direction;
    // 方向情報が未初期化なら初期化する。
    if (!directions) {
      directions = { main: 0, sub: 0 };
      characterState.direction = directions;
    }

    directions[triggerSettingType] = direction;

    console.log(
      `${triggerSettingType}トリガーの向きを ${direction.toFixed(1)}度 に設定しました`
    );

    // main 設定直後か、sub 設定完了かで遷移先を分岐する。
    if (triggerSettingType === "main") {
      // main を確定した場合: sub 設定へ進める。
      this.deps.setTriggerSettingType("sub");
      this.clearTriggerDisplay();
      this.showTriggerFan();
    } else {
      // sub まで確定した場合: トリガー設定を終了する。
      this.finishTriggerSetting();
    }
  }

  /**
   * トリガー設定を終了し、設定後のUI/状態更新を行う。
   */
  public finishTriggerSetting(): void {
    this.deps.recordActionHistory();

    this.deps.setTriggerSettingMode(false);
    this.deps.setTriggerSettingType(null);
    this.clearTriggerDisplay();

    console.log("トリガー設定が完了しました");

    const selectedCharacter = this.deps.characterManager.selectedCharacter;
    // 選択中キャラクターが存在するかを判定する。
    if (!selectedCharacter) {
      return;
    }

    const remainingActionPoints =
      this.deps.characterManager.findPlayerCharacterByImage(
        selectedCharacter.image
      )?.getActionPoints() ?? 0;

    // 行動力の残量に応じて次のUI遷移を分岐する。
    if (remainingActionPoints > 0) {
      // 行動力が残っている場合: 選択維持のまま移動候補を再表示する。
      console.log(
        `行動力が${remainingActionPoints}残っています。次の行動を設定してください。`
      );
      this.deps.showMovableHexes();
    } else {
      // 行動力が0の場合: 行動済み表示を出して選択を解除する。
      console.log("行動力が0になりました。キャラクター選択をクリアします。");
      this.deps.showActionCompletedText(selectedCharacter.image);
      this.deps.clearSelection();
    }

    this.deps.checkAllCharactersActionPointsCompleted();
  }

  /**
   * トリガー扇形と関連する一時描画オブジェクトを破棄する。
   */
  public clearTriggerDisplay(): void {
    const triggerFan = this.deps.getTriggerFan();
    // 扇形表示が存在する場合のみ破棄処理を行う。
    if (!triggerFan) {
      return;
    }

    triggerFan.getData("label").destroy();
    triggerFan.destroy();
    this.deps.setTriggerFan(null);
    this.deps.getTriggerPoints()?.forEach((point) => point.destroy());
    this.deps.setTriggerPoints(null);
  }
}
