import { HexUtils } from "@/game-logics/hexUtils";
import { GridConfig } from "@/game-logics/types";

export interface ThreeDWorldPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D盤面上のキャラクター/オブジェクト配置の座標変換を扱うサービス
 */
export class ThreeDCharacterPlacementService {
  private readonly gridOriginOffset: { x: number; y: number; };

  constructor(private readonly gridConfig: GridConfig) {
    this.gridOriginOffset = this.calculateGridOriginOffset();
  }

  /** グリッド全体の中心を原点に寄せるためのオフセット */
  getOriginOffset(): { x: number; y: number; } {
    return this.gridOriginOffset;
  }

  /**
   * 2D座標を3Dローカル座標へ変換する
   * 六角セルのジオメトリ生成など、XYベースの面を扱う用途で使う。
   */
  toSurfacePosition(position: { x: number; y: number; }, z: number = 0): ThreeDWorldPosition {
    return {
      // 2D描画で使っていたワールド座標の左上基準を、3D空間の原点基準へずらす。
      // これにより盤面全体の中心が (0, 0, 0) 付近に来る。
      x: position.x - this.gridOriginOffset.x,
      // 六角セルのShape生成は引き続き「2DのXY平面」として扱うため、
      // 2Dのy座標はそのまま3Dオブジェクトのローカルyへ入れている。
      y: position.y - this.gridOriginOffset.y,
      // ここでの z は、セルの厚みや前後の微調整用の値。
      z,
    };
  }

  /**
   * 2D座標を3Dローカル座標へ変換する
   * キャラクターなど、x-z 平面の上に載せたいオブジェクト向け。
   */
  toGroundPosition(position: { x: number; y: number; }, height: number = 0): ThreeDWorldPosition {
    // 2Dグリッドの左右方向は、そのまま3D空間の x 軸へ対応させる。
    const localX = position.x - this.gridOriginOffset.x;
    // 2Dグリッドの上下方向は、3D空間では地面方向の奥行きとして扱いたい。
    // そのため 2D の y を 3D の z へ流している。
    const localZ = position.y - this.gridOriginOffset.y;

    return {
      x: localX,
      // キャラクターの足元の高さ。
      // 地面の上に少し浮かせたい場合はこの値を増やす。
      y: height,
      z: localZ,
    };
  }

  /** グリッド座標を六角セル用の3Dローカル座標へ変換する */
  fromGrid(hexUtils: HexUtils, col: number, row: number, z: number = 0): ThreeDWorldPosition {
    const invertPosion = hexUtils.invertPosition({ col, row });
    const position2d = hexUtils.getHexPosition(invertPosion.col, invertPosion.row);
    return this.toSurfacePosition(position2d, z);
  }

  /** グリッド座標を地面上の3Dローカル座標へ変換する */
  fromGridOnGround(hexUtils: HexUtils, col: number, row: number, height: number = 0): ThreeDWorldPosition {
    const position2d = hexUtils.getHexPosition(col, row);
    return this.toGroundPosition(position2d, height);
  }

  private calculateGridOriginOffset(): { x: number; y: number; } {
    // 2Dグリッドは「左上から右下へ広がる座標系」で作られているため、
    // そのまま3Dへ持ち込むと原点から大きく離れた位置に盤面が出る。
    // そこで盤面全体のおおよその幅・高さを出し、半分を引くことで
    // グリッド中心が 3D 原点付近に来るようにしている。
    const gridWidth = this.gridConfig.gridWidth * this.gridConfig.hexWidth * 0.75 + this.gridConfig.hexWidth;
    const gridHeight = this.gridConfig.gridHeight * this.gridConfig.hexHeight + this.gridConfig.hexHeight;

    return {
      x: gridWidth,
      y: gridHeight * 0.82,
    };
  }
}
