#[cfg(test)]
mod tests {
    use super::super::turn_id::TurnId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let turn_id = TurnId::new(uuid.to_string());
        assert_eq!(turn_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "TurnIdが空文字です")]
    fn test_empty_string_panic() {
        TurnId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "TurnIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        TurnId::new("invalid-uuid".to_string());
    }
}
