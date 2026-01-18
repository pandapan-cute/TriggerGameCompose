use crate::domain::player_management::models::player::Player;
use async_trait::async_trait;

/// Playerリポジトリのトレイト
#[async_trait]
pub trait PlayerRepository: Send + Sync {
    /// プレイヤー情報を保存
    async fn save(&self, player: &Player) -> Result<(), String>;
}
