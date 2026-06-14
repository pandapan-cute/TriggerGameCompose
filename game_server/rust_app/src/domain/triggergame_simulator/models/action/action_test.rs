#[cfg(test)]
mod tests {
    use super::super::action::Action;
    use super::super::action_type::action_type::{ActionType, ActionTypeValue};
    use super::super::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::{
        game_id::game_id::GameId, visibility::Visibility,
    };
    use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
	use crate::domain::unit_management::models::unit::{
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_type_id::unit_type_id::UnitTypeId, Unit,
    };

    fn create_test_unit(player_id: &str, position: Position) -> Unit {
        Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            GameId::new("550e8400-e29b-41d4-a716-446655440200".to_string()),
            PlayerId::new(player_id.to_string()),
            position,
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("IBIS".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("SHIELD".to_string())]),
            100,
            100,
            8,
            10,
        )
    }

    #[test]
    fn test_generate_combats_returns_none_for_enemy_outside_visibility() {
        // 仕様: 視界外ユニットには攻撃できない。
        // 36x36で平坦マップを作り、視界上限(8.5hex)より遠い位置を使う。
        let mut visibility = Visibility::new(vec![vec![0; 36]; 36]);
        let action_owner =
            create_test_unit("550e8400-e29b-41d4-a716-446655440201", Position::new(0, 0));
        let mut defence_unit =
            create_test_unit("550e8400-e29b-41d4-a716-446655440202", Position::new(8, 0));

        let action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            action_owner.unit_id().clone(),
            action_owner.unit_type_id().clone(),
            action_owner.position().clone(),
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerAzimuth::new(0),
            TriggerAzimuth::new(0),
            CurrentActionPoints::new(5),
        );

        let combat = action.generate_combats(&mut defence_unit, &mut visibility);
        assert!(combat.is_none());
    }
}
