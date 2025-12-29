#[cfg(test)]
mod tests {
    use super::super::having_sub_trigger_ids::HavingSubTriggerIds;

    #[test]
    fn test_empty_list() {
        let ids = HavingSubTriggerIds::new(vec![]);
        assert!(ids.is_empty());
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn test_single_trigger() {
        let ids = HavingSubTriggerIds::new(vec!["shield".to_string()]);
        assert!(!ids.is_empty());
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.value()[0], "shield");
    }

    #[test]
    fn test_multiple_triggers() {
        let ids = HavingSubTriggerIds::new(vec![
            "shield".to_string(),
            "bagworm".to_string(),
        ]);
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn test_equality() {
        let ids1 = HavingSubTriggerIds::new(vec!["shield".to_string()]);
        let ids2 = HavingSubTriggerIds::new(vec!["shield".to_string()]);
        assert_eq!(ids1, ids2);
    }
}
