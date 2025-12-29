#[cfg(test)]
mod tests {
    use super::super::wait_time::WaitTime;

    #[test]
    fn test_valid_value() {
        let wait_time = WaitTime::new(100);
        assert_eq!(wait_time.value(), 100);
    }

    #[test]
    fn test_zero_value() {
        let wait_time = WaitTime::new(0);
        assert_eq!(wait_time.value(), 0);
    }

    #[test]
    #[should_panic(expected = "WaitTimeは0以上である必要があります")]
    fn test_negative_value_panic() {
        WaitTime::new(-1);
    }

    #[test]
    fn test_equality() {
        let wait_time1 = WaitTime::new(50);
        let wait_time2 = WaitTime::new(50);
        assert_eq!(wait_time1, wait_time2);
    }
}
