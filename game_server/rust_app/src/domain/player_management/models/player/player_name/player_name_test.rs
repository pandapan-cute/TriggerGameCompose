#[cfg(test)]
mod tests {
    use super::super::player_name::PlayerName;

    #[test]
    fn test_valid_name_min_length() {
        let name = PlayerName::new("A".to_string());
        assert_eq!(name.value(), "A");
    }

    #[test]
    fn test_valid_name_max_length() {
        let name = PlayerName::new("12345678901234567890".to_string());
        assert_eq!(name.value(), "12345678901234567890");
    }

    #[test]
    fn test_valid_name_middle_length() {
        let name = PlayerName::new("TestPlayer".to_string());
        assert_eq!(name.value(), "TestPlayer");
    }

    #[test]
    #[should_panic(expected = "PlayerNameは1文字以上である必要があります")]
    fn test_empty_string_panic() {
        PlayerName::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "PlayerNameは20文字以下である必要があります")]
    fn test_too_long_name_panic() {
        PlayerName::new("123456789012345678901".to_string());
    }

    #[test]
    fn test_equality() {
        let name1 = PlayerName::new("TestPlayer".to_string());
        let name2 = PlayerName::new("TestPlayer".to_string());
        assert_eq!(name1, name2);
    }

    #[test]
    fn test_clone() {
        let name1 = PlayerName::new("TestPlayer".to_string());
        let name2 = name1.clone();
        assert_eq!(name1, name2);
    }

    #[test]
    fn test_japanese_characters() {
        let name = PlayerName::new("テストプレイヤー".to_string());
        assert_eq!(name.value(), "テストプレイヤー");
    }

    #[test]
    #[should_panic(expected = "PlayerNameは20文字以下である必要があります")]
    fn test_japanese_characters_too_long() {
        PlayerName::new("あいうえおかきくけこさしすせそたちつてとな".to_string());
    }
}
