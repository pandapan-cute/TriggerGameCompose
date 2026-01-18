#[cfg(test)]
mod tests {
    use super::super::current_turn_number::CurrentTurnNumber;

    #[test]
    fn test_initial() {
        let turn_number = CurrentTurnNumber::initial();
        assert_eq!(turn_number.value(), 1);
    }

    #[test]
    fn test_valid_number() {
        let turn_number = CurrentTurnNumber::new(3);
        assert_eq!(turn_number.value(), 3);
    }

    #[test]
    #[should_panic(expected = "CurrentTurnNumberは1以上である必要があります")]
    fn test_invalid_number() {
        CurrentTurnNumber::new(0);
    }
}
