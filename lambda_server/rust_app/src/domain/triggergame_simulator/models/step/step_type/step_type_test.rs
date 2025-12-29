#[cfg(test)]
mod tests {
    use super::super::step_type::{StepType, StepTypeValue};

    #[test]
    fn test_move() {
        let step_type = StepType::new(StepTypeValue::Move);
        assert!(step_type.is_move());
        assert!(!step_type.is_attack());
    }

    #[test]
    fn test_attack() {
        let step_type = StepType::new(StepTypeValue::Attack);
        assert!(step_type.is_attack());
        assert!(!step_type.is_move());
    }

    #[test]
    fn test_wait() {
        let step_type = StepType::new(StepTypeValue::Wait);
        assert!(step_type.is_wait());
    }

    #[test]
    fn test_guard() {
        let step_type = StepType::new(StepTypeValue::Guard);
        assert!(step_type.is_guard());
    }

    #[test]
    fn test_unique_command() {
        let step_type = StepType::new(StepTypeValue::UniqueCommand);
        assert!(step_type.is_unique_command());
    }

    #[test]
    fn test_pursuit_move() {
        let step_type = StepType::new(StepTypeValue::PursuitMove);
        assert!(step_type.is_pursuit_move());
    }

    #[test]
    fn test_equality() {
        let step_type1 = StepType::new(StepTypeValue::Move);
        let step_type2 = StepType::new(StepTypeValue::Move);
        assert_eq!(step_type1, step_type2);
    }
}
