use crate::domain::triggergame_simulator::configs::game_config::GameConfig;
use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
    ActionType, ActionTypeValue,
};
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
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
    let mut obs: Vec<f32> = Vec::with_capacity(OBSERVATION_SIZE);

    for i in 0..4 {
        if i < friends.len() {
            let p = friends[i].position();
            obs.push(p.col() as f32 / 35.0);
            obs.push(p.row() as f32 / 35.0);
        } else {
            obs.push(0.0);
            obs.push(0.0);
        }
    }

    for i in 0..4 {
        if i < foes.len() {
            let p = foes[i].position();
            obs.push(p.col() as f32 / 35.0);
            obs.push(p.row() as f32 / 35.0);
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

fn apply_move(unit: &Unit, move_idx: usize, width: i32, height: i32) -> (i32, i32) {
    let col = unit.position().col();
    let row = unit.position().row();
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
        let base_path = std::env::var("MODEL_BASE_PATH").unwrap_or_else(|_| "./models".to_string());
        let model_path = format!("{}/wt_model.onnx", base_path);

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

        let mut steps: Vec<Step> = Vec::new();

        // AIが操作するユニットごとに観測を作って推論を実行
        for (idx, unit) in enemy_units.iter().enumerate() {
            // 学習時とは視点が逆なので、friends=enemy_units, foes=player_units
            let obs = build_observation(idx, &enemy_units, &player_units);

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

            let (move_idx, main_angle, sub_angle) = map_logits_to_actions(&logits)?;
            let (target_col, target_row) = apply_move(unit, move_idx, width, height);

            // Action を作成して Step に詰める
            let action = crate::domain::triggergame_simulator::models::action::Action::create(
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

            let step = Step::create(
                StepId::new(Uuid::new_v4().to_string()),
                vec![action],
                Vec::new(),
            );
            steps.push(step);
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
}
