#[cfg(test)]
mod tests {
    use super::super::sub_trigger_hp::SubTriggerHP;

    #[test]
    fn test_valid_value() {
        let hp = SubTriggerHP::new(50);
        assert_eq!(hp.value(), 50);
    }

    #[test]
    fn test_zero_value() {
        let hp = SubTriggerHP::new(0);
        assert_eq!(hp.value(), 0);
    }

    #[test]
    #[should_panic(expected = "SubTriggerHPは0以上である必要があります")]
    fn test_negative_value_panic() {
        SubTriggerHP::new(-1);
    }

    #[test]
    fn test_equality() {
        let hp1 = SubTriggerHP::new(25);
        let hp2 = SubTriggerHP::new(25);
        assert_eq!(hp1, hp2);
    }
}
