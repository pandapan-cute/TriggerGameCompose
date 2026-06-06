#[cfg(test)]
mod tests {
    use super::super::combat::Combat;
    use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
    use crate::domain::unit_management::models::unit::position::position::Position;
    use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
    use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
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
        let combat = Combat::create(
            create_test_unit_id(),
            Position::new(14, 9),
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("ASTEROID".to_string()),
            TriggerAzimuth::new(180),
            TriggerAzimuth::new(180),
            10,
            create_test_unit_id(),
            Position::new(21, 22),
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("BAGWORM".to_string()),
            100,
            100,
            TriggerAzimuth::new(0),
            TriggerAzimuth::new(0),
            5,
            2,
            &mut visibility,
        );
        println!("Combat creation result: {:?}", combat);

        // Combatの生成に成功するか
        assert!(combat.is_some());
    }
}
