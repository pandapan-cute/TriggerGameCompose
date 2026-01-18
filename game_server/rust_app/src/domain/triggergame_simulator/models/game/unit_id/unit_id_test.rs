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
    #[should_panic(expected = "UnitIdに空文字が含まれています")]
    fn test_empty_string_in_list() {
        UnitId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "UnitIdがUUID形式ではありません")]
    fn test_invalid_uuid_in_list() {
        UnitId::new("invalid-uuid".to_string());
    }
}
