#[cfg(test)]
mod tests {
    use super::super::combat::{Combat, GuardPattern};
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::triggergame_simulator::models::combat;
    use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
    use crate::domain::unit_management::models::unit::Unit;
use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::having_trigger_ids::having_trigger_ids::HavingTriggerIds;
use crate::domain::unit_management::models::unit::is_bailout::is_bailout::IsBailout;
use crate::domain::unit_management::models::unit::position::position::Position;
    use crate::domain::unit_management::models::unit::sight_range::sight_range::SightRange;
use crate::domain::unit_management::models::unit::trigger_hp::TriggerHP;
    use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
    use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;
use crate::domain::unit_management::models::unit::wait_time::wait_time::WaitTime;
    use uuid::Uuid;

    fn create_test_position() -> Position {
        Position::new(0, 0)
    }

    fn create_test_unit_id() -> UnitId {
        UnitId::new(Uuid::new_v4().to_string())
    }

    fn create_test_trigger_id() -> TriggerId {
        TriggerId::new("KOGETSU".to_string())
    }

    fn create_test_trigger_azimuth() -> TriggerAzimuth {
        TriggerAzimuth::new(0)
    }

    fn create_test_visiblity() -> Visibility {
        Visibility::create()
    }

    /// ポジションはcombat内で反転されるので攻撃側から見た位置と防御側から見た位置をそれぞれ設定する
    /// シューターが画面左上で後ろ向きにトリガーを向けて攻撃（同じ階層）
    #[test]
    fn test_create_combat_shooter() {
        let mut visibility = create_test_visiblity();
        let mut attacker_unit = Unit::create(
            UnitTypeId::new("MIKUMO_OSAMU".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(14, 9),
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("ASTEROID".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("RAYGUST".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("ASTEROID".to_string())]),
            100,
            100,
            8,
            15,
        );
        attacker_unit.set_main_trigger_azimuth(TriggerAzimuth::new(180));
        attacker_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(180));

        let mut defender_unit = Unit::create(
            UnitTypeId::new("AMATORI_CHIKA".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(21, 22),
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("BAGWORM".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("IBIS".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("BAGWORM".to_string())]),
            100,
            100,
            8,
            15,
        );
        defender_unit.set_main_trigger_azimuth(TriggerAzimuth::new(0));
        defender_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(0));
        let combat = Combat::create(
            &mut attacker_unit,
            3,
            &mut defender_unit,
            4,
            0,
            &mut visibility,
        );
        println!("Combat creation result: {:?}", combat);

        // Combatの生成に成功するか
        assert!(combat.is_some());
    }

    /// シューターが画面右上で前向きにトリガーを向けて攻撃（同じ階層）
    /// 回避を0にすることで確実にメイントリガーの防御行動が発生することを確認する
    #[test]
    fn test_create_combat_shooter_02() {
        let mut visibility = create_test_visiblity();
        let mut attacker_unit = Unit::create(
            UnitTypeId::new("MIKUMO_OSAMU".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(6, 35),
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("ASTEROID".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("RAYGUST".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("ASTEROID".to_string())]),
            100,
            100,
            8,
            15,
        );
        attacker_unit.set_main_trigger_azimuth(TriggerAzimuth::new(354));
        attacker_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(3));

        let mut defender_unit = Unit::create(
            UnitTypeId::new("MIKUMO_OSAMU".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(29, 4),
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("ASTEROID".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("RAYGUST".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("ASTEROID".to_string())]),
            100,
            100,
            8,
            15,
        );
        defender_unit.set_main_trigger_azimuth(TriggerAzimuth::new(5));
        defender_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(352));
        let combat = Combat::create(
            &mut attacker_unit,
            3,
            &mut defender_unit,
            4,
            0,
            &mut visibility,
        );
        println!("Combat creation result: {:?}", combat);

        // Combatの生成に成功するか
        let combat = combat.unwrap();
        assert!(
            combat.is_avoided() == false // 回避されていないこと
                && combat.is_defeated() == false // 撃墜していないこと
                && combat.main_trigger_hp().value() < 100 // メイントリガーのHPが減少していること
        );
    }

    /// スナイパーがタワー上で横向きにトリガーを向けて攻撃（攻撃側が上の階層、防御側が下の階層）
    #[test]
    fn test_create_combat_sniper() {
        let mut visibility = create_test_visiblity();
        let mut attacker_unit = Unit::create(
            UnitTypeId::new("AMATORI_CHIKA".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(20, 27),
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("BAGWORM".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("IBIS".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("BAGWORM".to_string())]),
            100,
            100,
            8,
            15,
        );
        attacker_unit.set_main_trigger_azimuth(TriggerAzimuth::new(270));
        attacker_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(3));

        let mut defender_unit = Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            GameId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
            Position::new(27, 8),
            TriggerId::new("SCORPION".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("SCORPION".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("SHIELD".to_string())]),
            100,
            100,
            8,
            15,
        );
        defender_unit.set_main_trigger_azimuth(TriggerAzimuth::new(90));
        defender_unit.set_sub_trigger_azimuth(TriggerAzimuth::new(90));

        let combat = Combat::create(
            &mut attacker_unit,
            2,
            &mut defender_unit,
            8,
            10,
            &mut visibility,
        );
        println!("Combat creation result: {:?}", combat);

        // Combatの生成に成功するか
        assert!(combat.is_some());
    }

    /// 両防御パターンテスト
    #[test]
    fn test_determine_guard_pattern_full() {
        let pattern = Combat::determine_guard_pattern(true, 10, true, 5);
        assert_eq!(pattern, GuardPattern::Full);
    }

    /// メイントリガー防御パターンテスト
    #[test]
    fn test_determine_guard_pattern_main_only() {
        let pattern = Combat::determine_guard_pattern(true, 10, false, 5);
        assert_eq!(pattern, GuardPattern::MainOnly);

        let pattern_sub_not_defensive = Combat::determine_guard_pattern(true, 10, true, 0);
        assert_eq!(pattern_sub_not_defensive, GuardPattern::MainOnly);
    }

    /// サブトリガー防御パターンテスト
    #[test]
    fn test_determine_guard_pattern_sub_only() {
        let pattern = Combat::determine_guard_pattern(false, 10, true, 5);
        assert_eq!(pattern, GuardPattern::SubOnly);

        let pattern_main_not_defensive = Combat::determine_guard_pattern(true, 0, true, 5);
        assert_eq!(pattern_main_not_defensive, GuardPattern::SubOnly);
    }

    /// 防御なしパターンテスト
    #[test]
    fn test_determine_guard_pattern_none() {
        let pattern = Combat::determine_guard_pattern(false, 10, false, 5);
        assert_eq!(pattern, GuardPattern::None);

        let pattern_non_defensive = Combat::determine_guard_pattern(true, 0, true, 0);
        assert_eq!(pattern_non_defensive, GuardPattern::None);
    }
}
