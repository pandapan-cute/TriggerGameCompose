#[cfg(test)]
mod tests {
    use super::super::current_action_points::CurrentActionPoints;

    #[test]
    fn test_valid_value() {
        let points = CurrentActionPoints::new(10);
        assert_eq!(points.value(), 10);
    }

    #[test]
    fn test_zero_value() {
        let points = CurrentActionPoints::new(0);
        assert_eq!(points.value(), 0);
    }

    #[test]
    #[should_panic(expected = "CurrentActionPointsは0以上である必要があります")]
    fn test_negative_value_panic() {
        CurrentActionPoints::new(-1);
    }

    #[test]
    fn test_equality() {
        let points1 = CurrentActionPoints::new(5);
        let points2 = CurrentActionPoints::new(5);
        assert_eq!(points1, points2);
    }
}
