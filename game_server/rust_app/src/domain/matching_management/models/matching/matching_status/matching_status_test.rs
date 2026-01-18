#[cfg(test)]
mod tests {
    use super::super::matching_status::{MatchingStatus, MatchingStatusValue};

    #[test]
    fn test_new_in_progress() {
        let status = MatchingStatus::new(MatchingStatusValue::InProgress);
        assert_eq!(status.value(), &MatchingStatusValue::InProgress);
        assert!(status.is_in_progress());
        assert!(!status.is_interrupted());
        assert!(!status.is_completed());
        assert!(!status.is_finished());
    }

    #[test]
    fn test_new_interrupted() {
        let status = MatchingStatus::new(MatchingStatusValue::Interrupted);
        assert_eq!(status.value(), &MatchingStatusValue::Interrupted);
        assert!(!status.is_in_progress());
        assert!(status.is_interrupted());
        assert!(!status.is_completed());
        assert!(status.is_finished());
    }

    #[test]
    fn test_new_completed() {
        let status = MatchingStatus::new(MatchingStatusValue::Completed);
        assert_eq!(status.value(), &MatchingStatusValue::Completed);
        assert!(!status.is_in_progress());
        assert!(!status.is_interrupted());
        assert!(status.is_completed());
        assert!(status.is_finished());
    }

    #[test]
    fn test_equality() {
        let status1 = MatchingStatus::new(MatchingStatusValue::InProgress);
        let status2 = MatchingStatus::new(MatchingStatusValue::InProgress);
        let status3 = MatchingStatus::new(MatchingStatusValue::Completed);
        
        assert_eq!(status1, status2);
        assert_ne!(status1, status3);
    }
}
