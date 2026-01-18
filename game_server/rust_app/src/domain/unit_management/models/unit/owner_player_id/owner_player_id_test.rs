#[cfg(test)]
mod tests {
    use super::super::owner_player_id::OwnerPlayerId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let owner_id = OwnerPlayerId::new(uuid.to_string());
        assert_eq!(owner_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "OwnerPlayerIdが空文字です")]
    fn test_empty_string_panic() {
        OwnerPlayerId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "OwnerPlayerIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        OwnerPlayerId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_equality() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let owner_id1 = OwnerPlayerId::new(uuid.to_string());
        let owner_id2 = OwnerPlayerId::new(uuid.to_string());
        assert_eq!(owner_id1, owner_id2);
    }
}
