use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
use crate::domain::unit_management::models::unit::{
    having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
    unit_type_id::unit_type_id::UnitTypeId, Unit,
};

/// テスト用のUnitを作成
pub fn create_test_unit() -> Unit {
    let game_id = "550e8400-e29b-41d4-a716-446655440000";
    let player_uuid = "550e8400-e29b-41d4-a716-446655440001";
    Unit::create(
        UnitTypeId::new("unit_type_001".to_string()),
        GameId::new(game_id.to_string()),
        PlayerId::new(player_uuid.to_string()),
        Position::new(5, 10),
        TriggerId::new("main_trigger_001".to_string()),
        TriggerId::new("sub_trigger_001".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("main_trigger_001".to_string()),
            TriggerId::new("main_trigger_002".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("sub_trigger_001".to_string()),
            TriggerId::new("sub_trigger_002".to_string()),
        ]),
        100,
        100,
        8,
        13,
    )
}

/// アクションポイントが0のテスト用のUnitを作成
pub fn create_test_0_action_points_unit() -> Unit {
    let game_id = "550e8400-e29b-41d4-a716-446655440000";
    let player_uuid = "550e8400-e29b-41d4-a716-446655440001";
    Unit::create(
        UnitTypeId::new("unit_type_001".to_string()),
        GameId::new(game_id.to_string()),
        PlayerId::new(player_uuid.to_string()),
        Position::new(5, 10),
        TriggerId::new("main_trigger_001".to_string()),
        TriggerId::new("sub_trigger_001".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("main_trigger_001".to_string()),
            TriggerId::new("main_trigger_002".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("sub_trigger_001".to_string()),
            TriggerId::new("sub_trigger_002".to_string()),
        ]),
        100,
        100,
        8,
        0,
    )
}
