use serde::{Deserialize, Serialize};

/// WebSocketメッセージの種類
/// tagにアクションを設定することで、シリアライズが以下のようになります
///
/// {
///     "action": "matchmaking",
///     "player_id": "player_123"
/// }
/// Ping の場合
/// {
///     "action": "ping"
/// }
///
#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "action")]
#[serde(rename_all = "snake_case")]
pub enum WebSocketRequest {
    /// マッチメイキングリクエスト
    Matchmaking { player_id: String },

    /// Ping/Pong
    Ping,
}
