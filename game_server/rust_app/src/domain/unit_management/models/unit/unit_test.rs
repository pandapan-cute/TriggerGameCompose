#[cfg(test)]
mod tests {
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;

    use super::super::current_action_points::current_action_points::CurrentActionPoints;
    use super::super::having_main_trigger_ids::having_main_trigger_ids::HavingMainTriggerIds;
    use super::super::having_sub_trigger_ids::having_sub_trigger_ids::HavingSubTriggerIds;
    use super::super::is_bailout::is_bailout::IsBailout;
    use super::super::main_trigger_hp::main_trigger_hp::MainTriggerHP;
    use super::super::position::position::Position;
    use super::super::sight_range::sight_range::SightRange;
    use super::super::sub_trigger_hp::sub_trigger_hp::SubTriggerHP;
    use super::super::unit::Unit;
    use super::super::unit_id::unit_id::UnitId;
    use super::super::unit_type_id::unit_type_id::UnitTypeId;
    use super::super::using_main_trigger_id::using_main_trigger_id::UsingMainTriggerId;
    use super::super::using_sub_trigger_id::using_sub_trigger_id::UsingSubTriggerId;
    use super::super::wait_time::wait_time::WaitTime;
    use uuid::Uuid;

    fn create_test_unit() -> Unit {
        let unit_type_id = UnitTypeId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let owner_player_id = PlayerId::new(Uuid::new_v4().to_string());
        let position = Position::new(0, 0);
        let having_main_trigger_ids = HavingMainTriggerIds::new(vec![]);
        let having_sub_trigger_ids = HavingSubTriggerIds::new(vec![]);

        Unit::create(
            unit_type_id,
            game_id,
            owner_player_id,
            position,
            UsingMainTriggerId::new("KOGETSU".to_string()),
            UsingSubTriggerId::new("SHIELD".to_string()),
            having_main_trigger_ids,
            having_sub_trigger_ids,
            100, // initial_main_hp
            50,  // initial_sub_hp
            5,   // initial_sight_range
            10,  // initial_action_points
        )
    }

    #[test]
    fn test_create_unit() {
        let unit = create_test_unit();

        assert_eq!(unit.main_trigger_hp().value(), 100);
        assert_eq!(unit.sub_trigger_hp().value(), 50);
        assert_eq!(unit.sight_range().value(), 5);
        assert_eq!(unit.current_action_points().value(), 10);
        assert_eq!(unit.wait_time().value(), 0);
        assert!(unit.is_active());
        assert!(!unit.is_bailed_out());
    }

    #[test]
    fn test_move_to() {
        let mut unit = create_test_unit();
        let new_position = Position::new(5, 5);

        unit.move_to(new_position.clone(), 3).unwrap();

        assert_eq!(unit.position().x(), 5);
        assert_eq!(unit.position().y(), 5);
        assert_eq!(unit.current_action_points().value(), 7);
    }

    #[test]
    fn test_move_to_insufficient_action_points() {
        let mut unit = create_test_unit();
        let new_position = Position::new(5, 5);

        let result = unit.move_to(new_position, 15);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "行動ポイントが不足しています");
    }

    #[test]
    fn test_move_to_when_bailed_out() {
        let mut unit = create_test_unit();
        unit.bailout();

        let new_position = Position::new(5, 5);
        let result = unit.move_to(new_position, 3);

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "ベイルアウト済みのユニットは移動できません"
        );
    }

    #[test]
    fn test_take_main_trigger_damage() {
        let mut unit = create_test_unit();

        unit.take_main_trigger_damage(30).unwrap();
        assert_eq!(unit.main_trigger_hp().value(), 70);

        unit.take_main_trigger_damage(80).unwrap();
        assert_eq!(unit.main_trigger_hp().value(), 0);
        assert!(unit.is_bailed_out()); // HPが0になると自動ベイルアウト
    }

    #[test]
    fn test_take_sub_trigger_damage() {
        let mut unit = create_test_unit();

        unit.take_sub_trigger_damage(20).unwrap();
        assert_eq!(unit.sub_trigger_hp().value(), 30);

        unit.take_sub_trigger_damage(40).unwrap();
        assert_eq!(unit.sub_trigger_hp().value(), 0);
    }

    #[test]
    fn test_heal_main_trigger() {
        let mut unit = create_test_unit();
        unit.take_main_trigger_damage(50).unwrap();

        assert_eq!(unit.main_trigger_hp().value(), 50);

        unit.heal_main_trigger(30).unwrap();
        assert_eq!(unit.main_trigger_hp().value(), 80);
    }

    #[test]
    fn test_heal_sub_trigger() {
        let mut unit = create_test_unit();
        unit.take_sub_trigger_damage(30).unwrap();

        assert_eq!(unit.sub_trigger_hp().value(), 20);

        unit.heal_sub_trigger(15).unwrap();
        assert_eq!(unit.sub_trigger_hp().value(), 35);
    }

    #[test]
    fn test_consume_action_points() {
        let mut unit = create_test_unit();

        unit.consume_action_points(5).unwrap();
        assert_eq!(unit.current_action_points().value(), 5);

        let result = unit.consume_action_points(10);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "行動ポイントが不足しています");
    }

    #[test]
    fn test_restore_action_points() {
        let mut unit = create_test_unit();
        unit.consume_action_points(8).unwrap();

        assert_eq!(unit.current_action_points().value(), 2);

        unit.restore_action_points(5).unwrap();
        assert_eq!(unit.current_action_points().value(), 7);
    }

    #[test]
    fn test_set_wait_time() {
        let mut unit = create_test_unit();
        let wait_time = WaitTime::new(100);

        unit.set_wait_time(wait_time.clone());
        assert_eq!(unit.wait_time(), &wait_time);
    }

    #[test]
    fn test_bailout_and_revive() {
        let mut unit = create_test_unit();

        assert!(unit.is_active());
        assert!(!unit.is_bailed_out());

        unit.bailout();
        assert!(!unit.is_active());
        assert!(unit.is_bailed_out());

        unit.revive();
        assert!(unit.is_active());
        assert!(!unit.is_bailed_out());
    }

    #[test]
    fn test_reconstruct_unit() {
        let unit_id = UnitId::new(Uuid::new_v4().to_string());
        let unit_type_id = UnitTypeId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let owner_player_id = PlayerId::new(Uuid::new_v4().to_string());
        let current_action_points = CurrentActionPoints::new(15);
        let wait_time = WaitTime::new(50);
        let position = Position::new(10, 20);
        let using_main_trigger_id = UsingMainTriggerId::new(Uuid::new_v4().to_string());
        let using_sub_trigger_id = UsingSubTriggerId::new(Uuid::new_v4().to_string());
        let having_main_trigger_ids = HavingMainTriggerIds::new(vec![]);
        let having_sub_trigger_ids = HavingSubTriggerIds::new(vec![]);
        let main_trigger_hp = MainTriggerHP::new(80);
        let sub_trigger_hp = SubTriggerHP::new(40);
        let sight_range = SightRange::new(7);
        let is_bailout = IsBailout::new(false);

        let unit = Unit::reconstruct(
            unit_id.clone(),
            unit_type_id.clone(),
            game_id.clone(),
            owner_player_id.clone(),
            current_action_points.clone(),
            wait_time.clone(),
            position.clone(),
            using_main_trigger_id.clone(),
            using_sub_trigger_id.clone(),
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp.clone(),
            sub_trigger_hp.clone(),
            sight_range.clone(),
            is_bailout,
        );

        assert_eq!(unit.unit_id(), &unit_id);
        assert_eq!(unit.unit_type_id(), &unit_type_id);
        assert_eq!(unit.owner_player_id(), &owner_player_id);
        assert_eq!(unit.current_action_points(), &current_action_points);
        assert_eq!(unit.wait_time(), &wait_time);
        assert_eq!(unit.position(), &position);
        assert_eq!(unit.using_main_trigger_id(), &using_main_trigger_id);
        assert_eq!(unit.using_sub_trigger_id(), &using_sub_trigger_id);
        assert_eq!(unit.main_trigger_hp(), &main_trigger_hp);
        assert_eq!(unit.sub_trigger_hp(), &sub_trigger_hp);
        assert_eq!(unit.sight_range(), &sight_range);
    }

    #[test]
    fn test_unit_equality() {
        let unit_id = UnitId::new(Uuid::new_v4().to_string());
        let unit_type_id = UnitTypeId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let owner_player_id = PlayerId::new(Uuid::new_v4().to_string());
        let current_action_points = CurrentActionPoints::new(10);
        let wait_time = WaitTime::new(0);
        let position = Position::new(0, 0);
        let using_main_trigger_id = UsingMainTriggerId::new("KOGETSU".to_string());
        let using_sub_trigger_id = UsingSubTriggerId::new("SHIELD".to_string());
        let having_main_trigger_ids = HavingMainTriggerIds::new(vec![]);
        let having_sub_trigger_ids = HavingSubTriggerIds::new(vec![]);
        let main_trigger_hp = MainTriggerHP::new(100);
        let sub_trigger_hp = SubTriggerHP::new(50);
        let sight_range = SightRange::new(5);
        let is_bailout = IsBailout::new(false);

        let unit1 = Unit::reconstruct(
            unit_id.clone(),
            unit_type_id.clone(),
            game_id.clone(),
            owner_player_id.clone(),
            current_action_points.clone(),
            wait_time.clone(),
            position.clone(),
            using_main_trigger_id.clone(),
            using_sub_trigger_id.clone(),
            having_main_trigger_ids.clone(),
            having_sub_trigger_ids.clone(),
            main_trigger_hp.clone(),
            sub_trigger_hp.clone(),
            sight_range.clone(),
            is_bailout.clone(),
        );

        let unit2 = Unit::reconstruct(
            unit_id.clone(),
            unit_type_id,
            game_id,
            owner_player_id,
            current_action_points,
            wait_time,
            position,
            using_main_trigger_id.clone(),
            using_sub_trigger_id.clone(),
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp,
            sub_trigger_hp,
            sight_range,
            is_bailout,
        );

        assert_eq!(unit1, unit2);
    }
}
