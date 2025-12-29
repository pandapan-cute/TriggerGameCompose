#[cfg(test)]
mod tests {
    use super::super::matching_end_datetime::MatchingEndDatetime;
    use chrono::Utc;

    #[test]
    fn test_new_with_some_value() {
        let now = Utc::now();
        let datetime = MatchingEndDatetime::new(Some(now));
        assert_eq!(datetime.value(), &Some(now));
    }

    #[test]
    fn test_new_with_none_value() {
        let datetime = MatchingEndDatetime::new(None);
        assert_eq!(datetime.value(), &None);
    }

    #[test]
    fn test_equality() {
        let now = Utc::now();
        let datetime1 = MatchingEndDatetime::new(Some(now));
        let datetime2 = MatchingEndDatetime::new(Some(now));
        assert_eq!(datetime1, datetime2);
    }

    #[test]
    fn test_none_equality() {
        let datetime1 = MatchingEndDatetime::new(None);
        let datetime2 = MatchingEndDatetime::new(None);
        assert_eq!(datetime1, datetime2);
    }
}
