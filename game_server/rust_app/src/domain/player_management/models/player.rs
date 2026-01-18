pub mod mfa_authentication;
pub mod player_id;
pub mod player_name;
pub mod registered_datetime;

use chrono::Utc;
use mfa_authentication::mfa_authentication::MFAAuthentication;
use player_id::player_id::PlayerId;
use player_name::player_name::PlayerName;
use registered_datetime::registered_datetime::RegisteredDatetime;
use uuid::Uuid;

/// Player集約ルートエンティティ
///
/// プレイヤーの基本情報を管理する集約ルート。
/// ビジネスルール:
/// - プレイヤーIDは一意でなければならない
/// - プレイヤー名は変更可能
/// - MFA認証の有効化/無効化が可能
/// - 登録日時は変更不可
#[derive(Debug, Clone)]
pub struct Player {
    player_id: PlayerId,
    player_name: PlayerName,
    registered_datetime: RegisteredDatetime,
    mfa_authentication: MFAAuthentication,
}

impl Player {
    /// プライベートコンストラクタ
    /// create/reconstructメソッドのみでインスタンス化を強制
    pub fn new(
        player_id: PlayerId,
        player_name: PlayerName,
        registered_datetime: RegisteredDatetime,
        mfa_authentication: MFAAuthentication,
    ) -> Self {
        Self {
            player_id,
            player_name,
            registered_datetime,
            mfa_authentication,
        }
    }

    /// 新規Playerエンティティの生成
    ///
    /// # Arguments
    /// * `player_name` - プレイヤー名
    ///
    /// # Returns
    /// 新規作成されたPlayerインスタンス
    ///
    /// # Business Rules
    /// - PlayerIdは自動採番（UUID）
    /// - 登録日時は現在時刻
    /// - MFA認証はデフォルトで無効
    pub fn create(player_name: PlayerName) -> Self {
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let registered_datetime = RegisteredDatetime::new(Utc::now());
        let mfa_authentication = MFAAuthentication::new(false);

        Self::new(
            player_id,
            player_name,
            registered_datetime,
            mfa_authentication,
        )
    }

    /// Playerエンティティの再構築
    ///
    /// リポジトリから取得したデータをもとにエンティティを再構築する際に使用
    ///
    /// # Arguments
    /// * `player_id` - プレイヤーID
    /// * `player_name` - プレイヤー名
    /// * `registered_datetime` - 登録日時
    /// * `mfa_authentication` - MFA認証設定
    pub fn reconstruct(
        player_id: PlayerId,
        player_name: PlayerName,
        registered_datetime: RegisteredDatetime,
        mfa_authentication: MFAAuthentication,
    ) -> Self {
        Self::new(
            player_id,
            player_name,
            registered_datetime,
            mfa_authentication,
        )
    }

    /// プレイヤー名を変更
    ///
    /// # Arguments
    /// * `new_name` - 新しいプレイヤー名
    pub fn change_name(&mut self, new_name: PlayerName) {
        self.player_name = new_name;
    }

    /// MFA認証を有効化
    pub fn enable_mfa(&mut self) {
        self.mfa_authentication = MFAAuthentication::new(true);
    }

    /// MFA認証を無効化
    pub fn disable_mfa(&mut self) {
        self.mfa_authentication = MFAAuthentication::new(false);
    }

    /// MFA認証が有効かどうかを確認
    pub fn is_mfa_enabled(&self) -> bool {
        self.mfa_authentication.is_enabled()
    }

    // ゲッター

    pub fn player_id(&self) -> &PlayerId {
        &self.player_id
    }

    pub fn player_name(&self) -> &PlayerName {
        &self.player_name
    }

    pub fn registered_datetime(&self) -> &RegisteredDatetime {
        &self.registered_datetime
    }

    pub fn mfa_authentication(&self) -> &MFAAuthentication {
        &self.mfa_authentication
    }
}

// 等価性の比較を実装（同一性はPlayerIdで判定）
impl PartialEq for Player {
    fn eq(&self, other: &Self) -> bool {
        self.player_id == other.player_id
    }
}

impl Eq for Player {}
