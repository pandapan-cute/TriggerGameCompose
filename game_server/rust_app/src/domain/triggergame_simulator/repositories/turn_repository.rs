use async_trait::async_trait;

use crate::domain::{
    player_management::models::player::player_id::player_id::PlayerId,
    triggergame_simulator::models::{
        game::game_id::{self, game_id::GameId},
        turn::{turn_number::turn_number::TurnNumber, Turn},
    },
};

/// Turnリポジトリのトレイト
#[async_trait]
pub trait TurnRepository: Send + Sync {
    /// ゲーム情報を保存
    async fn save(&self, turn: &Turn) -> Result<(), String>;

    /// ゲーム情報を更新
    async fn update(&self, turn: &Turn) -> Result<(), String>;

    /// 指定したゲームID・プレイヤーid・ターン数の情報を取得
    async fn get_turn_data(
        &self,
        game_id: &GameId,
        player_id: &PlayerId,
        turn_number: &TurnNumber,
    ) -> Result<Option<Turn>, String>;
}
