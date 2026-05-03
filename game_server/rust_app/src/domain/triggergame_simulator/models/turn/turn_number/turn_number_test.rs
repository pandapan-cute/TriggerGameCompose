#[cfg(test)]
mod tests {
    use super::super::turn_number::TurnNumber;

    #[test]
    fn test_min_value() {
        let turn_number = TurnNumber::new(1);
        assert_eq!(turn_number.value(), 1);
    }

    #[test]
    fn test_max_value() {
        let turn_number = TurnNumber::new(6);
        assert_eq!(turn_number.value(), 6);
    }

    #[test]
    fn test_middle_value() {
        let turn_number = TurnNumber::new(3);
        assert_eq!(turn_number.value(), 3);
    }

    #[test]
    #[should_panic(expected = "TurnNumberは1以上である必要があります")]
    fn test_below_min() {
        TurnNumber::new(0);
    }

    #[test]
    #[should_panic(expected = "TurnNumberは6以下である必要があります")]
    fn test_above_max() {
        TurnNumber::new(7);
    }
}
