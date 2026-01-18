#[cfg(test)]
mod tests {
    use super::super::defending_unit_id::DefendingUnitId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let defending_unit_id = DefendingUnitId::new(uuid.to_string());
        assert_eq!(defending_unit_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "DefendingUnitIdが空文字です")]
    fn test_empty_string_panic() {
        DefendingUnitId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "DefendingUnitIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        DefendingUnitId::new("invalid-uuid".to_string());
    }
}
