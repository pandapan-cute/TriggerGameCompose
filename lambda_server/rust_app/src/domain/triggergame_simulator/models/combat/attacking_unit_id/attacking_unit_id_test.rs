#[cfg(test)]
mod tests {
    use super::super::attacking_unit_id::AttackingUnitId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let attacking_unit_id = AttackingUnitId::new(uuid.to_string());
        assert_eq!(attacking_unit_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "AttackingUnitIdが空文字です")]
    fn test_empty_string_panic() {
        AttackingUnitId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "AttackingUnitIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        AttackingUnitId::new("invalid-uuid".to_string());
    }
}
