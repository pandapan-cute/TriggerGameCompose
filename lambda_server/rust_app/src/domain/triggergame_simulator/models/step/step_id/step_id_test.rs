#[cfg(test)]
mod tests {
    use super::super::step_id::StepId;

    #[test]
    fn test_valid_uuid() {
        let uuid = "123e4567-e89b-12d3-a456-426614174000";
        let step_id = StepId::new(uuid.to_string());
        assert_eq!(step_id.value(), uuid);
    }

    #[test]
    #[should_panic(expected = "StepIdが空文字です")]
    fn test_empty_string_panic() {
        StepId::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "StepIdがUUID形式ではありません")]
    fn test_invalid_uuid_format_panic() {
        StepId::new("invalid-uuid".to_string());
    }
}
