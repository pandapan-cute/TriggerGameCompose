#[cfg(test)]
mod tests {
    use super::super::unit_ids::UnitIds;

    #[test]
    fn test_valid_unit_ids() {
        let ids = vec![
            "123e4567-e89b-12d3-a456-426614174000".to_string(),
            "223e4567-e89b-12d3-a456-426614174001".to_string(),
        ];
        let unit_ids = UnitIds::new(ids.clone());
        assert_eq!(unit_ids.value(), &ids);
    }

    #[test]
    fn test_empty_list() {
        let unit_ids = UnitIds::new(vec![]);
        assert_eq!(unit_ids.value().len(), 0);
    }

    #[test]
    #[should_panic(expected = "UnitIdsに空文字が含まれています")]
    fn test_empty_string_in_list() {
        UnitIds::new(vec!["".to_string()]);
    }

    #[test]
    #[should_panic(expected = "UnitIdsがUUID形式ではありません")]
    fn test_invalid_uuid_in_list() {
        UnitIds::new(vec!["invalid-uuid".to_string()]);
    }
}
