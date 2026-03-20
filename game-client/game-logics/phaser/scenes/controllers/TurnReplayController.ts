import { CharacterManager } from "@/game-logics/characterManager";
import { FieldViewState } from "@/game-logics/entities/FieldViewState";
import { Turn } from "@/game-logics/models/Turn";

/**
 * TurnReplayController が参照する依存関係。
 *
 * 補足:
 * サーバー受信ターンの再生責務を Scene から段階的に切り出すための最小構成。
 */
export interface TurnReplayControllerDeps {
  scene: Phaser.Scene;
  characterManager: CharacterManager;
  onReplayCompleted: (turnNumber: number) => void;
  clearTriggerArrows?: () => void;
  setActionMode?: (isActionMode: boolean) => void;
  setActionAnimationInProgress?: (isInProgress: boolean) => void;
  clearPlannedSteps?: () => void;
  restoreActionPointsText?: () => void;
  updateFieldViewVisibility: () => boolean[][] | undefined;
}

/**
 * 受信 Turn のステップ再生と再生完了時のハンドリングを扱う。
 */
export class TurnReplayController {
  private pendingTurn: Turn | null = null;

  constructor(private readonly deps: TurnReplayControllerDeps) { }

  /**
   * 受信したターンを先頭ステップから順次再生する。
   *
   * @param turn サーバーから受信したターン情報。
   */
  public executeTurn(turn: Turn): void {
    this.deps.characterManager.setAllActionPointsTextToNull();
    this.executeStep(turn, 0);
  }

  /**
   * 指定インデックスのステップを再生し、次ステップへ連鎖させる。
   *
   * @param turn 再生対象のターン。
   * @param stepIndex 再生するステップのインデックス。
   */
  private executeStep(turn: Turn, stepIndex: number): void {
    const steps = turn.getSteps();
    console.log(`=== ステップ ${stepIndex + 1} 実行開始 ===`);

    this.replayActions(turn, stepIndex);
    this.replayCombats(turn, stepIndex);

    // ステップ再生後に視界情報を更新する。
    const visibilityMap = this.deps.updateFieldViewVisibility();

    // デバッグ用: サーバーからのステップ情報に含まれる視界マップとクライアントの視界マップを照合する。
    const step = steps[stepIndex];
    const clientVisibilityMap = step.getVisibilityCells();
    if (clientVisibilityMap && visibilityMap) {
      this.checkVisibilityDiscrepancy(clientVisibilityMap, visibilityMap);
    }

    const nextStepIndex = stepIndex + 1;
    this.deps.scene.time.delayedCall(1500, () => {
      // 次ステップが存在するかを判定する。
      if (nextStepIndex < steps.length) {
        // 未再生ステップが残っている場合: 次ステップ再生へ進む。
        this.executeStep(turn, nextStepIndex);
      } else {
        // 全ステップ再生済みの場合: フェーズ完了処理へ進む。
        this.completeUnitActionPhase(turn.getTurnNumber());
        console.log("=== 全ステップ実行完了 ===");
      }
    });
  }

  /**
   * 1ステップ内のアクション群を再生する。
   *
   * @param turn 再生対象のターン。
   * @param stepIndex 対象ステップのインデックス。
   */
  private replayActions(turn: Turn, stepIndex: number): void {
    const step = turn.getSteps()[stepIndex];
    for (const [actionIndex, action] of step.getActions().entries()) {
      const character = this.deps.characterManager.findCharacterByUnitId(
        action.getUnitId()
      );
      // 対象ユニットのキャラクター参照を取得できたかを判定する。
      if (character) {
        // キャラクターが存在する場合: アクション再生を実行する。
        console.log(`--- アクション ${actionIndex + 1} 開始 ---`);
        character.executeCharacterSingleAction(action, () => { });
      }

      this.deps.clearTriggerArrows?.();
    }
  }

  /**
   * 1ステップ内のコンバット群を再生する。
   *
   * @param turn 再生対象のターン。
   * @param stepIndex 対象ステップのインデックス。
   */
  private replayCombats(turn: Turn, stepIndex: number): void {
    const step = turn.getSteps()[stepIndex];
    for (const [combatIndex, combat] of step.getCombats().entries()) {
      const attackingCharacter = this.deps.characterManager.findCharacterByUnitId(
        combat.getAttackingUnitId()
      );
      // 攻撃側キャラクターを取得できたかを判定する。
      if (attackingCharacter) {
        // 攻撃側が存在する場合: 攻撃演出を再生する。
        console.log(`--- コンバット ${combatIndex + 1} 開始 ---`);
        attackingCharacter.executeCharacterAttack(combat);
      }

      const defendingCharacter = this.deps.characterManager.findCharacterByUnitId(
        combat.getDefendingUnitId()
      );
      // 防御側キャラクターを取得できたかを判定する。
      if (defendingCharacter) {
        // 防御側が存在する場合: 防御/回避演出を再生する。
        defendingCharacter.executeCharacterDefense(combat);
      }
    }
  }

  /**
   * 再生完了時のフェーズ復帰処理を実行する。
   *
   * @param turnNumber 完了したターン番号。
   */
  public completeUnitActionPhase(turnNumber: number): void {
    console.log(`行動フェーズ完了 - 設定モードに戻ります (ターン ${turnNumber})`);
    this.deps.setActionMode?.(false);
    this.deps.setActionAnimationInProgress?.(false);

    this.deps.characterManager.hideAllTriggerFans();
    this.deps.characterManager.resetAllActionPoints();

    this.deps.clearPlannedSteps?.();
    this.deps.restoreActionPointsText?.();
    this.deps.onReplayCompleted(turnNumber);
  }

  /**
   * Scene 初期化前に受け取ったターンをキューへ保持する。
   *
   * @param turn 保留するターン。
   */
  public queuePendingTurn(turn: Turn): void {
    this.pendingTurn = turn;
  }

  /**
   * 保留中ターンがあれば取得し、内部キューから取り除いて返す。
   */
  public dequeuePendingTurn(): Turn | null {
    const queuedTurn = this.pendingTurn;
    this.pendingTurn = null;
    return queuedTurn;
  }

  /**
   * クライアントの視界情報をサーバーからのステップ情報と照らし合わせて差分がないか確認する
   * ローカル環境で動くデバッグ用の関数
   */
  public checkVisibilityDiscrepancy(serverVisibilityMap: boolean[][], clientVisibilityMap: boolean[][]): void {
    for (let row = 0; row < serverVisibilityMap.length; row++) {
      for (let col = 0; col < serverVisibilityMap[row].length; col++) {
        if (serverVisibilityMap[row][col] !== clientVisibilityMap[row][col]) {
          console.warn(`視界の不一致を検出: (${col}, ${row}) - サーバー: ${serverVisibilityMap[row][col]}, クライアント: ${clientVisibilityMap[row][col]}`);
        }
      }
    }
  }
}
