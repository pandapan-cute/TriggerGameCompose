#[cfg(test)]
mod tests {
    use super::super::match_id::MatchId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let match_id = MatchId::new(uuid.to_string());
        assert_eq!(match_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "MatchIdが空文字です")]
    fn test_empty_string_panic() {
        MatchId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "MatchIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        MatchId::new("invalid-uuid".to_string());
    }
}
