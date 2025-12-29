#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::super::matching_start_datetime::MatchingStartDatetime;

    #[test]
    fn test_equality() {
        let datetime = Utc::now();
        let matching_start_datetime1 = MatchingStartDatetime::new(datetime);
        let matching_start_datetime2 = MatchingStartDatetime::new(datetime);
        let matching_start_datetime3 = MatchingStartDatetime::new(Utc::now());

        assert_eq!(matching_start_datetime1, matching_start_datetime2);
        assert_ne!(matching_start_datetime1, matching_start_datetime3);
    }

    #[test]
    fn test_clone() {
        let matching_start_datetime1 = MatchingStartDatetime::new(Utc::now());
        let matching_start_datetime2 = matching_start_datetime1.clone();
        assert_eq!(matching_start_datetime1, matching_start_datetime2);
    }
}