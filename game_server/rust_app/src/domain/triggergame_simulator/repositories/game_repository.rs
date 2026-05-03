use crate::domain::{
    matching_management::models::matching::Matching,
    triggergame_simulator::models::game::{game::Game, game_id::game_id::GameId},
};
use async_trait::async_trait;

/// Gameリポジトリのトレイト
#[async_trait]
pub trait GameRepository: Send + Sync {
    /// ゲーム情報を保存
    async fn save(&self, game: &Game) -> Result<(), String>;

    /// ゲーム情報を更新
    async fn update(&self, game: &Game) -> Result<(), String>;

    /// 指定したゲームIDの情報を取得
    async fn get_game_by_id(&self, game_id: &GameId) -> Result<Game, String>;
}
