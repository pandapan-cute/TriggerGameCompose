#[cfg(test)]
mod tests {
    use super::super::unit_id::UnitId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let unit_id = UnitId::new(uuid.to_string());
        assert_eq!(unit_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "UnitIdが空文字です")]
    fn test_empty_string_panic() {
        UnitId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "UnitIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        UnitId::new("invalid-uuid".to_string());
    }

    #[test]
    fn test_equality() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let unit_id1 = UnitId::new(uuid.to_string());
        let unit_id2 = UnitId::new(uuid.to_string());
        assert_eq!(unit_id1, unit_id2);
    }

    #[test]
    fn test_clone() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let unit_id1 = UnitId::new(uuid.to_string());
        let unit_id2 = unit_id1.clone();
        assert_eq!(unit_id1, unit_id2);
    }
}
