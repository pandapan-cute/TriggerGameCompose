#[cfg(test)]
mod tests {
    use super::super::action_type::{ActionType, ActionTypeValue};

    #[test]
    fn test_move() {
        let action_type = ActionType::new(ActionTypeValue::Move);
        assert!(action_type.is_move());
        assert!(!action_type.is_guard());
    }

    #[test]
    fn test_wait() {
        let action_type = ActionType::new(ActionTypeValue::Wait);
        assert!(action_type.is_wait());
    }

    #[test]
    fn test_guard() {
        let action_type = ActionType::new(ActionTypeValue::Guard);
        assert!(action_type.is_guard());
    }

    #[test]
    fn test_unique_command() {
        let action_type = ActionType::new(ActionTypeValue::UniqueCommand);
        assert!(action_type.is_unique_command());
    }

    #[test]
    fn test_pursuit_move() {
        let action_type = ActionType::new(ActionTypeValue::PursuitMove);
        assert!(action_type.is_pursuit_move());
    }

    #[test]
    fn test_equality() {
        let action_type1 = ActionType::new(ActionTypeValue::Move);
        let action_type2 = ActionType::new(ActionTypeValue::Move);
        assert_eq!(action_type1, action_type2);
    }
}
