use serde::{Deserialize, Serialize};

use crate::domain::{
    player_management::models::player::player_id::player_id::PlayerId,
    triggergame_simulator::models::{
        action::Action,
        game::game_id::game_id::GameId,
        step::{step::Step, step_id::step_id::StepId},
    },
    unit_management::models::unit::{
        current_action_points::current_action_points::CurrentActionPoints,
        position::position::Position, trigger_id::trigger_id::TriggerId, unit_id::unit_id::UnitId,
        wait_time::wait_time::WaitTime, Unit,
    },
};

/// ターン内の操作リクエスト
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnActionDto {
    pub action: String,
    pub turn_number: i32,
    pub player_id: String,
    pub game_id: String,
    pub steps: Vec<Step>,
    pub timestamp: String,
}

impl TurnActionDto {
    /// action_historyをStep構造体のベクタに変換
    pub fn to_steps(&self, game_id: &GameId, owner_player_id: &PlayerId) -> Vec<Step> {
        // self.action_history
        //     .iter()
        //     .map(|action| {
        //         Step::create(
        //             StepId::new(action.unit_id.clone()),
        //             StepType::new_string(action.step_type),
        //             Position::new(action.position.x(), action.position.y()),
        //             Unit::new(
        //                 UnitId::new(action.unit_id.clone()),
        //                 UnitTypeId::new(action.unit_type_id.clone()),
        //                 game_id.clone(),
        //                 owner_player_id.clone(),
        //                 CurrentActionPoints::new(0), // 仮の値、実際の値はターン演算内で設定
        //                 WaitTime::new(0),            // 仮の値、実際の値はターン演算内で設定
        //                 Position::new(action.position.x(), action.position.y()),
        //                 TriggerId::new(action.
        //                      action.main_azimuth,
        //                 action.sub_azimuth,
        //                 StepType::new_string(action.sub_trigger.clone()),
        //                 action.timestamp.clone(),
        //             ),
        //         )
        //     })
        //     .collect()

        let steps: Vec<Step> = Vec::new();
        steps
    }
}

// /// 1手分の操作履歴
// #[derive(Debug, Clone, Serialize, Deserialize)]
// #[serde(rename_all = "camelCase")]
// pub struct ActionHistoryDto {
//     // ユニットID（追加）
//     pub unit_id: String,
//     // ユニット種類ID（旧character_id）
//     pub unit_type_id: String,
//     pub position: Position,
//     /// アクションの種類（追加）
//     pub step_type: String,
//     pub main_azimuth: f32,
//     pub sub_azimuth: f32,
//     pub main_trigger: String,
//     pub sub_trigger: String,
//     pub timestamp: String,
// }
