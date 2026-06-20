import { GridConfig } from "../types";

export const MAX_TURN = 6;

/** ユニットの最大行動可能秒数 */
export const MAX_UNIT_EXEC_SECONDS = 15;

/** グリッドの設定値 */
export const GRID_CONFIG: GridConfig = {
  gridSize: 32,
  gridWidth: 36,
  gridHeight: 36,
  hexRadius: 24,
  hexWidth: 24 * 2,
  hexHeight: 24 * Math.sqrt(3),
  marginLeft: 0,
  marginTop: 0,
};