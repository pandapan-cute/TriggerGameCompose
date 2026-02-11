#[cfg(test)]
mod tests {
    use super::super::position::Position;

    #[test]
    fn test_valid_position() {
        let pos = Position::new(5, 10);
        assert_eq!(pos.col(), 5);
        assert_eq!(pos.row(), 10);
    }

    #[test]
    fn test_zero_position() {
        let pos = Position::new(0, 0);
        assert_eq!(pos.col(), 0);
        assert_eq!(pos.row(), 0);
    }

    #[test]
    #[should_panic(expected = "Position colは0以上である必要があります")]
    fn test_negative_col_panic() {
        Position::new(-1, 5);
    }

    #[test]
    #[should_panic(expected = "Position rowは0以上である必要があります")]
    fn test_negative_row_panic() {
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
