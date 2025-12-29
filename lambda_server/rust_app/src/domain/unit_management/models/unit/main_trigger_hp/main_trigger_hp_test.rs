#[cfg(test)]
mod tests {
    use super::super::main_trigger_hp::MainTriggerHP;

    #[test]
    fn test_valid_value() {
        let hp = MainTriggerHP::new(100);
        assert_eq!(hp.value(), 100);
    }

    #[test]
    fn test_zero_value() {
        let hp = MainTriggerHP::new(0);
        assert_eq!(hp.value(), 0);
    }

    #[test]
    #[should_panic(expected = "MainTriggerHPは0以上である必要があります")]
    fn test_negative_value_panic() {
        MainTriggerHP::new(-1);
    }

    #[test]
    fn test_equality() {
        let hp1 = MainTriggerHP::new(75);
        let hp2 = MainTriggerHP::new(75);
        assert_eq!(hp1, hp2);
    }
}
