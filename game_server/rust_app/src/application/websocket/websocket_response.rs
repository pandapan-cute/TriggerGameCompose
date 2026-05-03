use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::{
    application::game::{enemy_unit_dto::EnemyUnitDto, friend_unit_dto::FriendUnitDto},
    domain::{
        matching_management::models::matching::MatchingStatusValue,
        triggergame_simulator::models::{
            game::{
                game_state::{GameState, GameStateValue},
                motion_lab_end_time::MotionLabEndTime,
            },
            turn::{turn_number::turn_number::TurnNumber, Turn},
        },
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
        /// 動きの設定の終了時間
        motion_lab_end_time: Option<MotionLabEndTime>,
        /// 敵ユニット情報
        enemy_units: Vec<EnemyUnitDto>,
        /// 味方ユニット情報
        friend_units: Vec<FriendUnitDto>,
        /// フィールドのステップ情報
        field_steps: Vec<Vec<i32>>,
    },

    /// ゲーム状態取得結果
    GetGameStateResult {
        /// ゲームの進行状態
        game_state: GameStateValue,
        /// ゲームのターン番号
        current_turn_number: TurnNumber,
        /// 動きの設定の終了時間
        motion_lab_end_time: MotionLabEndTime,
        /// 敵ユニット情報
        enemy_units: Vec<EnemyUnitDto>,
        /// 味方ユニット情報
        friend_units: Vec<FriendUnitDto>,
        /// フィールドのステップ情報
        field_steps: Vec<Vec<i32>>,
        /// フィールドの可視情報
        visibility: Vec<Vec<bool>>,
    },

    /// ターン実行結果
    TurnExecutionResult {
        /// ターン情報
        turn: Turn,
        /// 次ターンの動きの設定提出時間
        motion_lab_end_time: MotionLabEndTime,
    },

    /// ゲーム状態の通知
    NotifyGameState {
        /// ゲーム状態のメッセージ
        message: String,
        /// ゲーム状態の値
        state: GameStateValue,
        /// 勝敗
        outcome: Option<OutcomeValue>,
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

/// 勝敗の値
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum OutcomeValue {
    Win,
    Lose,
    Draw,
}
