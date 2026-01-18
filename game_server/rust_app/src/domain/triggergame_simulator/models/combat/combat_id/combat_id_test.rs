#[cfg(test)]
mod tests {
    use super::super::combat_id::CombatId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let combat_id = CombatId::new(uuid.to_string());
        assert_eq!(combat_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "CombatIdが空文字です")]
    fn test_empty_string_panic() {
        CombatId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "CombatIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        CombatId::new("invalid-uuid".to_string());
    }
}
