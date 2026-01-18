#[cfg(test)]
mod tests {
    use super::super::using_sub_trigger_id::UsingSubTriggerId;

    #[test]
    fn test_valid_id() {
        let id = UsingSubTriggerId::new("shield".to_string());
        assert_eq!(id.value(), "shield");
    }

    #[test]
    #[should_panic(expected = "UsingSubTriggerIdは1文字以上である必要があります")]
    fn test_empty_string_panic() {
        UsingSubTriggerId::new("".to_string());
    }

    #[test]
    fn test_equality() {
        let id1 = UsingSubTriggerId::new("bagworm".to_string());
        let id2 = UsingSubTriggerId::new("bagworm".to_string());
        assert_eq!(id1, id2);
    }
}
