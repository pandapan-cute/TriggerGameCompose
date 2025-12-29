#[cfg(test)]
mod tests {
    use super::super::mfa_authentication::MFAAuthentication;

    #[test]
    fn test_new_enabled() {
        let mfa = MFAAuthentication::new(true);
        assert_eq!(mfa.value(), true);
        assert!(mfa.is_enabled());
        assert!(!mfa.is_disabled());
    }

    #[test]
    fn test_new_disabled() {
        let mfa = MFAAuthentication::new(false);
        assert_eq!(mfa.value(), false);
        assert!(!mfa.is_enabled());
        assert!(mfa.is_disabled());
    }

    #[test]
    fn test_equality() {
        let mfa1 = MFAAuthentication::new(true);
        let mfa2 = MFAAuthentication::new(true);
        let mfa3 = MFAAuthentication::new(false);
        
        assert_eq!(mfa1, mfa2);
        assert_ne!(mfa1, mfa3);
    }

    #[test]
    fn test_clone() {
        let mfa1 = MFAAuthentication::new(true);
        let mfa2 = mfa1.clone();
        assert_eq!(mfa1, mfa2);
    }
}
