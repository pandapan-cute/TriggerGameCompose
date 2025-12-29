#[cfg(test)]
mod tests {
    use super::super::matching_id::MatchingId;

    #[test]
    fn test_valid_uuid() {
        let valid_uuid = "550e8400-e29b-41d4-a716-446655440000";
        let matching_id = MatchingId::new(valid_uuid.to_string());
        assert_eq!(matching_id.value(), valid_uuid);
    }

    #[test]
    fn test_equality() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let matching_id1 = MatchingId::new(uuid.to_string());
        let matching_id2 = MatchingId::new(uuid.to_string());
        let matching_id3 = MatchingId::new("123e4567-e89b-12d3-a456-426614174000".to_string());

        assert_eq!(matching_id1, matching_id2);
        assert_ne!(matching_id1, matching_id3);
    }

    #[test]
    #[should_panic(expected = "MatchingIdが空文字です")]
    fn test_empty_string_panic() {
        MatchingId::new(String::new());
    }

    #[test]
    #[should_panic(expected = "MatchingIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        MatchingId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_clone() {
        let matching_id1 = MatchingId::new("550e8400-e29b-41d4-a716-446655440000".to_string());
        let matching_id2 = matching_id1.clone();
        assert_eq!(matching_id1, matching_id2);
    }
}