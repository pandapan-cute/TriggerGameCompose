use serde::{Deserialize, Serialize};

use crate::{
    application::matchmaking::matchmaking_dto::CreateUnitDto,
    domain::triggergame_simulator::models::step::step::Step,
};

/// WebSocketメッセージの種類
/// tagにアクションを設定することで、シリアライズが以下のようになります
///
/// {
///     "action": "matchmaking",
///     "playerId": "player_123"
/// }
/// Ping の場合
/// {
///     "action": "ping"
/// }
///
#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase", // Matchmaking -> matchmaking
    rename_all_fields = "camelCase" // player_id -> playerId
)]
pub enum WebSocketRequest {
    /// マッチメイキングリクエスト
    Matchmaking {
        player_id: String,
        units: Vec<CreateUnitDto>,
    },

    /// ターン設定リクエスト
    TurnExecution {
        game_id: String,
        player_id: String,
        steps: Vec<Step>,
    },

    /// Ping/Pong
    Ping,
}
