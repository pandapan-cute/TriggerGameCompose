import { Position } from "@/game-logics/types";
import { HexUtils } from "@/game-logics/hexUtils";
import { EnemyUnit } from "@/types/EnemyUnit";
import { UnitType } from "@/types/UnitType";
import { ThreeDUnitObject } from "@/game-logics/3d-version/graphics/ThreeDUnitObject";

/**
 * 3D版の敵ユニット状態。
 *
 * 2D版の EnemyCharacterState と同じく、
 * 敵ユニットの状態更新と 3D 表示更新の入口をこのクラスに集約する。
 */
export class ThreeDEnemyCharacterState {
  private displayGridPosition: Position | null = null;

  constructor(
    private readonly unitObject: ThreeDUnitObject,
    private readonly enemyUnit: EnemyUnit,
    private readonly hexUtils: HexUtils,
  ) {
    // 初期表示時点の装備トリガーを 3D モデルへ反映する。
    this.syncTriggerVisuals();
  }

  /** 3Dユニット表示オブジェクトを返す。 */
  public getUnitObject(): ThreeDUnitObject {
    return this.unitObject;
  }

  /** 保持している敵ユニット実体を返す。 */
  public getEnemyUnit(): EnemyUnit {
    return this.enemyUnit;
  }

  /** 画面上に表示可能な盤面座標を返す。 */
  public getDisplayGridPosition(): Position | null {
    return this.displayGridPosition;
  }

  /**
   * 3D リプレイ時の 1 アクション結果を敵ユニットへ適用する。
   *
   * 位置変換自体は controller 側で済ませ、ここでは敵ユニット実体と 3D 表示を同期する。
   */
  public syncReplayState(options: {
    unitTypeId: UnitType;
    displayGridPosition: Position;
    worldPosition: { x: number; y: number; z: number; };
    currentActionPoints: number;
    usingMainTriggerId: string;
    usingSubTriggerId: string;
  }): void {
    this.enemyUnit.unitTypeId = options.unitTypeId;
    this.enemyUnit.position = { ...this.hexUtils.invertPosition(options.displayGridPosition) };
    this.enemyUnit.currentActionPoints = options.currentActionPoints;
    this.enemyUnit.usingMainTriggerId = options.usingMainTriggerId;
    this.enemyUnit.usingSubTriggerId = options.usingSubTriggerId;
    this.displayGridPosition = { ...options.displayGridPosition };

    this.unitObject.syncVisualState({
      unitTypeId: options.unitTypeId,
      visible: !this.enemyUnit.isBailout,
      position: options.worldPosition,
      usingMainTriggerId: options.usingMainTriggerId,
      usingSubTriggerId: options.usingSubTriggerId,
    });
  }

  /**
   * 撃破状態を反映する。
   */
  public setBailout(isBailout: boolean): void {
    this.enemyUnit.isBailout = isBailout;
    this.unitObject.updateVisibility(!isBailout);
  }

  /**
   * enemyUnit が保持する現在装備トリガーを 3D モデルへ同期する。
   */
  private syncTriggerVisuals(): void {
    this.unitObject.syncEquippedTriggers({
      usingMainTriggerId: this.enemyUnit.usingMainTriggerId,
      usingSubTriggerId: this.enemyUnit.usingSubTriggerId,
    });
  }
}