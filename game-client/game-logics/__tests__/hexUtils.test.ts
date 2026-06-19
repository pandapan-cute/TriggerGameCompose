import { describe, expect, it } from "vitest";
import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";
import { GRID_CONFIG } from "../config/game-config";

/**
 * HexUtils の経路探索ロジックをテストする。
 */
describe("HexUtils pathfinding", () => {
  /** グリッドの設定値 */
  const gridConfig = GRID_CONFIG;

  it("findPath: (4,33)から(6,22)は高低差込みの低コスト経路を返す", () => {
    const hexUtils = new HexUtils(gridConfig);

    const result = hexUtils.findPath(
      { col: 4, row: 33 },
      { col: 6, row: 22 }
    );

    expect(result).toEqual([
      { col: 4, row: 32 },
      { col: 4, row: 31 },
      { col: 5, row: 30 },
      { col: 6, row: 30 },
      { col: 6, row: 29 },
      { col: 6, row: 28 },
      { col: 6, row: 27 },
      { col: 6, row: 26 },
      { col: 6, row: 25 },
      { col: 6, row: 24 },
      { col: 6, row: 23 },
      { col: 6, row: 22 },
    ]);
  });
});


/**
 * HexUtils の2点間の距離チェックロジックをテストする。
 */
describe("HexUtils distance", () => {
  /** グリッドの設定値 */
  const gridConfig = GRID_CONFIG;

  it("calculateHexDistance: (20,27)から(27,8)の距離がバックエンド側と等しい", () => {
    const hexUtils = new HexUtils(gridConfig);
    const distance = hexUtils.calculateHexDistance(20, 27, 27, 8);
    console.log("Hex distance:", distance);
    expect(distance).toBeCloseTo(809.2663, 2);
  });
});
