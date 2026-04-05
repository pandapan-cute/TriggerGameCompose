import { CharacterManager } from "@/game-logics/characterManager";
import { CHARACTER_STATUS } from "@/game-logics/config/status";
import { Action } from "@/game-logics/models/Action";
import { ActionType } from "@/game-logics/models/Action";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { HexUtils } from "@/game-logics/hexUtils";
import { ActionCompletedText } from "../../game-objects/texts/ActionCompletedText";

/**
 * TurnPlanner が参照する依存関係。
 *
 * 補足:
 * Step 構築と行動力管理を段階的に Scene から分離するための最小構成。
 */
export interface TurnPlannerDeps {
  scene: Phaser.Scene;
  characterManager: CharacterManager;
  turn: Turn;
  hexUtils: HexUtils;
  sendServerTurn: (steps: Step[]) => void;
}

/**
 * プレイヤーの行動計画（Step構築）と AP 管理を扱う。
 */
export class TurnPlanner {
  constructor(private readonly deps: TurnPlannerDeps) { }

  /**
   * 選択中キャラクターの行動力を消費し、表示を更新する。
   *
   * @param remainingMoves 消費後の残り行動回数。
   */
  public consumeActionPoint(remainingMoves: number): void {
    // 行動力を消費できる選択中キャラクターがいるかを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      return;
    }

    const currentActionPoints =
      this.deps.characterManager.findPlayerCharacterByImage(
        this.deps.characterManager.selectedCharacter?.image
      )?.getActionPoints() ?? 0;

    // 現在行動力が1以上残っているかを判定する。
    if (currentActionPoints && currentActionPoints > 0) {
      // 行動力が残っている場合: 消費と表示更新を行う。
      this.deps.characterManager.findPlayerCharacterByImage(
        this.deps.characterManager.selectedCharacter?.image
      )!.setActionPoints(remainingMoves);

      console.log(
        `キャラクター${this.deps.characterManager.selectedCharacter?.id}の行動力を消費しました。残り: ${remainingMoves}`
      );

      this.deps.characterManager.selectedCharacter.updateActionPointsDisplay(
        this.deps.scene
      );
    }
  }

  /**
   * 行動完了テキストを表示する
   */
  public showActionCompletedText(character: Phaser.GameObjects.Image) {
    const characterState =
      this.deps.characterManager.findPlayerCharacterByImage(character);
    if (!characterState) return;

    const pixelPos = this.deps.hexUtils.getHexPosition(
      characterState.position.col,
      characterState.position.row
    );

    // 既存のテキストがあれば削除
    const existingText = characterState.getCompleteText();
    if (existingText) {
      existingText.destroy();
    }

    // 新しいテキストを作成
    const text = new ActionCompletedText(
      this.deps.scene,
      pixelPos.x,
      pixelPos.y - 40,
      "行動設定済み"
    );

    characterState.setCompleteText(text);
  }


  /**
   * 全プレイヤーキャラクターの行動力を集計し、
   * 全員完了時にサーバー送信用のステップを送出する。
   */
  public checkAllCharactersActionPointsCompleted(): void {
    let allCompleted = true;
    let totalRemainingPoints = 0;

    for (const character of this.deps.characterManager.playerCharacters) {
      // ベイルアウト済みキャラクターは行動設定対象外として扱う。
      if (character.getIsBailedOut()) {
        continue;
      }

      const actionPoints =
        this.deps.characterManager.findPlayerCharacterByImage(character.image)
          ?.getActionPoints() || 0;
      totalRemainingPoints += actionPoints;
      // 1人でも行動力が残っているかを判定する。
      if (actionPoints > 0) {
        allCompleted = false;
      }
    }

    console.log(`残り行動力合計: ${totalRemainingPoints}`);

    // 全員完了かつプレイヤーキャラクターが存在するかを判定する。
    if (allCompleted && this.deps.characterManager.playerCharacters.length > 0) {
      // 全員完了している場合: サーバーへ計画済みステップを送信する。
      console.log(
        "全キャラクターの行動が完了しました！行動履歴を送信します..."
      );
      this.deps.sendServerTurn(this.deps.turn.getSteps());
    }
  }

  /**
   * 現在選択中キャラクターの行動を Turn の Step 履歴へ記録する。
   */
  public recordActionHistory(): void {
    // 行動履歴を記録できる選択中キャラクターがいるかを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      return;
    }

    const beforePosition = this.deps.characterManager.beforePositionState.get(
      this.deps.characterManager.selectedCharacter.image
    );

    // 移動前座標があり、かつ現在座標と異なるかを判定する。
    if (
      beforePosition &&
      beforePosition !== this.deps.characterManager.selectedCharacter.position
    ) {
      // 移動している場合: 経路上の各ステップを履歴へ追加する。
      const { col, row } = beforePosition;

      const movePath = this.deps.hexUtils.findPath(
        { col: col, row: row },
        this.deps.characterManager.selectedCharacter.position
      );

      for (const step of movePath) {
        this.pushActionHistory(step.col, step.row);
      }
    } else {
      // 移動していない場合: 現在位置のみを履歴へ追加する。
      const { col, row } = this.deps.characterManager.selectedCharacter.position;
      this.pushActionHistory(col, row);
    }
  }

  /**
   * 単一マス分の移動・トリガー情報を 1 アクションとして履歴へ追加する。
   *
   * @param col 記録対象の列座標。
   * @param row 記録対象の行座標。
   */
  private pushActionHistory(col: number, row: number): void {
    // 行動履歴を構築できる選択中キャラクターがいるかを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      return;
    }

    const characterState = this.deps.characterManager.findPlayerCharacterByImage(
      this.deps.characterManager.selectedCharacter.image
    );
    // 選択キャラクターの状態を取得できたかを判定する。
    if (!characterState) {
      return;
    }

    const directions = characterState.direction;
    const mainTrigger =
      CHARACTER_STATUS[
        characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS
      ]?.main ?? null;
    const subTrigger =
      CHARACTER_STATUS[
        characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS
      ]?.sub ?? null;

    // 方向情報とトリガー情報が履歴記録に必要な形で揃っているかを判定する。
    if (!directions || !mainTrigger || !subTrigger) {
      // 必要情報が不足している場合: 警告して記録を中断する。
      console.warn("行動履歴の記録に失敗", directions, mainTrigger, subTrigger);
      return;
    }

    const action: Action = new Action(
      ActionType.Move,
      this.deps.characterManager.selectedCharacter.getUnitId(),
      this.deps.characterManager.selectedCharacter.getUnitTypeId(),
      {
        col: col,
        row: row,
      },
      mainTrigger,
      subTrigger,
      directions.main,
      directions.sub
    );

    this.deps.turn.addActionWithIndex(
      this.deps.characterManager.selectedCharacter.getCurrentStep(),
      action
    );
    this.deps.characterManager.selectedCharacter.advanceStep();

    console.log(
      `行動履歴を記録: キャラクター${characterState.getUnitTypeId()}, 位置(${col}, ${row}), mainトリガー: ${directions.main.toFixed(1)}度, subトリガー: ${directions.sub.toFixed(1)}度`
    );
  }

  /**
   * 計画中ターンのステップ履歴をクリアする。
   */
  public clearPlannedSteps(): void {
    this.deps.turn.clearSteps();
  }

  /**
   * 現在保持している計画ターンを返す。
   */
  public getPlannedTurn(): Turn {
    return this.deps.turn;
  }
}
