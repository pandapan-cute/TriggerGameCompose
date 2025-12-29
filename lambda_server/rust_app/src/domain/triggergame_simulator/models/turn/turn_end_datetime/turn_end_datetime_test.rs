#[cfg(test)]
mod tests {
    use super::super::turn_end_datetime::TurnEndDatetime;
    use chrono::Utc;

    #[test]
    fn test_new() {
        let now = Utc::now();
        let datetime = TurnEndDatetime::new(now);
        assert_eq!(datetime.value(), &now);
    }

    #[test]
    fn test_equality() {
        let now = Utc::now();
        let datetime1 = TurnEndDatetime::new(now);
        let datetime2 = TurnEndDatetime::new(now);
        assert_eq!(datetime1, datetime2);
    }
}
