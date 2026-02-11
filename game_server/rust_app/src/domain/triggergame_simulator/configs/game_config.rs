use std::collections::HashMap;

/// ゲーム内の設定値情報
pub struct GameConfig {
    /// グリッドセルの半径
    hex_radius: i32,
    /// グリッドセルの幅
    hex_width: i32,
    /// グリッドセルの高さ
    hex_height: i32,
    /// ゲームの横のセル数
    gameboard_width: i32,
    /// ゲームの縦のセル数
    gameboard_height: i32,
    /// 回避能力の重み付け
    avoid_weight: i32,
    /// ダメージの重み付け
    damage_weight: f64,
    /// 防御能力の重み付け
    defend_weight: f64,
    /// 最小ダメージ量
    min_damage: i32,
}

impl GameConfig {
    ///
    pub fn get_game_config() -> GameConfig {
        GameConfig {
            hex_radius: 24,
            hex_width: 24 * 2,
            hex_height: 24 * (3 as f64).sqrt() as i32,
            gameboard_width: 36,
            gameboard_height: 36,
            avoid_weight: 2,
            damage_weight: 1.0,
            defend_weight: 1.0,
            min_damage: 20,
        }
    }

    /// グリッドセルの半径を取得
    pub fn hex_radius(&self) -> i32 {
        self.hex_radius
    }

    /// グリッドセルの幅を取得
    pub fn hex_width(&self) -> i32 {
        self.hex_width
    }

    /// グリッドセルの高さを取得
    pub fn hex_height(&self) -> i32 {
        self.hex_height
    }

    /// ゲームボードの横のセル数を取得
    pub fn gameboard_width(&self) -> i32 {
        self.gameboard_width
    }

    /// ゲームボードの縦のセル数を取得
    pub fn gameboard_height(&self) -> i32 {
        self.gameboard_height
    }

    /// 回避能力の重み付けを取得
    pub fn avoid_weight(&self) -> i32 {
        self.avoid_weight
    }

    /// ダメージの重み付けを取得
    pub fn damage_weight(&self) -> f64 {
        self.damage_weight
    }

    /// 防御能力の重み付けを取得
    pub fn defend_weight(&self) -> f64 {
        self.defend_weight
    }

    /// 最小ダメージ量を取得
    pub fn min_damage(&self) -> i32 {
        self.min_damage
    }
}
