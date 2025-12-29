#[cfg(test)]
mod tests {
    use super::super::player_id::PlayerId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let player_id = PlayerId::new(uuid.to_string());
        assert_eq!(player_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "PlayerIdが空文字です")]
    fn test_empty_string_panic() {
        PlayerId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "PlayerIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        PlayerId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_equality() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let player_id1 = PlayerId::new(uuid.to_string());
        let player_id2 = PlayerId::new(uuid.to_string());
        assert_eq!(player_id1, player_id2);
    }

    #[test]
    fn test_clone() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let player_id1 = PlayerId::new(uuid.to_string());
        let player_id2 = player_id1.clone();
        assert_eq!(player_id1, player_id2);
    }
}
