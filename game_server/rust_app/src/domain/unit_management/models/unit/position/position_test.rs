#[cfg(test)]
mod tests {
    use super::super::position::Position;

    #[test]
    fn test_valid_position() {
        let pos = Position::new(5, 10);
        assert_eq!(pos.x(), 5);
        assert_eq!(pos.y(), 10);
    }

    #[test]
    fn test_zero_position() {
        let pos = Position::new(0, 0);
        assert_eq!(pos.x(), 0);
        assert_eq!(pos.y(), 0);
    }

    #[test]
    #[should_panic(expected = "Position xは0以上である必要があります")]
    fn test_negative_x_panic() {
        Position::new(-1, 5);
    }

    #[test]
    #[should_panic(expected = "Position yは0以上である必要があります")]
    fn test_negative_y_panic() {
        Position::new(5, -1);
    }

    #[test]
    fn test_equality() {
        let pos1 = Position::new(3, 7);
        let pos2 = Position::new(3, 7);
        assert_eq!(pos1, pos2);
    }

    #[test]
    fn test_inequality() {
        let pos1 = Position::new(3, 7);
        let pos2 = Position::new(3, 8);
        assert_ne!(pos1, pos2);
    }
}
