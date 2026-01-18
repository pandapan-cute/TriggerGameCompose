#[cfg(test)]
mod tests {
    use super::super::having_main_trigger_ids::HavingMainTriggerIds;

    #[test]
    fn test_empty_list() {
        let ids = HavingMainTriggerIds::new(vec![]);
        assert!(ids.is_empty());
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn test_single_trigger() {
        let ids = HavingMainTriggerIds::new(vec!["scorpion".to_string()]);
        assert!(!ids.is_empty());
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.value()[0], "scorpion");
    }

    #[test]
    fn test_multiple_triggers() {
        let ids = HavingMainTriggerIds::new(vec![
            "scorpion".to_string(),
            "raygust".to_string(),
            "kogetsu".to_string(),
        ]);
        assert_eq!(ids.len(), 3);
    }

    #[test]
    fn test_equality() {
        let ids1 = HavingMainTriggerIds::new(vec!["scorpion".to_string()]);
        let ids2 = HavingMainTriggerIds::new(vec!["scorpion".to_string()]);
        assert_eq!(ids1, ids2);
    }
}
