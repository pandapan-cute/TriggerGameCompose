use serde::{Deserialize, Serialize};

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
    Matchmaking { player_id: String },

    /// Ping/Pong
    Ping,
}
