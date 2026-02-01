#[cfg(test)]
mod tests {
    use super::super::using_sub_trigger_id::UsingSubTriggerId;

    /// バグワーム判定のテスト
    #[test]
    fn test_is_bagworm() {
        let id = UsingSubTriggerId::new("BAGWORM".to_string());
        assert!(id.is_bagworm());

        let id = UsingSubTriggerId::new("SHIELD".to_string());
        assert!(!id.is_bagworm());
    }

    #[test]
    fn test_valid_id() {
        let id = UsingSubTriggerId::new("SHIELD".to_string());
        assert_eq!(id.value(), "SHIELD");
    }

    #[test]
    #[should_panic(expected = "UsingSubTriggerIdは1文字以上である必要があります")]
    fn test_empty_string_panic() {
        UsingSubTriggerId::new("".to_string());
    }

    #[test]
    fn test_equality() {
        let id1 = UsingSubTriggerId::new("BAGWORM".to_string());
        let id2 = UsingSubTriggerId::new("BAGWORM".to_string());
        assert_eq!(id1, id2);
    }
}
