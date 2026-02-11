#[cfg(test)]
mod tests {
    use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;

    use super::super::having_trigger_ids::HavingTriggerIds;

    #[test]
    fn test_empty_list() {
        let ids = HavingTriggerIds::new(vec![]);
        assert!(ids.is_empty());
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn test_single_trigger() {
        let ids = HavingTriggerIds::new(vec![TriggerId::new("scorpion".to_string())]);
        assert!(!ids.is_empty());
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.value()[0], TriggerId::new("scorpion".to_string()));
    }

    #[test]
    fn test_multiple_triggers() {
        let ids = HavingTriggerIds::new(vec![
            TriggerId::new("scorpion".to_string()),
            TriggerId::new("raygust".to_string()),
            TriggerId::new("kogetsu".to_string()),
        ]);
        assert_eq!(ids.len(), 3);
    }

    #[test]
    fn test_equality() {
        let ids1 = HavingTriggerIds::new(vec![TriggerId::new("scorpion".to_string())]);
        let ids2 = HavingTriggerIds::new(vec![TriggerId::new("scorpion".to_string())]);
        assert_eq!(ids1, ids2);
    }
}
