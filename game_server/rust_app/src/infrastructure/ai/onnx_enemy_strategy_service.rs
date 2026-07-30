use crate::domain::triggergame_simulator::configs::game_config::GameConfig;
use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
    ActionType, ActionTypeValue,
};
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use crate::domain::triggergame_simulator::models::action::Action;
use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::{
    triggergame_simulator::{
        models::turn::Turn, services::enemy_strategy_service::EnemyStrategyService,
    },
    unit_management::models::unit::Unit,
};
use chrono::Utc;
use tract_onnx::prelude::*;
use uuid::Uuid;

const GRID_SIZE: i32 = 36;
const OBSERVATION_SIZE: usize = 17;
const MOVE_HEAD_SIZE: usize = 7;

/// ONNXを使用した敵戦略サービスの実装
/// このサービスはドメインの外部に位置します
/// AIモデルの推論処理を担当します
pub struct OnnxEnemyStrategyService {}

fn build_observation(focus_idx: usize, friends: &[Unit], foes: &[Unit]) -> Vec<f32> {
    let friend_positions: Vec<(i32, i32)> = friends
        .iter()
        .map(|u| (u.position().col(), u.position().row()))
        .collect();
    let foe_positions: Vec<(i32, i32)> = foes
        .iter()
        .map(|u| (u.position().col(), u.position().row()))
        .collect();

    build_observation_from_positions(focus_idx, &friend_positions, &foe_positions)
}

fn build_observation_from_positions(
    focus_idx: usize,
    friends_positions: &[(i32, i32)],
    foes_positions: &[(i32, i32)],
) -> Vec<f32> {
    let mut obs: Vec<f32> = Vec::with_capacity(OBSERVATION_SIZE);

    for i in 0..4 {
        if i < friends_positions.len() {
            let (col, row) = friends_positions[i];
            obs.push(col as f32 / 35.0);
            obs.push(row as f32 / 35.0);
        } else {
            obs.push(0.0);
            obs.push(0.0);
        }
    }

    for i in 0..4 {
        if i < foes_positions.len() {
            let (col, row) = foes_positions[i];
            obs.push(col as f32 / 35.0);
            obs.push(row as f32 / 35.0);
        } else {
            obs.push(0.0);
            obs.push(0.0);
        }
    }

    let denom = 3.0f32.max(1.0);
    obs.push(focus_idx as f32 / denom);
    obs
}

fn map_logits_to_actions(logits: &[f32]) -> Result<(usize, i32, i32), String> {
    if logits.len() < MOVE_HEAD_SIZE {
        return Err(format!("Unexpected model output size: {}", logits.len()));
    }

    let move_head = &logits[0..MOVE_HEAD_SIZE];
    let mut move_idx = 0usize;
    let mut best = f32::NEG_INFINITY;
    for (i, v) in move_head.iter().enumerate() {
        if *v > best {
            best = *v;
            move_idx = i;
        }
    }

    let remaining = logits.len() - MOVE_HEAD_SIZE;
    let (main_angle, sub_angle) = if remaining >= 2 {
        let head = remaining / 2;
        let main_head = &logits[MOVE_HEAD_SIZE..MOVE_HEAD_SIZE + head];
        let sub_head =
            &logits[MOVE_HEAD_SIZE + head..MOVE_HEAD_SIZE + head + head.min(remaining - head)];

        let argmax = |slice: &[f32]| -> usize {
            let mut bi = 0usize;
            let mut bv = f32::NEG_INFINITY;
            for (i, v) in slice.iter().enumerate() {
                if *v > bv {
                    bv = *v;
                    bi = i;
                }
            }
            bi
        };

        let ma = argmax(main_head);
        let sa = if sub_head.is_empty() {
            0usize
        } else {
            argmax(sub_head)
        };

        let map_angle = |i: usize, head_size: usize| -> i32 {
            if head_size <= 1 {
                return 0;
            }
            let frac = i as f32 / ((head_size - 1) as f32);
            (frac * 359.0).round() as i32
        };

        (
            map_angle(ma, main_head.len()),
            map_angle(sa, sub_head.len()),
        )
    } else {
        (0i32, 0i32)
    };

    Ok((move_idx, main_angle, sub_angle))
}

fn is_in_bounds_move(col: i32, row: i32, move_idx: usize, width: i32, height: i32) -> bool {
    let (next_col, next_row) = apply_move_from_position(col, row, move_idx, width, height);
    next_col != col || next_row != row || move_idx == 0
}

fn select_valid_move_idx(logits: &[f32], col: i32, row: i32, width: i32, height: i32) -> usize {
    let mut best_idx = 0usize;
    let mut best_val = f32::NEG_INFINITY;

    for (idx, value) in logits.iter().take(MOVE_HEAD_SIZE).enumerate() {
        if !is_in_bounds_move(col, row, idx, width, height) {
            continue;
        }
        if *value > best_val {
            best_val = *value;
            best_idx = idx;
        }
    }

    best_idx
}

fn apply_move(unit: &Unit, move_idx: usize, width: i32, height: i32) -> (i32, i32) {
    apply_move_from_position(
        unit.position().col(),
        unit.position().row(),
        move_idx,
        width,
        height,
    )
}

fn apply_move_from_position(
    col: i32,
    row: i32,
    move_idx: usize,
    width: i32,
    height: i32,
) -> (i32, i32) {
    let d_col = [0, -1, -1, 0, 0, 1, 1];
    let d_row_even = [0, -1, 0, -1, 1, -1, 0];
    let d_row_odd = [0, 0, 1, -1, 1, 0, 1];

    let dr = if col % 2 == 0 {
        d_row_even[move_idx]
    } else {
        d_row_odd[move_idx]
    };
    let dc = d_col[move_idx];
    let reserve_col = col + dc;
    let reserve_row = row + dr;

    if 0 <= reserve_col && reserve_col < width && 0 <= reserve_row && reserve_row < height {
        (reserve_col, reserve_row)
    } else {
        (col, row)
    }
}

impl OnnxEnemyStrategyService {
    pub fn new() -> Self {
        Self {}
    }
}

impl EnemyStrategyService for OnnxEnemyStrategyService {
    /// AIを使って相手のターン設定を生成する
    /// # Arguments
    /// * `player_units` - プレイヤーのユニットのベクター
    /// * `enemy_units` - 敵のユニットのベクター
    /// # Returns
    /// * `Result<Turn, String>` - 成功時は生成されたターン、失敗時はエラーメッセージ
    fn generate_ai_turn(
        &self,
        player_units: Vec<Unit>,
        enemy_units: Vec<Unit>,
    ) -> Result<Turn, String> {
        // 環境変数からモデルのベースパスを取得（デフォルトはローカル用の "./models"）
        let model_path =
            std::env::var("MODEL_PATH").unwrap_or_else(|_| "./models/wt_model.onnx".to_string());
        // モデルをロードして実行可能にする
        let model = tract_onnx::onnx()
            .model_for_path(&model_path)
            .map_err(|e| format!("Failed to load ONNX model: {}", e))?
            .into_optimized()
            .map_err(|e| format!("Failed to optimize model: {}", e))?
            .into_runnable()
            .map_err(|e| format!("Failed to make model runnable: {}", e))?;

        let game_config = GameConfig::get_game_config();
        let width = game_config.gameboard_width();
        let height = game_config.gameboard_height();

        // 敵ユニットの「仮想位置」。
        // Stepを組み立てるたびにこの配列を更新し、次Stepの観測入力に使う。
        // これにより 15 step が連続した移動計画としてつながる。
        let mut simulated_enemy_positions: Vec<(i32, i32)> = enemy_units
            .iter()
            .map(|u| (u.position().col(), u.position().row()))
            .collect();

        // プレイヤー側はこの関数内では固定スナップショットとして扱う。
        let player_positions: Vec<(i32, i32)> = player_units
            .iter()
            .map(|u| (u.position().col(), u.position().row()))
            .collect();

        let mut steps: Vec<Step> = Vec::new();

        // 15ステップ分のAIの行動を生成
        for _step_idx in 0..15 {
            // AIが作成したActionを格納するベクター
            let mut actions: Vec<Action> = Vec::new();

            // このstepで確定した「次の仮想位置」。
            // 全ユニット分の推論が終わった後に一括で反映することで、
            // 同じstep中は全員が同一時刻の状態を見て意思決定できる。
            let mut next_enemy_positions = simulated_enemy_positions.clone();

            // AIが操作するユニットごとに観測を作って推論を実行
            for (idx, unit) in enemy_units.iter().enumerate() {
                // 観測には「現在の仮想位置」を使う。
                // 学習時の並びと合わせて friends=敵, foes=プレイヤー。
                let obs = build_observation_from_positions(
                    idx,
                    &simulated_enemy_positions,
                    &player_positions,
                );

                let input = tract_ndarray::ArrayD::from_shape_vec(
                    tract_ndarray::IxDyn(&[1, obs.len()]),
                    obs.clone(),
                )
                .map_err(|e| format!("Failed to build input tensor: {}", e))?;
                let input_tensor = tract_onnx::prelude::Tensor::from(input);

                let result = model
                    .run(tvec!(input_tensor.into()))
                    .map_err(|e| format!("Inference failed: {}", e))?;

                let output = &result[0];
                let arr = output
                    .to_array_view::<f32>()
                    .map_err(|e| format!("Output to array failed: {}", e))?;
                let logits: Vec<f32> = arr.iter().cloned().collect();

                let (_raw_move_idx, main_angle, sub_angle) = map_logits_to_actions(&logits)?;

                // 盤外へ出る候補を除外してから移動方向を決定する。
                // 端で同じ方向を選び続ける固着を避けるため、推論時に有効手マスクをかける。
                let (current_col, current_row) = simulated_enemy_positions[idx];
                let move_idx =
                    select_valid_move_idx(&logits, current_col, current_row, width, height);

                // 実ユニットではなく「仮想位置」から次位置を計算する。
                let (target_col, target_row) =
                    apply_move_from_position(current_col, current_row, move_idx, width, height);

                // 次stepで使う仮想位置を更新。
                next_enemy_positions[idx] = (target_col, target_row);

                // Action を作成して Step に詰める
                let action = Action::create(
                    ActionType::new(ActionTypeValue::Move),
                    unit.unit_id().clone(),
                    unit.unit_type_id().clone(),
                    Position::new(target_col, target_row),
                    unit.using_main_trigger_id().clone(),
                    unit.using_sub_trigger_id().clone(),
                    TriggerAzimuth::new(main_angle),
                    TriggerAzimuth::new(sub_angle),
                    CurrentActionPoints::new(0),
                );
                actions.push(action);
            }

            // このstepの行動を保存し、次step用の仮想位置を反映する。
            let step = Step::create(StepId::new(Uuid::new_v4().to_string()), actions, Vec::new());
            steps.push(step);
            simulated_enemy_positions = next_enemy_positions;
        }

        if enemy_units.is_empty() {
            return Err("No enemy units provided".to_string());
        }
        let game_id = enemy_units[0].game_id().clone();
        let player_id = enemy_units[0].owner_player_id().clone();
        let mut turn = Turn::create(game_id, player_id, TurnNumber::initial(), Utc::now());
        turn.set_steps(steps);
        Ok(turn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
    use crate::domain::unit_management::models::unit::having_trigger_ids::having_trigger_ids::HavingTriggerIds;
    use crate::domain::unit_management::models::unit::is_bailout::is_bailout::IsBailout;
    use crate::domain::unit_management::models::unit::sight_range::sight_range::SightRange;
    use crate::domain::unit_management::models::unit::trigger_hp::TriggerHP;
    use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
    use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
    use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;
    use crate::domain::unit_management::models::unit::wait_time::wait_time::WaitTime;

    fn test_unit_at(col: i32, row: i32) -> Unit {
        Unit::reconstruct(
            UnitId::new(Uuid::new_v4().to_string()),
            UnitTypeId::new("UNIT_TEST".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            CurrentActionPoints::new(0),
            WaitTime::new(0),
            Position::new(col, row),
            TriggerId::new("MAIN".to_string()),
            TriggerId::new("SUB".to_string()),
            HavingTriggerIds::new(vec![]),
            HavingTriggerIds::new(vec![]),
            TriggerHP::new(100),
            TriggerHP::new(100),
            SightRange::new(3),
            IsBailout::new(false),
        )
    }

    #[test]
    fn build_observation_returns_expected_size_and_order() {
        let friends = vec![test_unit_at(10, 20), test_unit_at(11, 21)];
        let foes = vec![test_unit_at(30, 31)];

        let obs = build_observation(2, &friends, &foes);

        assert_eq!(obs.len(), OBSERVATION_SIZE);
        assert_eq!(obs[0], 10.0 / 35.0);
        assert_eq!(obs[1], 20.0 / 35.0);
        assert_eq!(obs[2], 11.0 / 35.0);
        assert_eq!(obs[3], 21.0 / 35.0);
        assert_eq!(obs[4], 0.0);
        assert_eq!(obs[5], 0.0);
        assert_eq!(obs[6], 0.0);
        assert_eq!(obs[7], 0.0);
        assert_eq!(obs[8], 30.0 / 35.0);
        assert_eq!(obs[9], 31.0 / 35.0);
        assert_eq!(obs[16], 2.0 / 3.0);
    }

    #[test]
    fn map_logits_selects_move_and_angles() {
        let mut logits = vec![0.0_f32; 19];
        logits[3] = 10.0;
        logits[7 + 4] = 9.0;
        logits[7 + 5 + 2] = 8.0;

        let (move_idx, main_angle, sub_angle) = map_logits_to_actions(&logits).unwrap();

        assert_eq!(move_idx, 3);
        assert!((0..=359).contains(&main_angle));
        assert!((0..=359).contains(&sub_angle));
    }

    #[test]
    fn apply_move_keeps_unit_in_place_for_out_of_bounds_target() {
        let unit = test_unit_at(0, 0);
        let (col, row) = apply_move(&unit, 1, GRID_SIZE, GRID_SIZE);

        assert_eq!((col, row), (0, 0));
    }

    #[test]
    fn select_valid_move_idx_avoids_out_of_bounds_choice() {
        let mut logits = vec![0.0_f32; 31];
        logits[1] = 10.0;
        logits[6] = 9.0;

        // (0,0) で move_idx=1 は盤外、move_idx=6 は盤内
        let selected = select_valid_move_idx(&logits, 0, 0, GRID_SIZE, GRID_SIZE);

        assert_eq!(selected, 6);
    }
}
