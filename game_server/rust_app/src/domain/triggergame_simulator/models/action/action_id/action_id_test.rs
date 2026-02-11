#[cfg(test)]
mod tests {
    use super::super::action_id::ActionId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let action_id = ActionId::new(uuid.to_string());
        assert_eq!(action_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "ActionIdが空文字です")]
    fn test_empty_string_panic() {
        ActionId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "ActionIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        ActionId::new("invalid-uuid".to_string());
    }
}
