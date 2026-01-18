#[cfg(test)]
mod tests {
    use super::super::is_bailout::IsBailout;

    #[test]
    fn test_bailout_true() {
        let bailout = IsBailout::new(true);
        assert_eq!(bailout.value(), true);
        assert!(bailout.is_bailout());
        assert!(!bailout.is_active());
    }

    #[test]
    fn test_bailout_false() {
        let bailout = IsBailout::new(false);
        assert_eq!(bailout.value(), false);
        assert!(!bailout.is_bailout());
        assert!(bailout.is_active());
    }

    #[test]
    fn test_equality() {
        let bailout1 = IsBailout::new(true);
        let bailout2 = IsBailout::new(true);
        let bailout3 = IsBailout::new(false);
        
        assert_eq!(bailout1, bailout2);
        assert_ne!(bailout1, bailout3);
    }
}
