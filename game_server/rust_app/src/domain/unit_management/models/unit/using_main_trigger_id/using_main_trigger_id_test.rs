#[cfg(test)]
mod tests {
    use super::super::using_main_trigger_id::UsingMainTriggerId;

    #[test]
    /// バグワーム判定のテスト
    fn test_is_bagworm() {
        let id = UsingMainTriggerId::new("BAGWORM".to_string());
        assert!(id.is_bagworm());

        let id = UsingMainTriggerId::new("SCORPION".to_string());
        assert!(!id.is_bagworm());
    }

    #[test]
    fn test_valid_id() {
        let id = UsingMainTriggerId::new("SCORPION".to_string());
        assert_eq!(id.value(), "SCORPION");
    }

    #[test]
    #[should_panic(expected = "UsingMainTriggerIdは1文字以上である必要があります")]
    fn test_empty_string_panic() {
        UsingMainTriggerId::new("".to_string());
    }

    #[test]
    fn test_equality() {
        let id1 = UsingMainTriggerId::new("RAYGUST".to_string());
        let id2 = UsingMainTriggerId::new("RAYGUST".to_string());
        assert_eq!(id1, id2);
    }
}
