use async_trait::async_trait;

/// Connectionリポジトリのトレイト
#[async_trait]
pub trait ConnectionRepository: Send + Sync {
    /// コネクション情報を保存
    async fn save(&self, player_id: &str, connection_id: &str) -> Result<(), String>;

    /// コネクション情報を取得
    async fn get_connection_id(&self, player_id: &str) -> Result<String, String>;

    /// connection_id から player_id を逆引きする
    async fn get_player_id_by_connection_id(
        &self,
        connection_id: &str,
    ) -> Result<Option<String>, String>;

    /// connection_id に紐づくコネクション情報を削除する
    async fn delete_by_connection_id(&self, connection_id: &str) -> Result<(), String>;
}
