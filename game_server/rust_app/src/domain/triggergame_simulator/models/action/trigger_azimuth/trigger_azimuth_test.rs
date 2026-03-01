#[cfg(test)]
mod tests {
    use super::super::trigger_azimuth::TriggerAzimuth;

    #[test]
    fn test_min_value() {
        let trigger_azimuth = TriggerAzimuth::new(-1);
        assert_eq!(trigger_azimuth.value(), -1);
    }

    #[test]
    fn test_max_value() {
        let trigger_azimuth = TriggerAzimuth::new(360);
        assert_eq!(trigger_azimuth.value(), 360);
    }

    #[test]
    fn test_middle_value() {
        let trigger_azimuth = TriggerAzimuth::new(180);
        assert_eq!(trigger_azimuth.value(), 180);
    }

    #[test]
    #[should_panic(expected = "TriggerAzimuthは-1以上である必要があります")]
    fn test_below_min() {
        TriggerAzimuth::new(-2);
    }

    #[test]
    #[should_panic(expected = "TriggerAzimuthは360以下である必要があります")]
    fn test_above_max() {
        TriggerAzimuth::new(361);
    }
}
