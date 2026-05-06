use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::{
    game::Game, game_id::game_id::GameId, visibility::Visibility,
};
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

/// アクティブユニットとベイルアウトユニットのペアを作成
pub fn create_active_and_bailed_out_unit_pair(
    game_id: GameId,
    player_id: PlayerId,
) -> (Unit, Unit) {
    let active_unit = Unit::create(
        UnitTypeId::new("unit_type_active".to_string()),
        game_id.clone(),
        player_id.clone(),
        Position::new(5, 5),
        TriggerId::new("main_trigger_001".to_string()),
        TriggerId::new("sub_trigger_001".to_string()),
        HavingTriggerIds::new(vec![TriggerId::new("main_trigger_001".to_string())]),
        HavingTriggerIds::new(vec![TriggerId::new("sub_trigger_001".to_string())]),
        100,
        100,
        8,
        10,
    );

    let mut bailed_out_unit = Unit::create(
        UnitTypeId::new("unit_type_bailed".to_string()),
        game_id,
        player_id,
        Position::new(10, 10),
        TriggerId::new("main_trigger_002".to_string()),
        TriggerId::new("sub_trigger_002".to_string()),
        HavingTriggerIds::new(vec![TriggerId::new("main_trigger_002".to_string())]),
        HavingTriggerIds::new(vec![TriggerId::new("sub_trigger_002".to_string())]),
        100,
        100,
        8,
        10,
    );
    bailed_out_unit.bailout();

    (active_unit, bailed_out_unit)
}

/// field_stepsから簡潔な Visibility インスタンスを作成
pub fn create_simple_visibility_from_field_steps(field_steps: Vec<Vec<i32>>) -> Visibility {
    Visibility::new(field_steps)
}

/// ゲームと指定数のユニットを作成（一部ベイルアウト状態）
pub fn create_test_game_with_units(
    game_id: GameId,
    units_count: usize,
    bailout_indices: Vec<usize>,
) -> (Game, Vec<Unit>) {
    let player1_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440011".to_string());
    let player2_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440022".to_string());
    let game = Game::create(game_id.clone(), &player1_id, &player2_id);

    let mut units = Vec::new();
    for i in 0..units_count {
        let owner = if i % 2 == 0 {
            player1_id.clone()
        } else {
            player2_id.clone()
        };

        let mut unit = Unit::create(
            UnitTypeId::new(format!("unit_type_{}", i)),
            game_id.clone(),
            owner,
            Position::new((5 + i as i32) % 20, (5 + i as i32) % 20),
            TriggerId::new(format!("main_trigger_{}", i)),
            TriggerId::new(format!("sub_trigger_{}", i)),
            HavingTriggerIds::new(vec![TriggerId::new(format!("main_trigger_{}", i))]),
            HavingTriggerIds::new(vec![TriggerId::new(format!("sub_trigger_{}", i))]),
            100,
            100,
            8,
            10,
        );

        if bailout_indices.contains(&i) {
            unit.bailout();
        }
        units.push(unit);
    }

    (game, units)
}
