use async_trait::async_trait;

use crate::domain::{
    triggergame_simulator::models::game::game_id::game_id::GameId,
    unit_management::models::unit::Unit,
};

/// Unitリポジトリのトレイト
#[async_trait]
pub trait UnitRepository: Send + Sync {
    /// ユニット情報を保存
    async fn save(&self, unit: &Unit) -> Result<(), String>;

    /// ユニット情報を更新
    async fn update(&self, unit: &Unit) -> Result<(), String>;

    /// 特定の対戦のユニットを取得
    async fn get_game_units(&self, game_id: GameId) -> Result<Vec<Unit>, String>;
}
