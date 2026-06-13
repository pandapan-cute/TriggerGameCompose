import { FieldViewState } from "@/game-logics/entities/FieldViewState";
import { CharacterManager } from "@/game-logics/characterManager";
import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";
import { MovableHighlightCell } from "../../game-objects/graphics/MovableHighlightCell";

/**
 * SelectionService が参照する依存関係。
 *
 * 補足:
 * この段階では抽出用の最小構成にしている。
 * 実装移行に合わせてコールバックや依存先を段階的に追加する。
 */
export interface SelectionServiceDeps {
  scene: Phaser.Scene;
  characterManager: CharacterManager;
  fieldViewState: FieldViewState;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
  consumeActionPoint: (remainingMoves: number) => void;
  startTriggerSetting: () => void;
  resetTriggerSettingState: () => void;
  updateFieldViewVisibility: () => boolean[][] | undefined;
}

/**
 * キャラクター選択と移動計画に関する責務を扱う。
 *
 * Issue #11 の抽出作業で導入したスケルトンサービス。
 */
export class SelectionService {
  constructor(private readonly deps: SelectionServiceDeps) { }

  /**
   * 六角形座標上のクリックを処理し、選択または移動の分岐へ振り分ける。
   *
   * @param col クリックされた六角形の列。
   * @param row クリックされた六角形の行。
   */
  public handleGridClick(col: number, row: number): void {
    const characterAtPosition =
      this.deps.characterManager.getPlayerCharacterAt(col, row);

    // クリック先にプレイヤーキャラクターがいるかを判定する。
    if (characterAtPosition) {
      // 同一キャラクターの再クリックかどうかを判定する。
      if (characterAtPosition === this.deps.characterManager.selectedCharacter) {
        // 既に選択中のキャラクターを再クリックした場合: トリガー設定へ遷移する。
        this.deps.characterManager.beforePositionState.set(
          this.deps.characterManager.selectedCharacter.image,
          this.deps.characterManager.selectedCharacter.position
        );

        console.log(
          "選択中のキャラクターをクリック: トリガー設定モードに入ります"
        );
        const actionPoints = characterAtPosition.getActionPoints() || 0;
        this.deps.consumeActionPoint(actionPoints - 1);
        this.deps.startTriggerSetting();
      } else {
        // 未選択の別キャラクターをクリックした場合: 対象を選択状態にする。
        this.selectCharacter(characterAtPosition.image);
        console.log(`キャラクターを選択: (${col}, ${row})`);
      }
      return;
    }

    // キャラクター未クリック時に、選択中キャラクターがいるかを判定する。
    if (this.deps.characterManager.selectedCharacter) {
      const actionPoints =
        this.deps.characterManager.playerCharacters.find(
          (char) => char.image === this.deps.characterManager.selectedCharacter?.image
        )?.getActionPoints() || 0;
      const adjacentHexes = this.deps.hexUtils.getAdjacentHexes(
        this.deps.characterManager.selectedCharacter.position.col,
        this.deps.characterManager.selectedCharacter.position.row,
        actionPoints
      );

      const movableHex = adjacentHexes.find(
        (hex) => hex.col === col && hex.row === row
      );

      this.deps.characterManager.beforePositionState.set(
        this.deps.characterManager.selectedCharacter.image,
        this.deps.characterManager.selectedCharacter.position
      );

      // クリック先が移動可能マスかどうかを判定する。
      if (movableHex && !characterAtPosition) {
        // 移動可能マスをクリックした場合: 移動してトリガー設定へ遷移する。
        this.moveSelectedCharacter(col, row);
        this.deps.startTriggerSetting();
        console.log(
          `キャラクターを移動: (${col}, ${row}, AP残り:${movableHex.remainActiveCount})`
        );
        this.deps.consumeActionPoint(movableHex.remainActiveCount);
      } else {
        // 移動不可マスをクリックした場合: 選択を解除する。
        this.clearSelection();
      }
      return;
    }

    console.log(`クリックされた六角形: (${col}, ${row})`);
  }

  /**
   * プレイヤーキャラクターを選択し、選択状態と表示を更新する。
   *
   * @param characterImage ユーザーがクリックしたキャラクター画像オブジェクト。
   */
  public selectCharacter(characterImage: Phaser.GameObjects.Image): void {
    const selectedCharacter =
      this.deps.characterManager.findPlayerCharacterByImage(characterImage);
    // 行動力が残っているキャラクターかを判定する。
    if (selectedCharacter && selectedCharacter.getActionPoints() <= 0) {
      console.log("このキャラクターは既に行動が完了しています。");
      return;
    }

    this.clearSelection();
    this.deps.characterManager.selectedCharacter = selectedCharacter;

    // 選択対象が有効に取得できたかを判定する。
    if (this.deps.characterManager.selectedCharacter) {
      characterImage.setTint(0xffff00);
      this.showMovableHexes();
    }
  }

  /**
   * 現在選択中のキャラクターに対して移動可能マスを表示する。
   */
  public showMovableHexes(): void {
    // 選択中キャラクターが存在するかを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      console.log(
        "キャラクターが選択されていません。",
        this.deps.characterManager.selectedCharacter
      );
      return;
    }

    this.deps.fieldViewState.changeTileText("buildingHeight");

    this.deps.characterManager.movableHexes.forEach((hex) => hex.destroy());
    this.deps.characterManager.movableHexes = [];

    const selectedCharacter = this.deps.characterManager.findPlayerCharacterByImage(
      this.deps.characterManager.selectedCharacter.image
    );
    // 選択中キャラクターの状態取得に成功したかを判定する。
    if (!selectedCharacter) {
      return;
    }

    const actionPoints = selectedCharacter.getActionPoints() || 0;
    const adjacentHexes = this.deps.hexUtils.getAdjacentHexes(
      this.deps.characterManager.selectedCharacter.position.col,
      this.deps.characterManager.selectedCharacter.position.row,
      actionPoints
    );

    const currentPos = this.deps.hexUtils.getHexPosition(
      selectedCharacter.position.col,
      selectedCharacter.position.row
    );
    const currentHex = new MovableHighlightCell(
      this.deps.hexUtils,
      this.deps.scene,
      currentPos,
      {
        fillColor: 0xff8c00,
        fillAlpha: 0.3,
        lineColor: 0xff6600,
        lineAlpha: 1.0,
        lineWidth: 2,
        depth: 0.8,
      }
    );
    this.deps.characterManager.movableHexes.push(currentHex);

    // 行動力が残っている場合のみ隣接マスを描画する。
    if (actionPoints > 0) {
      adjacentHexes.forEach((hex) => {
        // 対象マスに他キャラクターがいない場合のみ移動候補に含める。
        if (!this.deps.characterManager.isCharacterAt(hex.col, hex.row)) {
          const pos = this.deps.hexUtils.getHexPosition(hex.col, hex.row);
          const movableHex = new MovableHighlightCell(
            this.deps.hexUtils,
            this.deps.scene,
            pos,
            {
              fillColor: 0x00ff00,
              fillAlpha: 0.4,
              lineColor: 0x00aa00,
              lineAlpha: 1.0,
              lineWidth: 2,
              depth: 0.8,
            }
          );

          this.deps.characterManager.movableHexes.push(movableHex);
        }
      });
    }
  }

  /**
   * 現在の選択状態、ハイライト表示、および関連UI状態をクリアする。
   */
  public clearSelection(): void {
    // 選択中キャラクターがいる場合のみ表示色を元に戻す。
    if (this.deps.characterManager.selectedCharacter) {
      // プレイヤー/敵で復帰色を切り替える。
      if (
        this.deps.characterManager.playerCharacters.includes(
          this.deps.characterManager.selectedCharacter
        )
      ) {
        // プレイヤーキャラクターの場合の復帰色。
        this.deps.characterManager.selectedCharacter.image.setTint(0xadd8e6);
      } else {
        // 敵キャラクターの場合の復帰色。
        this.deps.characterManager.selectedCharacter.image.setTint(0xffb6c1);
      }
    }

    this.deps.characterManager.movableHexes.forEach((hex) => hex.destroy());
    this.deps.characterManager.movableHexes = [];

    this.deps.resetTriggerSettingState();
    this.deps.characterManager.selectedCharacter = null;
    this.deps.fieldViewState.changeTileText("position");
  }

  /**
   * 選択中のキャラクターを指定座標へ移動する。
   *
   * @param targetCol 移動先の列。
   * @param targetRow 移動先の行。
   */
  public moveSelectedCharacter(targetCol: number, targetRow: number): void {
    // 移動対象が選択済みかを判定する。
    if (!this.deps.characterManager.selectedCharacter) {
      return;
    }

    const targetPosition = this.deps.hexUtils.getHexPosition(targetCol, targetRow);

    this.deps.characterManager.selectedCharacter.image.setPosition(
      targetPosition.x,
      targetPosition.y
    );

    this.deps.characterManager.selectedCharacter.position = {
      col: targetCol,
      row: targetRow,
    };

    this.deps.updateFieldViewVisibility();

    console.log(`キャラクターが (${targetCol}, ${targetRow}) に移動しました`);
  }
}
