#[cfg(test)]
mod tests {
    use super::super::is_avoided::IsAvoided;

    #[test]
    fn test_avoided() {
        let is_avoided = IsAvoided::new(true);
        assert_eq!(is_avoided.value(), true);
        assert!(is_avoided.is_avoided());
        assert!(!is_avoided.is_hit());
    }

    #[test]
    fn test_hit() {
        let is_avoided = IsAvoided::new(false);
        assert_eq!(is_avoided.value(), false);
        assert!(!is_avoided.is_avoided());
        assert!(is_avoided.is_hit());
    }

    #[test]
    fn test_equality() {
        let is_avoided1 = IsAvoided::new(true);
        let is_avoided2 = IsAvoided::new(true);
        assert_eq!(is_avoided1, is_avoided2);
    }
}
