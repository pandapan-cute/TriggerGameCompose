#[cfg(test)]
mod tests {
    use super::super::turn_status::{TurnStatus, TurnStatusValue};

    #[test]
    fn test_step_setting() {
        let status = TurnStatus::new(TurnStatusValue::StepSetting);
        assert!(status.is_step_setting());
        assert!(!status.is_unit_stepping());
        assert!(!status.is_completed());
    }

    #[test]
    fn test_unit_stepping() {
        let status = TurnStatus::new(TurnStatusValue::UnitStepping);
        assert!(!status.is_step_setting());
        assert!(status.is_unit_stepping());
        assert!(!status.is_completed());
    }

    #[test]
    fn test_completed() {
        let status = TurnStatus::new(TurnStatusValue::Completed);
        assert!(!status.is_step_setting());
        assert!(!status.is_unit_stepping());
        assert!(status.is_completed());
    }

    #[test]
    fn test_equality() {
        let status1 = TurnStatus::new(TurnStatusValue::StepSetting);
        let status2 = TurnStatus::new(TurnStatusValue::StepSetting);
        assert_eq!(status1, status2);
    }
}
