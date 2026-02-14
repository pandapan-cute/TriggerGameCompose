use serde::{Deserialize, Serialize};

use crate::{
    application::matchmaking::matchmaking_dto::CreateUnitDto,
    domain::{
        player_management::models::player::player_id::player_id::PlayerId,
        triggergame_simulator::models::{
            game::{game::Game, game_id::game_id::GameId},
            step::step::Step,
        },
    },
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

    /// ゲーム状態取得リクエスト
    /// ゲーム画面に遷移したときにクライアントから送信される
    GetGameState {
        player_id: PlayerId,
        game_id: GameId,
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
