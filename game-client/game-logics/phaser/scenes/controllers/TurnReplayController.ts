import { CharacterManager } from "@/game-logics/characterManager";
import { MAX_TURN } from "@/game-logics/config/game-config";
import { HexUtils } from "@/game-logics/hexUtils";
import { Combat } from "@/game-logics/models/Combat";
import { Turn } from "@/game-logics/models/Turn";
import { GameResult } from "@/types/GameTypes";
import { AttackArrow } from "../../game-objects/graphics/AttackArrow";
import { PlayerCharacterState } from "@/game-logics/entities/PlayerCharacterState";
import { EnemyCharacterState } from "@/game-logics/entities/EnemyCharacterState";

/**
 * TurnReplayController が参照する依存関係。
 *
 * 補足:
 * サーバー受信ターンの再生責務を Scene から段階的に切り出すための最小構成。
 */
export interface TurnReplayControllerDeps {
  scene: Phaser.Scene;
  hexUtils: HexUtils;
  characterManager: CharacterManager;
  onReplayCompleted: (turnNumber: number) => void;
  clearTriggerArrows?: () => void;
  setActionMode?: (isActionMode: boolean) => void;
  setActionAnimationInProgress?: (isInProgress: boolean) => void;
  clearPlannedSteps?: () => void;
  restoreActionPointsText?: () => void;
  updateFieldViewVisibility: () => boolean[][] | undefined;
  completeGame?: (result: GameResult) => void;
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

    this.deps.scene.time.delayedCall(2000, () => {
      this.executeStep(turn, 0);
    });
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
    this.deps.updateFieldViewVisibility();

    // デバッグ用: サーバーからのステップ情報に含まれる視界マップとクライアントの視界マップを照合する。
    // const step = steps[stepIndex];
    // const clientVisibilityMap = step.getVisibilityCells();
    // if (clientVisibilityMap && visibilityMap) {
    //   this.checkVisibilityDiscrepancy(clientVisibilityMap, visibilityMap);
    // }

    const nextStepIndex = stepIndex + 1;
    this.deps.scene.time.delayedCall(1000, () => {
      // 次ステップが存在するかを判定する。
      if (nextStepIndex < steps.length) {
        // 未再生ステップが残っている場合: 次ステップ再生へ進む。
        this.executeStep(turn, nextStepIndex);
      } else {
        // 全ステップ再生済みの場合: フェーズ完了処理へ進む。
        this.completeUnitActionPhase(turn.getTurnNumber());
        console.log("=== 全ステップ実行完了 ===");
        // ゲーム終了判定を行う。
        const gameResult = this.checkGameIsCompleted(turn.getTurnNumber());
        if (gameResult !== "InProgress") {
          console.log("ゲーム終了判定: 結果 =", gameResult);
          // ゲーム終了処理をここに追加する（例: 結果画面への遷移）
          this.deps.completeGame?.(gameResult);
          return;
        }
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
    for (const [actionIndex, action] of step?.getActions().entries() ?? []) {
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
        this.replayCharacterAttack(combat);
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
   * ゲームの終了判定を行う。
   * @param currentTurn 現在のターン番号
   * @returns {{ isPlayerDefeated: boolean; isEnemyDefeated: boolean; }} プレイヤーと敵の敗北状態を含むオブジェクト
   */
  private checkGameIsCompleted(currentTurn: number): GameResult {
    const playerAliveCharacters = this.deps.characterManager.playerCharacters.filter(char => char.getIsBailedOut() === false);
    const enemyAliveCharacters = this.deps.characterManager.enemyCharacters.filter(char => char.getIsBailedOut() === false);

    const isPlayerDefeated = playerAliveCharacters.length === 0;
    const isEnemyDefeated = enemyAliveCharacters.length === 0;

    if (isPlayerDefeated && isEnemyDefeated) {
      return "Draw";
    } else if (isPlayerDefeated) {
      return "Lose";
    } else if (isEnemyDefeated) {
      return "Win";
    } else if (currentTurn >= MAX_TURN) {
      // ターン数上限に達した場合は引き分けとする
      return "Draw";
    } else {
      return "InProgress"; // デフォルトは進行中とする
    }
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

  /**
   * 攻撃を与えた際の攻撃の表示を行う
   * @param combat - 戦闘情報
   */
  private replayCharacterAttack(
    combat: Combat
  ) {
    const attackingCharacter = this.deps.characterManager.findCharacterByUnitId(combat.getAttackingUnitId());

    const drawArrow = (attacker: { x: number; y: number; }, target: { x: number; y: number; }) => {
      // 攻撃エフェクトを表示
      const attackArrow = new AttackArrow(
        this.deps.scene,
        attacker.x,
        attacker.y,
        target.x,
        target.y
      );
      // アニメーション付きの矢印を描画
      attackArrow.drawAnimatedArrow();
    };

    if (attackingCharacter instanceof PlayerCharacterState) {
      // 攻撃元の座標を取得
      const attackerPosition = combat.getAttackerPosition();
      const attackerPixelPos = this.deps.hexUtils.getHexPosition(attackerPosition.col, attackerPosition.row);

      // 攻撃先(防御したユニット)の座標を取得
      const targetPosition = combat.getDefenderPosition();
      const invertedTargetPosition = this.deps.hexUtils.invertPosition(targetPosition);
      const targetPixelPos = this.deps.hexUtils.getHexPosition(invertedTargetPosition.col, invertedTargetPosition.row);

      // 攻撃エフェクトを表示
      drawArrow(attackerPixelPos, targetPixelPos);

    } else if (attackingCharacter instanceof EnemyCharacterState) {
      // 攻撃元の座標を取得
      const attackerPosition = combat.getAttackerPosition();
      const invertedAttackerPosition = this.deps.hexUtils.invertPosition(attackerPosition);
      const attackerPixelPos = this.deps.hexUtils.getHexPosition(invertedAttackerPosition.col, invertedAttackerPosition.row);

      // 攻撃先(防御したユニット)の座標を取得
      const targetPosition = combat.getDefenderPosition();
      const targetPixelPos = this.deps.hexUtils.getHexPosition(targetPosition.col, targetPosition.row);

      // 攻撃エフェクトを表示
      drawArrow(attackerPixelPos, targetPixelPos);
    }
  }
}
