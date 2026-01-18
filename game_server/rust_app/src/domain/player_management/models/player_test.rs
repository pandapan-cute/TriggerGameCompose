#[cfg(test)]
mod player_tests {
    use crate::domain::player_management::models::player::{
        Player,
        player_id::player_id::PlayerId,
        player_name::player_name::PlayerName,
        registered_datetime::registered_datetime::RegisteredDatetime,
        mfa_authentication::mfa_authentication::MFAAuthentication,
    };
    use chrono::Utc;
    use uuid::Uuid;

    /// テスト用のPlayerインスタンスを生成
    fn create_test_player() -> Player {
        let player_name = PlayerName::new("テストプレイヤー".to_string());
        Player::create(player_name)
    }

    #[test]
    fn test_create_player_with_default_values() {
        let player_name = PlayerName::new("新規プレイヤー".to_string());
        let player = Player::create(player_name.clone());

        assert_eq!(player.player_name().value(), "新規プレイヤー");
        assert!(!player.is_mfa_enabled()); // デフォルトはMFA無効
        
        // PlayerIdがUUID形式であることを確認
        assert!(Uuid::parse_str(player.player_id().value()).is_ok());
    }

    #[test]
    fn test_change_player_name() {
        let mut player = create_test_player();
        
        let original_name = player.player_name().value().to_string();
        assert_eq!(original_name, "テストプレイヤー");

        let new_name = PlayerName::new("変更後の名前".to_string());
        player.change_name(new_name);

        assert_eq!(player.player_name().value(), "変更後の名前");
    }

    #[test]
    fn test_enable_mfa_authentication() {
        let mut player = create_test_player();
        
        assert!(!player.is_mfa_enabled());

        player.enable_mfa();

        assert!(player.is_mfa_enabled());
        assert!(player.mfa_authentication().is_enabled());
        assert!(!player.mfa_authentication().is_disabled());
    }

    #[test]
    fn test_disable_mfa_authentication() {
        let mut player = create_test_player();
        
        // まずMFAを有効化
        player.enable_mfa();
        assert!(player.is_mfa_enabled());

        // その後無効化
        player.disable_mfa();

        assert!(!player.is_mfa_enabled());
        assert!(!player.mfa_authentication().is_enabled());
        assert!(player.mfa_authentication().is_disabled());
    }

    #[test]
    fn test_toggle_mfa_authentication() {
        let mut player = create_test_player();
        
        // 初期状態: 無効
        assert!(!player.is_mfa_enabled());

        // 有効化
        player.enable_mfa();
        assert!(player.is_mfa_enabled());

        // 無効化
        player.disable_mfa();
        assert!(!player.is_mfa_enabled());

        // 再度有効化
        player.enable_mfa();
        assert!(player.is_mfa_enabled());
    }

    #[test]
    fn test_reconstruct_player() {
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let player_name = PlayerName::new("再構築プレイヤー".to_string());
        let registered_datetime = RegisteredDatetime::new(Utc::now());
        let mfa_authentication = MFAAuthentication::new(true);

        let player = Player::reconstruct(
            player_id.clone(),
            player_name,
            registered_datetime,
            mfa_authentication,
        );

        assert_eq!(player.player_id().value(), player_id.value());
        assert_eq!(player.player_name().value(), "再構築プレイヤー");
        assert!(player.is_mfa_enabled());
    }

    #[test]
    fn test_player_equality_by_id() {
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let player_name1 = PlayerName::new("プレイヤー1".to_string());
        let player_name2 = PlayerName::new("プレイヤー2".to_string());
        let registered_datetime = RegisteredDatetime::new(Utc::now());
        let mfa_authentication = MFAAuthentication::new(false);

        let player1 = Player::reconstruct(
            player_id.clone(),
            player_name1,
            registered_datetime.clone(),
            mfa_authentication.clone(),
        );

        let player2 = Player::reconstruct(
            player_id.clone(),
            player_name2,
            registered_datetime,
            mfa_authentication,
        );

        // 同じPlayerIdを持つため、等価とみなされる
        assert_eq!(player1, player2);
    }

    #[test]
    fn test_player_inequality_by_different_id() {
        let player_id1 = PlayerId::new(Uuid::new_v4().to_string());
        let player_id2 = PlayerId::new(Uuid::new_v4().to_string());
        let player_name = PlayerName::new("プレイヤー".to_string());
        let registered_datetime = RegisteredDatetime::new(Utc::now());
        let mfa_authentication = MFAAuthentication::new(false);

        let player1 = Player::reconstruct(
            player_id1,
            player_name.clone(),
            registered_datetime.clone(),
            mfa_authentication.clone(),
        );

        let player2 = Player::reconstruct(
            player_id2,
            player_name,
            registered_datetime,
            mfa_authentication,
        );

        // 異なるPlayerIdを持つため、等価ではない
        assert_ne!(player1, player2);
    }

    #[test]
    fn test_registered_datetime_immutability() {
        let player = create_test_player();
        
        let initial_datetime = player.registered_datetime().value();
        
        // 名前変更やMFA変更を行っても、登録日時は変わらない
        let mut mutable_player = player.clone();
        mutable_player.change_name(PlayerName::new("新しい名前".to_string()));
        mutable_player.enable_mfa();

        assert_eq!(
            mutable_player.registered_datetime().value(),
            initial_datetime
        );
    }

    #[test]
    fn test_player_id_immutability() {
        let player = create_test_player();
        
        let initial_id = player.player_id().value().to_string();
        
        // 名前変更やMFA変更を行っても、PlayerIdは変わらない
        let mut mutable_player = player.clone();
        mutable_player.change_name(PlayerName::new("新しい名前".to_string()));
        mutable_player.enable_mfa();

        assert_eq!(mutable_player.player_id().value(), initial_id);
    }

    #[test]
    fn test_multiple_name_changes() {
        let mut player = create_test_player();
        
        let names = vec![
            "名前1",
            "名前2",
            "名前3",
            "最終的な名前",
        ];

        for name in names.iter() {
            player.change_name(PlayerName::new(name.to_string()));
            assert_eq!(player.player_name().value(), *name);
        }
    }

    #[test]
    #[should_panic(expected = "PlayerNameは1文字以上である必要があります")]
    fn test_create_player_with_empty_name() {
        let _player_name = PlayerName::new("".to_string());
    }

    #[test]
    #[should_panic(expected = "PlayerNameは20文字以下である必要があります")]
    fn test_create_player_with_too_long_name() {
        let long_name = "あ".repeat(21);
        let _player_name = PlayerName::new(long_name);
    }
}
