use async_trait::async_trait;

/// Connectionリポジトリのトレイト
#[async_trait]
pub trait ConnectionRepository: Send + Sync {
    /// コネクション情報を保存
    async fn save(&self, player_id: &str, connection_id: &str) -> Result<(), String>;

    /// コネクション情報を取得
    async fn get_connection_id(&self, player_id: &str) -> Result<String, String>;
}
