#[cfg(test)]
mod tests {
    use super::super::game_id::GameId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let game_id = GameId::new(uuid.to_string());
        assert_eq!(game_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "GameIdが空文字です")]
    fn test_empty_string_panic() {
        GameId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "GameIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        GameId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_equality() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let game_id1 = GameId::new(uuid.to_string());
        let game_id2 = GameId::new(uuid.to_string());
        assert_eq!(game_id1, game_id2);
    }
}
