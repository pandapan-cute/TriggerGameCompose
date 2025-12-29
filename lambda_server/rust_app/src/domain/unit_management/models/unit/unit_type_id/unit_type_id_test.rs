#[cfg(test)]
mod tests {
    use super::super::unit_type_id::UnitTypeId;

    #[test]
    fn test_valid_type_id() {
        let type_id = UnitTypeId::new("attacker".to_string());
        assert_eq!(type_id.value(), "attacker");
    }

    #[test]
    #[should_panic(expected = "UnitTypeIdが空文字です")]
    fn test_empty_string_panic() {
        UnitTypeId::new("".to_string());
    }

    #[test]
    fn test_equality() {
        let type_id1 = UnitTypeId::new("shooter".to_string());
        let type_id2 = UnitTypeId::new("shooter".to_string());
        assert_eq!(type_id1, type_id2);
    }
}
