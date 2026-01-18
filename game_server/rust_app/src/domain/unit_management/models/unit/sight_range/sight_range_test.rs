#[cfg(test)]
mod tests {
    use super::super::sight_range::SightRange;

    #[test]
    fn test_valid_value() {
        let range = SightRange::new(10);
        assert_eq!(range.value(), 10);
    }

    #[test]
    fn test_min_value() {
        let range = SightRange::new(1);
        assert_eq!(range.value(), 1);
    }

    #[test]
    #[should_panic(expected = "SightRangeは1以上である必要があります")]
    fn test_zero_value_panic() {
        SightRange::new(0);
    }

    #[test]
    #[should_panic(expected = "SightRangeは1以上である必要があります")]
    fn test_negative_value_panic() {
        SightRange::new(-1);
    }

    #[test]
    fn test_equality() {
        let range1 = SightRange::new(5);
        let range2 = SightRange::new(5);
        assert_eq!(range1, range2);
    }
}
