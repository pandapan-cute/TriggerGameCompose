use crate::domain::triggergame_simulator::configs::{
    field_steps_config::FieldStepsConfig, game_config::GameConfig,
};
use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::unit_management::models::unit::Unit;

/// Visibility集約
/// ゲーム全体の可視性情報を管理するエンティティ
#[derive(Debug, Clone)]
pub struct Visibility {
    field_steps: Vec<Vec<i32>>,
}

impl Visibility {
    pub fn new(field_steps: Vec<Vec<i32>>) -> Self {
        Self { field_steps }
    }

    pub fn create() -> Self {
        let config = FieldStepsConfig::get_field_steps_config();
        Self::new(config.field_steps())
    }

    pub fn field_steps(&self) -> &Vec<Vec<i32>> {
        &self.field_steps
    }

    /// ポジションAからポジションBが見えるか計算し、見える場合はtrueを返す
    pub fn check_units_visibility(&self, position_a: &Position, position_b: &Position) -> bool {
        if position_a.col() == position_b.col() && position_a.row() == position_b.row() {
            // 同じ位置は常に見える
            return true;
        }
        let distance = self.calculate_hex_distance(
            position_a.col(),
            position_a.row(),
            position_b.col(),
            position_b.row(),
        );
        let viewer_height = self.field_steps[position_a.row() as usize][position_a.col() as usize];
        const BASE_RANGE: i32 = 8;
        let max_view_range = BASE_RANGE + viewer_height;
        if (GameConfig::get_game_config().hex_height() as f64) * (max_view_range as f64 + 0.5)
            < distance
        {
            // 視界範囲外
            return false;
        }
        if self.field_steps[position_b.row() as usize][position_b.col() as usize]
            > self.field_steps[position_a.row() as usize][position_a.col() as usize]
        {
            // 目標位置の方が高い場合は、障害物があるとみなして見えない
            return false;
        }
        if !self.has_line_of_sight(position_a, position_b) {
            // 直線上に障害物がある場合は見えない
            return false;
        }
        true
    }

    /// キャラクターのポジションを配列で引数とし、プレイヤーの全キャラから算出した視界範囲を計算する
    /// true: 見える, false: 見えない
    pub fn calculate_visibility(&self, units: &Vec<Unit>) -> Vec<Vec<bool>> {
        let game_config = GameConfig::get_game_config();
        let height = game_config.gameboard_height() as usize;
        let width = game_config.gameboard_width() as usize;

        let mut visibility_map = vec![vec![false; width]; height];

        for unit in units {
            let pos = unit.position();
            let viewer_col = pos.col() as usize;
            let viewer_row = pos.row() as usize;
            let viewer_height = self.field_steps[viewer_row][viewer_col];

            let base_range = 8;
            let max_view_range = base_range + viewer_height;

            for row in 0..height {
                for col in 0..width {
                    // check_units_visibilityを呼び出して、posから見た(row, col)の位置が見えるか確認
                    let target_pos = Position::new(col as i32, row as i32);
                    if self.check_units_visibility(pos, &target_pos) {
                        visibility_map[row][col] = true;
                    }
                }
            }
        }

        visibility_map
    }

    /// 移動に必要な行動ポイントを取得
    pub fn get_action_points_for_move(&self, from: &Position, to: &Position) -> i32 {
        const ACTION_POINT_COST_PER_MOVE: i32 = 1; // 基礎移動はアクションポイントを1消費する
        let action_poinst = self.field_steps[to.row() as usize][to.col() as usize]
            - self.field_steps[from.row() as usize][from.col() as usize];
        if action_poinst > 0 {
            action_poinst + ACTION_POINT_COST_PER_MOVE
        } else {
            ACTION_POINT_COST_PER_MOVE
        }
    }

    fn has_line_of_sight(&self, viewer_pos: &Position, target_pos: &Position) -> bool {
        let path = self.get_line_path(viewer_pos, target_pos);
        let viewer_height = self.field_steps[viewer_pos.row() as usize][viewer_pos.col() as usize];
        let target_height = self.field_steps[target_pos.row() as usize][target_pos.col() as usize];

        if path.len() <= 2 {
            return true;
        }

        for (i, path_pos) in path.iter().enumerate().skip(1).take(path.len() - 2) {
            let obstacle_height =
                self.field_steps[path_pos.row() as usize][path_pos.col() as usize];
            let progress = (i as f64) / ((path.len() - 1) as f64);
            let line_height =
                (viewer_height as f64) + ((target_height - viewer_height) as f64) * progress;

            if (obstacle_height as f64) > line_height {
                return false;
            }
        }

        true
    }

    fn get_line_path(&self, start: &Position, end: &Position) -> Vec<Position> {
        let mut path: Vec<Position> = Vec::new();

        let cube1 = self.offset_to_cube(start.col(), start.row());
        let cube2 = self.offset_to_cube(end.col(), end.row());

        let distance = (cube2.0 - cube1.0)
            .abs()
            .max((cube2.1 - cube1.1).abs())
            .max((cube2.2 - cube1.2).abs());

        for i in 0..=distance {
            let t = if distance == 0 {
                0.0
            } else {
                (i as f64) / (distance as f64)
            };

            let cube = (
                (cube1.0 as f64) + ((cube2.0 - cube1.0) as f64) * t,
                (cube1.1 as f64) + ((cube2.1 - cube1.1) as f64) * t,
                (cube1.2 as f64) + ((cube2.2 - cube1.2) as f64) * t,
            );

            let rounded_cube = self.cube_round(cube);
            let offset = self.cube_to_offset(rounded_cube);

            if self.is_valid_position(&offset) {
                path.push(offset);
            }
        }

        path
    }

    fn offset_to_cube(&self, col: i32, row: i32) -> (i32, i32, i32) {
        let x = col - (row - (row & 1)) / 2;
        let z = row;
        let y = -x - z;
        (x, y, z)
    }

    fn cube_round(&self, cube: (f64, f64, f64)) -> (i32, i32, i32) {
        let mut rx = cube.0.round() as i32;
        let mut ry = cube.1.round() as i32;
        let mut rz = cube.2.round() as i32;

        let x_diff = ((rx as f64) - cube.0).abs();
        let y_diff = ((ry as f64) - cube.1).abs();
        let z_diff = ((rz as f64) - cube.2).abs();

        if x_diff > y_diff && x_diff > z_diff {
            rx = -ry - rz;
        } else if y_diff > z_diff {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        (rx, ry, rz)
    }

    fn cube_to_offset(&self, cube: (i32, i32, i32)) -> Position {
        let col = cube.0 + (cube.2 - (cube.2 & 1)) / 2;
        let row = cube.2;
        Position::new(col, row)
    }

    fn is_valid_position(&self, pos: &Position) -> bool {
        let game_config = GameConfig::get_game_config();
        pos.col() >= 0
            && pos.col() < game_config.gameboard_width()
            && pos.row() >= 0
            && pos.row() < game_config.gameboard_height()
    }

    /// 六角形グリッドにおける2点間の距離を計算
    /// 返り値: ピクセル距離
    pub fn calculate_hex_distance(&self, col1: i32, row1: i32, col2: i32, row2: i32) -> f64 {
        let a_pos = Position::new(col1, row1);
        let b_pos = Position::new(col2, row2);
        let a_pixel = a_pos.get_pixel_position();
        let b_pixel = b_pos.get_pixel_position();
        let dx = b_pixel.0 - a_pixel.0;
        let dy = b_pixel.1 - a_pixel.1;
        ((dx * dx + dy * dy) as f64).sqrt()
    }

    /// デバッグ用：視界マップを文字列で表示
    pub fn debug_visibility_map(
        &self,
        visibility_map: &[Vec<bool>],
        character_position: &Position,
    ) -> String {
        let game_config = GameConfig::get_game_config();
        let width = game_config.gameboard_width() as usize;
        let height = game_config.gameboard_height() as usize;

        let mut result = format!(
            "視界マップ (キャラクター位置: {}, {})\n",
            character_position.col(),
            character_position.row()
        );
        result.push_str("   ");

        for col in 0..width {
            result.push_str(&(col % 10).to_string());
        }
        result.push('\n');

        for row in 0..height {
            result.push_str(&format!("{:02} ", row));

            for col in 0..width {
                if (col as i32) == character_position.col()
                    && (row as i32) == character_position.row()
                {
                    result.push('@');
                } else if self.field_steps[row][col] >= 1 {
                    result.push(if visibility_map[row][col] {
                        '■'
                    } else {
                        '□'
                    });
                } else {
                    result.push(if visibility_map[row][col] {
                        '●'
                    } else {
                        '･'
                    });
                }
            }
            result.push('\n');
        }

        result
    }
}
