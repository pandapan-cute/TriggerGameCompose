use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::domain::triggergame_simulator::models::{
    game::game_id::game_id::GameId, turn::turn_number::turn_number::TurnNumber,
};

/// スケジュールイベント作成のトレイト
/// 実際の作成処理はインフラ層で実装
#[async_trait]
pub trait ScheduleMaker: Send + Sync {
    async fn make_schedule_event(
        &self,
        game_id: &GameId,
        turn_number: &TurnNumber,
        time: &DateTime<Utc>,
    ) -> Result<(), String>;
}
