use serde::Serialize;

use crate::domain::matching_management::models::matching::MatchingStatusValue;

/// WebSocketレスポンスの種類
#[derive(Debug, Serialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase", // Matchmaking -> matchmaking
    rename_all_fields = "camelCase" // player_id -> playerId
)]
pub enum WebSocketResponse {
    /// マッチメイキング結果
    MatchmakingResult { status: MatchingStatusValue },

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
