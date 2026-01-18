use serde::Serialize;

use crate::domain::matching_management::models::matching::MatchingStatusValue;

/// WebSocketレスポンスの種類
#[derive(Debug, Serialize)]
#[serde(tag = "action")]
#[serde(rename_all = "snake_case")]
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
