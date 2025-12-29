#[cfg(test)]
mod tests {
    use super::super::player_id::PlayerId;

    #[test]
    fn test_valid_uuid() {
        let valid_uuid = "550e8400-e29b-41d4-a716-446655440000";
        let player_id = PlayerId::new(valid_uuid.to_string());
        assert_eq!(player_id.value(), valid_uuid);
    }

    #[test]
    fn test_equality() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        let player_id1 = PlayerId::new(uuid.to_string());
        let player_id2 = PlayerId::new(uuid.to_string());
        let player_id3 = PlayerId::new("123e4567-e89b-12d3-a456-426614174000".to_string());

        assert_eq!(player_id1, player_id2);
        assert_ne!(player_id1, player_id3);
    }

    #[test]
    #[should_panic(expected = "PlayerIdが空文字です")]
    fn test_empty_string_panic() {
        PlayerId::new(String::new());
    }

    #[test]
    #[should_panic(expected = "PlayerIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        PlayerId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_clone() {
        let player_id1 = PlayerId::new("550e8400-e29b-41d4-a716-446655440000".to_string());
        let player_id2 = player_id1.clone();
        assert_eq!(player_id1, player_id2);
    }
}