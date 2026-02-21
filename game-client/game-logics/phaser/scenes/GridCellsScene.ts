'use client';
import { FieldViewState } from "../../entities/FieldViewState";
import { GameView } from "../../GameView";
import { HexUtils } from "../../hexUtils";
import { BackCanvasTexture } from "../textures/BackCanvasTexture";
import { GridConfig } from "../../types";
import "phaser";
import { UnitImageLoader } from "./loader/UnitImageLoader";
import { GameAssetsLoader } from "./loader/GameAssetsLoader";
import { GameCamera } from "../cameras/GameCamera";
import { CharacterManager } from "@/game-logics/characterManager";
import { CHARACTER_STATUS, TRIGGER_STATUS } from "@/game-logics/config/status";
import { PlayerCharacterState } from "@/game-logics/entities/PlayerCharacterState";
import { EnemyCharacterState } from "@/game-logics/entities/EnemyCharacterState";
import { HighLightCell } from "../game-objects/graphics/HighLightCell";
import { MovableHighlightCell } from "../game-objects/graphics/MovableHighlightCell";
import { ActionCompletedText } from "../game-objects/texts/ActionCompletedText";
import { EnemyUnit } from "@/game-logics/models/EnemyUnit";
import { FriendUnit } from "@/game-logics/models/FriendUnit";
import { Step } from "@/game-logics/models/Step";
import { Turn } from "@/game-logics/models/Turn";
import { Action, ActionType } from "@/game-logics/models/Action";
import { TriggerFanShape } from "../game-objects/graphics/TriggerFanShape";

/**
 * グリッドセルを管理するPhaserのシーン
 */
export class GridCellsScene extends Phaser.Scene {

  // Phaserオブジェクト
  private hoveredCell: { x: number; y: number; } | null = null; // マウスでホバーしているセル
  private cellHighlight!: HighLightCell; // セルのハイライト表示用

  /** キャラクター管理 */
  private characterManager: CharacterManager = new CharacterManager();

  /** フィールドビューの状態管理 */
  private fieldViewState!: FieldViewState;

  // トリガー設定フェーズ
  private triggerSettingMode: boolean = false; // トリガー設定モード
  private triggerSettingType: "main" | "sub" | null = null; // 設定中のトリガータイプ
  private triggerFan: TriggerFanShape | null = null; // トリガー扇形の表示
  private triggerPoints: Phaser.GameObjects.Graphics[] | null = null;
  private isDraggingTrigger: boolean = false; // トリガー扇形をドラッグ中かどうか
  private currentTriggerAngle: number = 0; // 現在のトリガー角度

  constructor(private friendUnits: FriendUnit[], private enemyUnits: EnemyUnit[], private sendServerTurn: (steps: Step[]) => void) {
    super({ key: "GridScene" });
    console.log("GridCellsSceneコンストラクタ: friendUnits =", friendUnits, "enemyUnits =", enemyUnits);
  }

  /** ターンのステップ情報を格納 */
  private turn = new Turn();

  // ユニット行動モード関連
  private isActionMode: boolean = false;
  private actionAnimationInProgress: boolean = false;
  /** ユニット行動モード中のトリガー矢印の配列 */
  private triggerArrows: Phaser.GameObjects.Graphics[] = [];
  /** 初期化前に受け取ったターン */
  private pendingTurn: Turn | null = null;

  /** グリッドの設定値 */
  private gridConfig: GridConfig = {
    gridSize: 32,
    gridWidth: 36,
    gridHeight: 36,
    hexRadius: 24,
    hexWidth: 24 * 2,
    hexHeight: 24 * Math.sqrt(3),
    marginLeft: 0,
    marginTop: 0,
  };
  /** グリッドフィールドの関数群 */
  private hexUtils!: HexUtils;
  /** ゲーム表示関連のクラス */
  private gameView!: GameView;

  /**
  * Phaserのpreload段階で呼ばれる
  * アセット（画像、音声など）の読み込みを行う
  */
  preload() {
    new BackCanvasTexture(this, this.gridConfig); // 背景テクスチャの作成
    new UnitImageLoader(this);
    new GameAssetsLoader(this);
  }

  /**
   * 余白を初期化する（画面サイズの半分程度）
   */
  private initializeMargins() {
    // ゲームのキャンバスサイズを取得
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // 画面の横幅/縦幅の半分程度の余白を設定
    this.gridConfig = {
      ...this.gridConfig,
      marginLeft: gameWidth * 0.5,
      marginTop: gameHeight * 0.5,
    };
  }

  /**
   * 六角形グリッドのユーティリティを初期化する
   */
  initializeGameConfig() {
    this.hexUtils = new HexUtils(this.gridConfig);
    this.gameView = new GameView(this, this.gridConfig);
    this.fieldViewState = new FieldViewState(
      this.hexUtils,
      this,
      this.gridConfig
    );
  }

  /**
   * Phaserのcreate段階で呼ばれる
   * ゲームオブジェクトの初期化を行う
   */
  create() {
    this.initializeMargins(); // 余白を初期化
    new GameCamera(this, this.gridConfig); // カメラの設定を最初に行う
    this.initializeGameConfig(); // 六角形グリッドの設定値初期化
    // this.setupMatchmakingListeners(); // マッチ決定後のイベントリスナーを設定
    this.cellHighlight = new HighLightCell(this); // グリッドラインを描画
    this.createCharacters(); // キャラクターを配置
    this.createMouseInteraction(); // マウスイベントを設定
    if (this.pendingTurn) {
      const queuedTurn = this.pendingTurn;
      this.pendingTurn = null;
      this.executeTurn(queuedTurn);
    }
    // this.setupActionModeListeners(); // 行動モードのイベントリスナーを設定
  }

  /**
   * マウスイベントを設定する（六角形グリッド対応）
   */
  private createMouseInteraction() {
    // カメラドラッグ用の変数
    let isDraggingCamera = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let cameraStartX = 0;
    let cameraStartY = 0;
    const DRAG_THRESHOLD = 10;

    // ピンチジェスチャー用の変数
    let initialDistance = 0;
    let isPinching = false;
    let initialZoom = 1;

    // マウス移動イベント
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // ピンチ中かつ2本指がタッチされている場合
      if (isPinching && this.input.pointer2 && this.input.pointer2.isDown) {
        const pointer1 = this.input.activePointer;
        const pointer2 = this.input.pointer2;

        // 現在の2本指間の距離を計算
        const currentDistance = this.hexUtils.calculateDistance(
          pointer1.x,
          pointer1.y,
          pointer2.x,
          pointer2.y
        );

        if (initialDistance > 0) {
          // 距離の比率でズーム倍率を計算
          const scale = currentDistance / initialDistance;
          const newZoom = initialZoom * scale;

          // ズーム適用（範囲制限付き）
          const clampedZoom = Phaser.Math.Clamp(newZoom, 0.25, 3.0);
          this.cameras.main.setZoom(clampedZoom);
        }
        return;
      }
      // 一本指でのカメラドラッグ中の処理
      if (!this.triggerFan && pointer.leftButtonDown()) {
        const deltaX = pointer.x - dragStartX;
        const deltaY = pointer.y - dragStartY;
        // しきい値を超えた場合はカメラドラッグとして判定
        if (
          Math.abs(deltaX) > DRAG_THRESHOLD ||
          Math.abs(deltaY) > DRAG_THRESHOLD
        ) {
          this.cameras.main.scrollX = cameraStartX - deltaX;
          this.cameras.main.scrollY = cameraStartY - deltaY;
          isDraggingCamera = true;
        }
        return;
      }

      // 行動モード中はカメラドラッグ以外の操作を無効化
      if (this.isActionMode || this.actionAnimationInProgress) {
        return;
      }

      // トリガー扇形をドラッグ中の場合
      if (
        this.isDraggingTrigger &&
        this.characterManager.selectedCharacter &&
        this.triggerFan
      ) {
        const centerPos = this.hexUtils.getHexPosition(
          this.characterManager.selectedCharacter.position.col,
          this.characterManager.selectedCharacter.position.row
        );
        const newAngle = this.hexUtils.calculateMouseAngle(
          centerPos.x,
          centerPos.y,
          pointer.x,
          pointer.y,
          this.cameras.main
        );
        this.currentTriggerAngle = newAngle;
        this.updateTriggerFan();
        return;
      }

      // 通常のホバー処理（左クリック操作でない場合はスキップ）
      if (
        !this.triggerSettingMode &&
        !pointer.rightButtonDown() &&
        !pointer.middleButtonDown()
      ) {
        const hexCoord = this.hexUtils.pixelToHex(
          pointer.x,
          pointer.y,
          this.cameras.main
        );
        if (
          hexCoord.col >= 0 &&
          hexCoord.col < this.gridConfig.gridWidth &&
          hexCoord.row >= 0 &&
          hexCoord.row < this.gridConfig.gridHeight
        ) {
          this.hoveredCell = { x: hexCoord.col, y: hexCoord.row };
          this.updateCellHighlight();
        } else {
          this.hoveredCell = null;
          this.cellHighlight.setVisible(false);
        }
      }
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // 2本目の指がタッチされた場合
      if (this.input.pointer2 && this.input.pointer2.isDown) {
        const pointer1 = this.input.activePointer;
        const pointer2 = this.input.pointer2;

        // 2本指間の初期距離を計算
        initialDistance = this.hexUtils.calculateDistance(
          pointer1.x,
          pointer1.y,
          pointer2.x,
          pointer2.y
        );
        isPinching = true;
        initialZoom = this.cameras.main.zoom;
        return;
      }
      // 一本指ならカメラドラッグ開始
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      cameraStartX = this.cameras.main.scrollX;
      cameraStartY = this.cameras.main.scrollY;

      // トリガー設定モードの場合
      if (
        this.triggerSettingMode &&
        this.triggerFan &&
        this.characterManager.selectedCharacter
      ) {
        this.isDraggingTrigger = true;
        return;
      }
    });

    // マウスクリックイベント
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      // どちらかの指が離れたらピンチ終了
      if (!this.input.pointer2 || !this.input.pointer2.isDown) {
        isPinching = false;
        initialDistance = 0;
      }
      // カメラドラッグ終了
      if (isDraggingCamera) {
        isDraggingCamera = false;
        return;
      }

      // 行動モード中はカメラドラッグ以外の操作を無効化
      if (this.isActionMode || this.actionAnimationInProgress) {
        console.log("行動実行中のため操作できません");
        return;
      }

      if (this.isDraggingTrigger && this.triggerSettingMode) {
        this.isDraggingTrigger = false;
        this.completeTriggerSetting(this.currentTriggerAngle);
        return;
      }

      // マウス座標を六角形グリッド座標に変換
      const hexCoord = this.hexUtils.pixelToHex(
        pointer.x,
        pointer.y,
        this.cameras.main
      );

      // グリッド範囲内の場合
      if (
        hexCoord.col >= 0 &&
        hexCoord.col < this.gridConfig.gridWidth &&
        hexCoord.row >= 0 &&
        hexCoord.row < this.gridConfig.gridHeight
      ) {
        // そのマスにキャラクターがいるかチェック
        const characterAtPosition =
          this.characterManager.getPlayerCharacterAt(
            hexCoord.col,
            hexCoord.row
          );

        if (characterAtPosition) {
          if (
            characterAtPosition === this.characterManager.selectedCharacter
          ) {
            // 移動前のポジションを保存
            this.characterManager.beforePositionState.set(
              this.characterManager.selectedCharacter.image,
              this.characterManager.selectedCharacter.position
            );

            // 既に選択されているキャラクターを再度クリック：トリガー設定モードに入る
            console.log(
              `選択中のキャラクターをクリック: トリガー設定モードに入ります`
            );
            const actionPoints = characterAtPosition.getActionPoints() || 0;
            // 行動力を消費
            this.consumeActionPoint(actionPoints - 1);
            this.startTriggerSetting();
          } else {
            // 他のプレイヤーキャラクターをクリックした場合：選択
            this.selectCharacter(characterAtPosition.image);
            console.log(
              `キャラクターを選択: (${hexCoord.col}, ${hexCoord.row})`
            );
          }
        } else if (this.characterManager.selectedCharacter) {
          // キャラクターが選択されている状態で空のマスをクリックしたパターン
          const actionPoints =
            this.characterManager.playerCharacters.find(
              (char) =>
                char.image === this.characterManager.selectedCharacter?.image
            )?.getActionPoints() || 0;
          const adjacentHexes = this.hexUtils.getAdjacentHexes(
            this.characterManager.selectedCharacter.position.col,
            this.characterManager.selectedCharacter.position.row,
            actionPoints
          );

          // クリックされた位置が移動可能マスかチェック
          const isMovable = adjacentHexes.find(
            (hex) => hex.col === hexCoord.col && hex.row === hexCoord.row
          );

          // 移動前のポジションを保存
          this.characterManager.beforePositionState.set(
            this.characterManager.selectedCharacter.image,
            this.characterManager.selectedCharacter.position
          );

          if (isMovable && !characterAtPosition) {
            this.moveCharacter(hexCoord.col, hexCoord.row);
            // 移動後にトリガー設定モードに入る
            this.startTriggerSetting();
            console.log(
              `キャラクターを移動: (${hexCoord.col}, ${hexCoord.row}, AP残り:${isMovable.remainActiveCount})`
            );
            // 行動力を消費
            this.consumeActionPoint(isMovable.remainActiveCount);
          } else {
            // 移動不可能なマスをクリック：選択解除
            this.clearSelection();
          }
        } else {
          // 何も選択されていない状態でクリック
          console.log(
            `クリックされた六角形: (${hexCoord.col}, ${hexCoord.row})`
          );
        }
      }
    });
    // ネイティブタッチイベントによるピンチジェスチャー強化
    this.gameView.setupNativePinchGesture(this.cameras.main);
  }

  /**
   * キャラクターを選択する
   * @param character 選択されたキャラクター
   */
  private selectCharacter(character: Phaser.GameObjects.Image) {
    // 行動力をチェック
    const selectedCharacter =
      this.characterManager.findPlayerCharacterByImage(character);
    if (selectedCharacter && selectedCharacter.getActionPoints() <= 0) {
      console.log("このキャラクターは既に行動が完了しています。");
      return;
    }

    // 既に選択されているキャラクターをリセット
    this.clearSelection();

    // 新しいキャラクターを選択
    this.characterManager.selectedCharacter = selectedCharacter;

    if (this.characterManager.selectedCharacter) {
      // 選択されたキャラクターを強調表示
      character.setTint(0xffff00); // 黄色で強調

      // 移動可能なマスを表示
      this.showMovableHexes();
    }
  }

  /**
   * 移動可能な六角形マスを表示する
   */
  private showMovableHexes() {
    if (!this.characterManager.selectedCharacter) {
      console.log(
        "キャラクターが選択されていません。",
        this.characterManager.selectedCharacter
      );
      return;
    }

    // 背景に座標の高さを表示する
    this.fieldViewState.changeTileText("buildingHeight");

    // 前回の移動可能マスを削除
    this.characterManager.movableHexes.forEach((hex) => hex.destroy());
    this.characterManager.movableHexes = [];

    const selectedCharacter =
      this.characterManager.findPlayerCharacterByImage(
        this.characterManager.selectedCharacter.image
      );
    if (!selectedCharacter) return;

    // 行動力をチェック
    const actionPoints = selectedCharacter.getActionPoints() || 0;

    const adjacentHexes = this.hexUtils.getAdjacentHexes(
      this.characterManager.selectedCharacter.position.col,
      this.characterManager.selectedCharacter.position.row,
      actionPoints
    );

    // 現在の位置をオレンジ色でハイライト（トリガー設定可能を示す）
    const currentPos = this.hexUtils.getHexPosition(
      selectedCharacter.position.col,
      selectedCharacter.position.row
    );
    const currentHex = new MovableHighlightCell(this.hexUtils, this, currentPos, {
      fillColor: 0xff8c00,
      fillAlpha: 0.3,
      lineColor: 0xff6600,
      lineAlpha: 1.0,
      lineWidth: 2,
      depth: 0.8,
    });
    this.characterManager.movableHexes.push(currentHex);

    // 隣接する6マスに緑色のハイライトを表示（行動力が残っている場合のみ）
    if (actionPoints > 0) {
      adjacentHexes.forEach((hex) => {
        // そのマスに他のキャラクターがいない場合のみ移動可能
        if (!this.characterManager.isCharacterAt(hex.col, hex.row)) {
          const pos = this.hexUtils.getHexPosition(hex.col, hex.row);
          const movableHex = new MovableHighlightCell(this.hexUtils, this, pos, {
            fillColor: 0x00ff00,
            fillAlpha: 0.4,
            lineColor: 0x00aa00,
            lineAlpha: 1.0,
            lineWidth: 2,
            depth: 0.8,
          });

          // 移動可能マスのリストに追加
          this.characterManager.movableHexes.push(movableHex);
        }
      });
    }
  }

  /**
   * 選択状態をクリアする
   */
  private clearSelection() {
    // 選択されたキャラクターの色を元に戻す
    if (this.characterManager.selectedCharacter) {
      // プレイヤーキャラクターか敵キャラクターかで色を分ける
      if (
        this.characterManager.playerCharacters.includes(
          this.characterManager.selectedCharacter
        )
      ) {
        this.characterManager.selectedCharacter.image.setTint(0xadd8e6); // 薄い青色
      } else {
        this.characterManager.selectedCharacter.image.setTint(0xffb6c1); // 薄い赤色
      }
    }

    // 移動可能マスを削除
    this.characterManager.movableHexes.forEach((hex) => hex.destroy());
    this.characterManager.movableHexes = [];

    // トリガー設定モードをリセット
    this.triggerSettingMode = false;
    this.triggerSettingType = null;

    // 選択状態をリセット
    this.characterManager.selectedCharacter = null;

    // 背景を通常表示に戻す
    this.fieldViewState.changeTileText("position");
  }

  /**
   * キャラクターを指定された位置に移動する
   * @param targetCol 移動先の列
   * @param targetRow 移動先の行
   */
  private moveCharacter(targetCol: number, targetRow: number) {
    if (!this.characterManager.selectedCharacter) return;

    // 移動先の位置を計算
    const targetPosition = this.hexUtils.getHexPosition(targetCol, targetRow);

    // キャラクターを移動
    this.characterManager.selectedCharacter.image.setPosition(
      targetPosition.x,
      targetPosition.y
    );

    // // キャラクターの位置情報を更新（移動後の位置）
    this.characterManager.selectedCharacter.position = {
      col: targetCol,
      row: targetRow,
    };

    console.log(`キャラクターが (${targetCol}, ${targetRow}) に移動しました`);
  }

  private updateCellHighlight() {
    if (!this.hoveredCell) return;

    // 前のハイライトをクリア
    this.cellHighlight.clear();

    // 六角形の位置を計算
    const pos = this.hexUtils.getHexPosition(
      this.hoveredCell.x,
      this.hoveredCell.y
    );

    // 薄い青色で六角形をハイライト
    this.cellHighlight.fillStyle(0x87ceeb, 0.5); // 色と透明度

    const vertices = this.hexUtils.getHexVertices(pos.x, pos.y);
    this.cellHighlight.beginPath();
    this.cellHighlight.moveTo(vertices[0], vertices[1]);
    for (let i = 2; i < vertices.length; i += 2) {
      this.cellHighlight.lineTo(vertices[i], vertices[i + 1]);
    }
    this.cellHighlight.closePath();
    this.cellHighlight.fillPath();

    // ハイライトを表示
    this.cellHighlight.setVisible(true);
  }

  /**
   * キャラクターを六角形グリッドに配置する
   */
  private createCharacters() {
    // 自分のキャラクターを配置
    this.friendUnits.forEach((unit, index) => {
      const status = CHARACTER_STATUS[unit.unitTypeId as keyof typeof CHARACTER_STATUS];
      const playerCharacterState = new PlayerCharacterState(
        status.activeCount,
        this,
        unit,
        this.hexUtils,
        this.gridConfig
      );
      this.characterManager.playerCharacters.push(playerCharacterState);
    });

    // 相手のキャラクターを配置（逆転した座標を使用）
    this.enemyUnits.forEach((unit, index) => {
      const enemyCharacterState = new EnemyCharacterState(
        this,
        unit,
        this.hexUtils,
        this.gridConfig
      );
      this.characterManager.enemyCharacters.push(enemyCharacterState);
    });
  }

  /**
   * トリガー設定モードを開始する
   */
  private startTriggerSetting() {
    if (!this.characterManager.selectedCharacter) return;

    this.triggerSettingMode = true;
    this.triggerSettingType = "main";

    // キャラクターを紫色で強調表示（トリガー設定モード）
    this.characterManager.selectedCharacter.image.setTint(0xff00ff);

    // タイル上には座標を表示
    this.fieldViewState.changeTileText("position");

    // mainトリガーの設定を開始
    this.showTriggerFan();
  }

  /**
   * トリガー扇形を表示する
   */
  private showTriggerFan() {
    if (!this.characterManager.selectedCharacter || !this.triggerSettingType)
      return;

    const characterState = this.characterManager.findCharacterByImage(
      this.characterManager.selectedCharacter.image
    );
    if (!characterState) return;

    // キャラクターのステータスを取得
    const characterKey = characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS;
    const characterStatus = CHARACTER_STATUS[characterKey];
    if (!characterStatus) return;

    // 設定中のトリガータイプに応じて装備を取得
    const triggerName =
      this.triggerSettingType === "main"
        ? characterStatus.main
        : characterStatus.sub;
    const triggerStatus =
      TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
    if (!triggerStatus) return;

    // キャラクター固有の角度と射程を使用
    const angle = triggerStatus.angle;
    const range = triggerStatus.range;

    console.log(
      `${triggerName}（${this.triggerSettingType}）トリガーの向きを設定してください（角度範囲: ${angle}度, 射程: ${range}）`
    );
    console.log(
      "扇形をドラッグして角度を調整し、マウスを離すかクリックで確定してください"
    );

    // 初期角度を設定（現在の向きまたはデフォルト）
    this.currentTriggerAngle = characterState.direction
      ? characterState.direction[this.triggerSettingType]
      : 0;

    // subトリガーの場合は色を変える
    const color = this.triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;

    const pixelPos = this.hexUtils.getHexPosition(
      this.characterManager.selectedCharacter.position.col,
      this.characterManager.selectedCharacter.position.row
    );

    // 扇形を描画（移動後の位置を中心に）
    this.triggerFan = new TriggerFanShape(this, pixelPos.x,
      pixelPos.y, color, this.currentTriggerAngle, angle, range, triggerName, this.gridConfig, this.hexUtils, true);
    this.triggerPoints = this.triggerFan.drawTriggerRangePoints(
      this.characterManager.selectedCharacter.position.col,
      this.characterManager.selectedCharacter.position.row, color);
  }

  /**
   * マウスのドラッグでトリガー扇形の表示を更新する
   */
  private updateTriggerFan() {
    if (
      !this.triggerFan ||
      !this.characterManager.selectedCharacter ||
      !this.triggerSettingType
    )
      return;

    const characterState = this.characterManager.findCharacterByImage(
      this.characterManager.selectedCharacter.image
    );
    if (!characterState) return;

    // キャラクターのステータスを取得
    const characterKey = characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS;
    const characterStatus = CHARACTER_STATUS[characterKey];
    if (!characterStatus) return;

    // 設定中のトリガータイプに応じて装備を取得
    const triggerName =
      this.triggerSettingType === "main"
        ? characterStatus.main
        : characterStatus.sub;
    const triggerStatus =
      TRIGGER_STATUS[triggerName as keyof typeof TRIGGER_STATUS];
    if (!triggerStatus) return;

    // 既存の扇形を削除
    this.triggerFan.getData("label").destroy();
    this.triggerFan.destroy();
    this.triggerPoints?.map((point) => point.destroy());

    // 新しい扇形を描画（移動後の位置を中心に）
    const angle = triggerStatus.angle;
    const range = triggerStatus.range;

    // subトリガーの場合は色を変える
    const color = this.triggerSettingType === "main" ? 0xff6b6b : 0x6b6bff;

    const pixelPos = this.hexUtils.getHexPosition(
      this.characterManager.selectedCharacter.position.col,
      this.characterManager.selectedCharacter.position.row
    );

    this.triggerFan = new TriggerFanShape(this, pixelPos.x,
      pixelPos.y, color, this.currentTriggerAngle, angle, range, triggerName, this.gridConfig, this.hexUtils, true);

    // トリガー範囲ポイントも更新
    this.triggerPoints = this.triggerFan.drawTriggerRangePoints(
      this.characterManager.selectedCharacter.position.col,
      this.characterManager.selectedCharacter.position.row,
      color
    );
  }

  /**
   * トリガー設定を完了する
   * @param direction 設定された方向
   */
  private completeTriggerSetting(direction: number) {
    if (!this.characterManager.selectedCharacter || !this.triggerSettingType)
      return;

    const characterState = this.characterManager.findCharacterByImage(
      this.characterManager.selectedCharacter.image
    );
    if (!characterState) return;

    // 現在のキャラクターの向きを取得または初期化
    let directions = characterState.direction;
    if (!directions) {
      directions = { main: 0, sub: 0 };
      characterState.direction = directions;
    }

    // 方向を設定
    directions[this.triggerSettingType] = direction;

    console.log(
      `${this.triggerSettingType}トリガーの向きを ${direction.toFixed(
        1
      )}度 に設定しました`
    );

    // 次のトリガー設定または完了
    if (this.triggerSettingType === "main") {
      this.triggerSettingType = "sub";
      this.clearTriggerDisplay();
      this.showTriggerFan();
    } else {
      this.finishTriggerSetting();
    }
  }

  /**
   * トリガー設定を終了する
   */
  private finishTriggerSetting() {
    // 行動履歴を記録
    this.recordActionHistory();

    this.triggerSettingMode = false;
    this.triggerSettingType = null;
    this.clearTriggerDisplay();

    console.log("トリガー設定が完了しました");

    if (!this.characterManager.selectedCharacter) return;
    // 行動力が残っているかチェック
    const remainingActionPoints =
      this.characterManager.findPlayerCharacterByImage(
        this.characterManager.selectedCharacter?.image
      )?.getActionPoints() ?? 0;

    if (remainingActionPoints > 0) {
      // 行動力が残っている場合：キャラクター選択を維持し、移動可能マスを再表示
      console.log(
        `行動力が${remainingActionPoints}残っています。次の行動を設定してください。`
      );
      this.showMovableHexes();

      // React側にキャラクター選択を維持することを通知
      // notifyCharacterSelection(
      //   this.characterManager.selectedCharacter?.id,
      //   remainingActionPoints
      // );
    } else {
      // 行動力が0の場合：選択をクリア
      console.log("行動力が0になりました。キャラクター選択をクリアします。");
      // 行動力が0になった場合、「行動設定済み」テキストを表示
      this.showActionCompletedText(
        this.characterManager.selectedCharacter.image
      );
      this.clearSelection();
    }

    // 行動履歴記録後に全キャラクターの行動力をチェック
    this.checkAllCharactersActionPointsCompleted();
  }

  /**
   * 行動力を消費する
   * @param remainingMoves 残りの移動回数
   */
  private consumeActionPoint(remainingMoves: number) {
    if (!this.characterManager.selectedCharacter) return;
    const currentActionPoints =
      this.characterManager.findPlayerCharacterByImage(
        this.characterManager.selectedCharacter?.image
      )?.getActionPoints() ?? 0;

    if (currentActionPoints && currentActionPoints > 0) {
      this.characterManager.findPlayerCharacterByImage(
        this.characterManager.selectedCharacter?.image
      )!.setActionPoints(remainingMoves);

      console.log(
        `キャラクター${this.characterManager.selectedCharacter?.id}の行動力を消費しました。残り: ${remainingMoves}`
      );

      // 行動力表示の更新
      this.characterManager.selectedCharacter.updateActionPointsDisplay(this);
    }
  }

  /**
   * 全キャラクターの行動力が0になったかチェック
   */
  private checkAllCharactersActionPointsCompleted() {
    let allCompleted = true;
    let totalRemainingPoints = 0;

    // プレイヤーキャラクターの行動力をチェック
    for (const character of this.characterManager.playerCharacters) {
      const actionPoints =
        this.characterManager.findPlayerCharacterByImage(character.image)
          ?.getActionPoints() || 0;
      totalRemainingPoints += actionPoints;
      if (actionPoints > 0) {
        allCompleted = false;
      }
    }

    console.log(`残り行動力合計: ${totalRemainingPoints}`);

    if (allCompleted && this.characterManager.playerCharacters.length > 0) {
      console.log(
        "全キャラクターの行動が完了しました！行動履歴を送信します..."
      );
      this.sendServerTurn(this.turn.getSteps());
    }
  }

  /**
   * 行動完了テキストを表示する
   */
  private showActionCompletedText(character: Phaser.GameObjects.Image) {
    const characterState =
      this.characterManager.findPlayerCharacterByImage(character);
    if (!characterState) return;

    const pixelPos = this.hexUtils.getHexPosition(
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
      this,
      pixelPos.x,
      pixelPos.y - 40,
      "行動設定済み"
    );

    characterState.setCompleteText(text);
  }

  /**
   * トリガー表示をクリアする
   */
  private clearTriggerDisplay() {
    if (this.triggerFan) {
      this.triggerFan.getData("label").destroy();
      this.triggerFan.destroy();
      this.triggerFan = null;
      this.triggerPoints?.map((point) => point.destroy());
      this.triggerPoints = null;
    }
  }

  /**
   * 行動履歴を記録する
   */
  private recordActionHistory() {
    /** 行動履歴を記録する */
    const pushActionHistory = (col: number, row: number) => {
      if (!this.characterManager.selectedCharacter) return;

      const characterState = this.characterManager.findPlayerCharacterByImage(
        this.characterManager.selectedCharacter.image
      );
      if (!characterState) return;

      const directions = characterState.direction;
      const mainTrigger =
        CHARACTER_STATUS[characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS]
          ?.main ?? null;
      const subTrigger =
        CHARACTER_STATUS[characterState.getUnitTypeId() as keyof typeof CHARACTER_STATUS]
          ?.sub ?? null;

      if (!directions || !mainTrigger || !subTrigger) {
        console.warn(
          "行動履歴の記録に失敗",
          directions,
          mainTrigger,
          subTrigger
        );
        return;
      }

      // 行動履歴に記録
      const action: Action = new Action(
        ActionType.Move,
        this.characterManager.selectedCharacter.getUnitId(),
        this.characterManager.selectedCharacter.getUnitTypeId(),
        {
          col: col,
          row: row,
        },
        mainTrigger,
        subTrigger,
        directions.main,
        directions.sub,
      );
      // ターンの履歴に追加
      this.turn.addActionWithIndex(this.characterManager.selectedCharacter.getCurrentStep(), action);
      // キャラクターのステップを進める
      this.characterManager.selectedCharacter.advanceStep();

      // キャラクターIDを取得してログに出力
      console.log(
        `行動履歴を記録: キャラクター${characterState.getUnitTypeId()
        }, 位置(${col}, ${row}), mainトリガー: ${directions.main.toFixed(
          1
        )}度, subトリガー: ${directions.sub.toFixed(1)}度`
      );
    };

    if (!this.characterManager.selectedCharacter) return;

    const beforePosition = this.characterManager.beforePositionState.get(
      this.characterManager.selectedCharacter.image
    );

    if (
      beforePosition &&
      beforePosition !== this.characterManager.selectedCharacter.position
    ) {
      // 移動前の位置がある場合、その位置を記録
      const { col, row } = beforePosition;

      const movePath = this.hexUtils.findPath(
        { col: col, row: row },
        this.characterManager.selectedCharacter.position
      );

      for (const step of movePath) {
        // 移動可能マスをクリック：キャラクターを移動
        pushActionHistory(step.col, step.row);
      }
    } else {
      // 移動していない場合、現在の位置を記録
      const { col, row } = this.characterManager.selectedCharacter.position;
      pushActionHistory(col, row);
    }
  }

  /**
   * 指定されたステップの行動を実行
   */
  executeTurn(turn: Turn) {
    const onStepComplete = () => { };

    let currentStepIndex = 0;
    const steps = turn.getSteps();

    /** ステップの順番実行 */
    const executeNextStep = (index: number) => {
      console.log(`=== ステップ ${index + 1} 実行開始 ===`);
      const step = steps[index];

      // ステップ内アクションの開始
      for (const [actionIndex, action] of step.getActions().entries()) {
        // actionの内容に応じてキャラクターの移動やトリガー表示を更新する
        const character = this.characterManager.findCharacterByUnitId(action.getUnitId());
        if (character) {
          console.log(`--- アクション ${actionIndex + 1} 開始 ---`);
          character.executeCharacterSingleStep(action, () => { });
        }
        // 矢印の削除
        this.triggerArrows.forEach((arrow) => arrow.destroy());
        this.triggerArrows = [];
        // 視界情報の更新
        // this.fieldViewState.setSightAreaFieldView(turn.fieldView);
      }
      currentStepIndex++;
      if (currentStepIndex < steps.length) {
        // 次のステップを1.5秒後に実行（アニメーション完了を待つ）
        this.time.delayedCall(1500, () => executeNextStep(currentStepIndex));
      } else {
        // 全ステップ完了後の処理
        onStepComplete();
        console.log("=== 全ステップ実行完了 ===");
      }
    };
    // 行動フェーズ開始
    executeNextStep(currentStepIndex);
  }

  /**
   * 行動フェーズを完了して設定モードに戻る
   */
  private completeActionPhase(turnNumber: number) {
    console.log("行動フェーズ完了 - 設定モードに戻ります");
    this.isActionMode = false;
    this.actionAnimationInProgress = false;

    // 全キャラクターのトリガー表示をクリア
    // this.clearAllTriggerDisplays();

    // 全キャラクターの行動力をリセット
    this.resetAllActionPoints();

    // 行動履歴をクリア
    this.turn.clearSteps();

    // キャラクターの行動力を表示
    this.characterManager.setAllActionPointsText(this);
  }

  /**
   * 全キャラクターの行動力をリセット
   */
  private resetAllActionPoints() {
    this.characterManager.playerCharacters.forEach((character) => {
      const characterId = character.id;
      if (characterId) {
        const characterKey = characterId as keyof typeof CHARACTER_STATUS;
        const characterStatus = CHARACTER_STATUS[characterKey];
        if (characterStatus) {
          // 行動完了テキストを削除
          character.getCompleteText()?.destroy();
          character.setCompleteText(null);
          // 行動力を最大値にリセット
          this.characterManager.findPlayerCharacterByImage(
            character.image
          )!.setActionPoints(characterStatus.activeCount);
        }
      }
    });
  }

  // ...existing code...
};
