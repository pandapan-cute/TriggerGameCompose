#[cfg(test)]
mod tests {
    use super::super::turn_start_datetime::TurnStartDatetime;
    use chrono::Utc;

    #[test]
    fn test_new() {
        let now = Utc::now();
        let datetime = TurnStartDatetime::new(now);
        assert_eq!(datetime.value(), &now);
    }

    #[test]
    fn test_equality() {
        let now = Utc::now();
        let datetime1 = TurnStartDatetime::new(now);
        let datetime2 = TurnStartDatetime::new(now);
        assert_eq!(datetime1, datetime2);
    }
}
