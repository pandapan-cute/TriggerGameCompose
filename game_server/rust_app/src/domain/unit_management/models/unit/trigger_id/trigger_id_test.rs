#[cfg(test)]
mod tests {
    use super::super::trigger_id::TriggerId;

    #[test]
    /// バグワーム判定のテスト
    fn test_is_bagworm() {
        let id = TriggerId::new("BAGWORM".to_string());
        assert!(id.is_bagworm());

        let id = TriggerId::new("SCORPION".to_string());
        assert!(!id.is_bagworm());
    }

    #[test]
    fn test_valid_id() {
        let id = TriggerId::new("SCORPION".to_string());
        assert_eq!(id.value(), "SCORPION");
    }

    #[test]
    #[should_panic(expected = "TriggerIdは1文字以上である必要があります")]
    fn test_empty_string_panic() {
        TriggerId::new("".to_string());
    }

    #[test]
    fn test_equality() {
        let id1 = TriggerId::new("RAYGUST".to_string());
        let id2 = TriggerId::new("RAYGUST".to_string());
        assert_eq!(id1, id2);
    }
}
