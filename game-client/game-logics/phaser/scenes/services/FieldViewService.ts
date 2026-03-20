import { FieldViewState } from "@/game-logics/entities/FieldViewState";
import { CharacterManager } from "@/game-logics/characterManager";
import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig, Position } from "@/game-logics/types";
import { FIELD_STEPS } from "@/game-logics/config/FieldData";

/**
 * FieldViewService が参照する依存関係。
 */
export interface FieldViewServiceDeps {
  characterManager: CharacterManager;
  fieldViewState: FieldViewState;
  hexUtils: HexUtils;
  gridConfig: GridConfig;
}

/**
 * ゲームの視界情報を更新するサービス
 */
export class FieldViewService {
  // ゲーム設定定数
  private static readonly BASE_RANGE = 8; // 基本視界範囲

  constructor(private readonly deps: FieldViewServiceDeps) { }

  /**
   * プレイヤーの全キャラクターから算出した視界範囲を計算し、FieldViewState に反映する
   * @return: 更新後の視界マップ (2次元配列) デバッグ目的で返す
   */
  updateVisibility(): boolean[][] {
    const width = this.deps.gridConfig.gridWidth;
    const height = this.deps.gridConfig.gridHeight;

    const units = this.deps.characterManager.playerCharacters.filter((char) => char.getIsBailedOut() === false);

    // 視界マップを初期化
    const visibilityMap: boolean[][] = Array(height)
      .fill(null)
      .map(() => Array(width).fill(false));

    // 各ユニットごとに視界計算
    for (const unit of units) {
      const pos = unit.position;

      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          // check_units_visibility を呼び出して、pos から見た (col, row) の位置が見えるか確認
          const targetPos: Position = { col, row };
          if (this.checkUnitsVisibility(pos, targetPos)) {
            visibilityMap[row][col] = true;
          }
        }
      }
    }

    this.deps.fieldViewState.setSightAreaFieldView(visibilityMap);
    return visibilityMap; // デバッグ目的で返す
  }

  /**
   * ポジションAからポジションBが見えるか計算し、見える場合はtrueを返す
   * @param positionA 視点のポジション
   * @param positionB 目標のポジション
   * @returns 見える場合はtrue、見えない場合はfalse
   */
  private checkUnitsVisibility(positionA: Position, positionB: Position): boolean {
    // 同じ位置は常に見える
    if (positionA.col === positionB.col && positionA.row === positionB.row) {
      return true;
    }

    // 距離計算
    const distance = this.deps.hexUtils.calculateHexDistance(
      positionA.col,
      positionA.row,
      positionB.col,
      positionB.row
    );

    // 視界者の高さを取得
    const viewerHeight = FIELD_STEPS[positionA.row][positionA.col];
    const maxViewRange = FieldViewService.BASE_RANGE + viewerHeight;

    // 六角形グリッドの高さ (GameConfig の hex_height と同じ値)
    const hexHeight = this.deps.gridConfig.hexHeight;

    // 視界範囲外チェック
    if (hexHeight * (maxViewRange + 0.5) < distance) {
      return false;
    }

    // 目標位置の方が高い場合は、障害物があるとみなして見えない
    if (
      FIELD_STEPS[positionB.row][positionB.col] >
      FIELD_STEPS[positionA.row][positionA.col]
    ) {
      return false;
    }

    // 直線上に障害物がある場合は見えない
    if (!this.hasLineOfSight(positionA, positionB)) {
      return false;
    }

    return true;
  }

  /**
   * 直線上に障害物があるか判定する
   * @param viewerPos 視点のポジション
   * @param targetPos 目標のポジション
   * @returns 直線上に障害物がある場合はfalse
   */
  private hasLineOfSight(viewerPos: Position, targetPos: Position): boolean {
    const path = this.getLinePath(viewerPos, targetPos);
    const viewerHeight = FIELD_STEPS[viewerPos.row][viewerPos.col];
    const targetHeight = FIELD_STEPS[targetPos.row][targetPos.col];

    // パスが2以下の場合は直線で即座に返す
    if (path.length <= 2) {
      return true;
    }

    // パスの中央部分で高さチェック
    for (let i = 1; i < path.length - 1; i++) {
      const pathPos = path[i];
      const obstacleHeight = FIELD_STEPS[pathPos.row][pathPos.col];
      const progress = i / (path.length - 1);
      const lineHeight =
        viewerHeight + (targetHeight - viewerHeight) * progress;

      if (obstacleHeight > lineHeight) {
        return false;
      }
    }

    return true;
  }

  /**
   * 二点間の直線パスを計算する
   * @param start 開始ポジション
   * @param end 終了ポジション
   * @returns パス上のポジション配列
   */
  private getLinePath(start: Position, end: Position): Position[] {
    const path: Position[] = [];

    const cube1 = this.offsetToCube(start.col, start.row);
    const cube2 = this.offsetToCube(end.col, end.row);

    const distance = Math.max(
      Math.abs(cube2[0] - cube1[0]),
      Math.abs(cube2[1] - cube1[1]),
      Math.abs(cube2[2] - cube1[2])
    );

    for (let i = 0; i <= distance; i++) {
      const t = distance === 0 ? 0 : i / distance;

      const cube: [number, number, number] = [
        cube1[0] + (cube2[0] - cube1[0]) * t,
        cube1[1] + (cube2[1] - cube1[1]) * t,
        cube1[2] + (cube2[2] - cube1[2]) * t,
      ];

      const roundedCube = this.cubeRound(cube);
      const offset = this.cubeToOffset(roundedCube);
      // Rust と同じく、グリッド内の有効な位置のみを追加
      if (this.isValidPosition(offset)) {
        path.push(offset);
      }
    }

    return path;
  }

  /**
   * オフセット座標をキューブ座標に変換
   * @param col 列
   * @param row 行
   * @returns キューブ座標 [x, y, z]
   */
  private offsetToCube(col: number, row: number): [number, number, number] {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return [x, y, z];
  }

  /**
   * キューブ座標をオフセット座標に変換
   * @param cube キューブ座標 [x, y, z]
   * @returns オフセット座標
   */
  private cubeToOffset(cube: [number, number, number]): Position {
    const col = cube[0] + (cube[2] - (cube[2] & 1)) / 2;
    const row = cube[2];
    return { col: Math.round(col), row: Math.round(row) };
  }

  /**
   * キューブ座標を丸める
   * @param cube キューブ座標 [x, y, z] (浮動小数点)
   * @returns 丸められたキューブ座標 [x, y, z] (整数)
   */
  private cubeRound(cube: [number, number, number]): [number, number, number] {
    let rx = Math.round(cube[0]);
    let ry = Math.round(cube[1]);
    let rz = Math.round(cube[2]);

    const xDiff = Math.abs(rx - cube[0]);
    const yDiff = Math.abs(ry - cube[1]);
    const zDiff = Math.abs(rz - cube[2]);

    // 最も誤差が大きい座標を調整
    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }

    return [rx, ry, rz];
  }

  /**
   * ポジションがグリッド内の有効な範囲か判定
   * @param pos チェック対象のポジション
   * @returns グリッド内なら true
   */
  private isValidPosition(pos: Position): boolean {
    const width = this.deps.gridConfig.gridWidth;
    const height = this.deps.gridConfig.gridHeight;
    return (
      pos.col >= 0 &&
      pos.col < width &&
      pos.row >= 0 &&
      pos.row < height
    );
  }
}
