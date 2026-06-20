import { describe, expect, it, vi } from "vitest";
import { FieldViewService } from "../FieldViewService";
import { HexUtils } from "@/game-logics/hexUtils";
import { GRID_CONFIG } from "@/game-logics/config/game-config";

/**
 * FieldViewService の視界計算ロジックをテストする。
 * 
 * バックエンド側：game_server/rust_app/src/domain/triggergame_simulator/models/game/visibility_test.rs
 * バックエンド側のテスト内容と同期させるのが望ましい
 */
describe("FieldViewService visibility checks", () => {
  /** グリッドの設定値 */
  const gridConfig = GRID_CONFIG;
  const makeService = () => {
    const deps = {
      characterManager: { playerCharacters: [] } as any,
      fieldViewState: { setSightAreaFieldView: vi.fn() } as any,
      hexUtils: new HexUtils(gridConfig),
      gridConfig,
    };
    return new FieldViewService(deps as any);
  };

  it("checkUnitsVisibility: 同一座標は true", () => {
    const service = makeService();
    const result = (service as any).checkUnitsVisibility(
      { col: 0, row: 0 },
      { col: 0, row: 0 }
    );
    expect(result).toBe(true);
  });

  it("checkUnitsVisibility: (31, 14)から(30, 24)は距離が遠いので不可視", () => {
    const service = makeService();
    const result = (service as any).checkUnitsVisibility(
      { col: 31, row: 14 },
      { col: 30, row: 24 }
    );
    expect(result).toBe(false);
  });

  it("checkUnitsVisibility: (20, 24)から(9, 15)は距離が遠いので不可視", () => {
    const service = makeService();
    const result = (service as any).checkUnitsVisibility(
      { col: 20, row: 24 },
      { col: 9, row: 15 }
    );
    expect(result).toBe(false);
  });

  it("hasLineOfSight: 障害物があるラインは false", () => {
    const service = makeService();
    const result = (service as any).hasLineOfSight(
      { col: 0, row: 1 },
      { col: 4, row: 1 }
    );
    expect(result).toBe(false);
  });

  it("hasLineOfSight: 障害物があるラインは false", () => {
    const service = makeService();
    const result = (service as any).hasLineOfSight(
      { col: 15, row: 22 },
      { col: 11, row: 21 }
    );
    expect(result).toBe(false);
  });

  it("hasLineOfSight: 遮蔽のないラインは true", () => {
    const service = makeService();
    const result = (service as any).hasLineOfSight(
      { col: 5, row: 13 },
      { col: 5, row: 15 }
    );
    expect(result).toBe(true);
  });

  it("getLinePath: 真っ直ぐなラインのパスを取得", () => {
    const service = makeService();
    const result = (service as any).getLinePath(
      { col: 5, row: 13 },
      { col: 5, row: 15 }
    );
    expect(result).toEqual([
      { col: 5, row: 13 },
      { col: 5, row: 14 },
      { col: 5, row: 15 },
    ]);
  });
});