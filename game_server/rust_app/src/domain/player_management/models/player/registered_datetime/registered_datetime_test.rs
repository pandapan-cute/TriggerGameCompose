#[cfg(test)]
mod tests {
    use super::super::registered_datetime::RegisteredDatetime;
    use chrono::Utc;

    #[test]
    fn test_new() {
        let now = Utc::now();
        let datetime = RegisteredDatetime::new(now);
        assert_eq!(datetime.value(), &now);
    }

    #[test]
    fn test_equality() {
        let now = Utc::now();
        let datetime1 = RegisteredDatetime::new(now);
        let datetime2 = RegisteredDatetime::new(now);
        assert_eq!(datetime1, datetime2);
    }

    #[test]
    fn test_clone() {
        let now = Utc::now();
        let datetime1 = RegisteredDatetime::new(now);
        let datetime2 = datetime1.clone();
        assert_eq!(datetime1, datetime2);
    }
}
