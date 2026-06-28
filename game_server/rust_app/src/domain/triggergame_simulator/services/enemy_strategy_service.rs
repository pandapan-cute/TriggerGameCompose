use crate::domain::{
    triggergame_simulator::models::turn::Turn, unit_management::models::unit::Unit,
};

/// AI対戦機能サービスのトレイト
pub trait EnemyStrategyService {
    /// AIを使って相手のターン設定を生成する
    fn generate_ai_turn(
        &self,
        player_units: Vec<Unit>,
        enemy_units: Vec<Unit>,
    ) -> Result<Turn, String>;
}
