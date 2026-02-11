use serde::{Deserialize, Serialize};

use crate::domain::triggergame_simulator::configs::game_config::GameConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    col: i32,
    row: i32,
}

impl Position {
    pub fn new(col: i32, row: i32) -> Self {
        Self::validate(col, row);
        Self { col, row }
    }

    /// 敵ユニットのピクセル情報の取得
    pub fn get_enemy_pixel_position(&self) -> (i32, i32) {
        let game_config = GameConfig::get_game_config();
        self.to_pixel_position(
            game_config.gameboard_width() - 1 - self.col,
            game_config.gameboard_height() - 1 - self.row,
        )
    }

    /// ピクセル座標を取得
    pub fn get_pixel_position(&self) -> (i32, i32) {
        self.to_pixel_position(self.col, self.row)
    }

    /// 列と行からピクセル座標に変換するヘルパー関数
    fn to_pixel_position(&self, col: i32, row: i32) -> (i32, i32) {
        let game_config = GameConfig::get_game_config();
        let hex_radius = game_config.hex_radius();
        let hex_width = game_config.hex_width();
        let hex_height = game_config.hex_height();

        let x = col * hex_width * 3 / 4 + hex_radius;
        let y = row * hex_height
            + if col % 2 == 1 {
                hex_radius + hex_height / 2
            } else {
                0
            }
            + hex_radius;
        (x, y)
    }

    pub fn col(&self) -> i32 {
        self.col
    }

    pub fn row(&self) -> i32 {
        self.row
    }

    // バリデーションの実装
    fn validate(col: i32, row: i32) {
        if col < 0 {
            panic!("Position colは0以上である必要があります");
        }
        if row < 0 {
            panic!("Position rowは0以上である必要があります");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for Position {
    fn eq(&self, other: &Self) -> bool {
        self.col == other.col && self.row == other.row
    }
}

impl Eq for Position {}
