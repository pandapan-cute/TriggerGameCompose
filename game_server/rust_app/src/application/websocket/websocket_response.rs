use serde::Serialize;

use crate::{
    application::game::{enemy_unit_dto::EnemyUnitDto, friend_unit_dto::FriendUnitDto},
    domain::{
        matching_management::models::matching::MatchingStatusValue,
        triggergame_simulator::models::turn::Turn,
    },
};

/// WebSocketレスポンスの種類
#[derive(Debug, Serialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase", // Matchmaking -> matchmaking
    rename_all_fields = "camelCase" // player_id -> playerId
)]
pub enum WebSocketResponse {
    /// マッチメイキング結果
    MatchmakingResult {
        /// マッチングステータス
        status: MatchingStatusValue,
        /// ゲームID
        game_id: Option<String>,
        /// 敵ユニット情報
        enemy_units: Vec<EnemyUnitDto>,
        /// 味方ユニット情報
        friend_units: Vec<FriendUnitDto>,
    },

    /// ターン実行結果
    TurnExecutionResult {
        /// ターン情報
        turn: Turn,
    },

    /// エラーレスポンス
    Error { message: String },

    /// Pong
    Pong,
}

impl WebSocketResponse {
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(self).map_err(|e| format!("Serialization error: {}", e))
    }
}
