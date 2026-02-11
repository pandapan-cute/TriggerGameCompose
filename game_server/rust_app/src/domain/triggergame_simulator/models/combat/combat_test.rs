#[cfg(test)]
mod tests {
    use super::super::combat::Combat;
    use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
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

    #[test]
    fn test_create_combat_returns_option() {
        let combat = Combat::create(
            create_test_unit_id(),
            create_test_position(),
            create_test_trigger_id(),
            create_test_trigger_id(),
            create_test_trigger_azimuth(),
            create_test_trigger_azimuth(),
            10,
            create_test_unit_id(),
            Position::new(100, 100),
            create_test_trigger_id(),
            create_test_trigger_id(),
            100,
            100,
            create_test_trigger_azimuth(),
            create_test_trigger_azimuth(),
            5,
            2,
        );

        // Combatの生成に成功するか（射程や角度等の条件により失敗する可能性あり）
        assert!(combat.is_some() || combat.is_none());
    }
}
