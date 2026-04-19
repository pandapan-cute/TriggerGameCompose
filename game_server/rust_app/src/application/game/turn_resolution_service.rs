use std::sync::Arc;

use chrono::{DateTime, Utc};

use crate::{
    application::{
        schedule::schedule_maker::ScheduleMaker,
        websocket::{websocket_response::WebSocketResponse, websocket_sender::WebSocketSender},
    },
    domain::{
        player_management::repositories::connection_repository::ConnectionRepository,
        triggergame_simulator::{
            configs::game_config::GameConfig,
            models::{
                game::{
                    game::Game, game_id::game_id::GameId, motion_lab_end_time::MotionLabEndTime,
                },
                turn::{turn_number::turn_number::TurnNumber, Turn},
            },
            repositories::game_repository::GameRepository,
        },
        unit_management::{models::unit::Unit, repositories::unit_repository::UnitRepository},
    },
};

/// 両者提出後のターン解決（演算・永続化・通知）を担当するサービス。
pub struct TurnResolutionService {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
    schedule_maker: Arc<dyn ScheduleMaker>,
}

impl TurnResolutionService {
    /// `TurnResolutionService` を生成する。
    ///
    /// # Arguments
    /// - `connection_repository`: プレイヤー接続情報取得用リポジトリ。
    /// - `game_repository`: ゲーム情報更新用リポジトリ。
    /// - `unit_repository`: ユニット情報更新用リポジトリ。
    /// - `websocket_sender`: WebSocket 通知送信コンポーネント。
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
        schedule_maker: Arc<dyn ScheduleMaker>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            unit_repository,
            websocket_sender,
            schedule_maker,
        }
    }

    /// 両プレイヤーの提出ターンを解決し、永続化・通知まで実行する。
    ///
    /// # Arguments
    /// - `game`: 解決対象のゲーム情報。
    /// - `game_id`: ゲームID。
    /// - `submitted_turn`: 今回提出されたターン。
    /// - `opponent_turn`: 既に提出済みの相手ターン。
    ///
    /// # Returns
    /// - `Ok(())`: 解決処理が完了。
    /// - `Err(String)`: 解決処理失敗。
    pub async fn resolve_turns(
        &self,
        mut game: Game,
        game_id: GameId,
        submitted_turn: Turn,
        opponent_turn: Turn,
    ) -> Result<(), String> {
        let (mut player1_turn, mut player2_turn) =
            self.arrange_player_turns(&game, submitted_turn, opponent_turn)?;

        let mut units = self.load_units(&game_id).await?;

        game.turn_start(&mut player1_turn, &mut player2_turn, &mut units)?;

        self.persist_units(&units).await?;

        game.advance_to_next_turn()
            .map_err(|e| format!("ターン数の更新に失敗しました: {}", e))?;
        self.persist_game_turn(&game).await?;

        self.notify_turn_result(&player1_turn, &player2_turn)
            .await?;

        self.set_motion_lab_timer(&game_id, game.current_turn_number())
            .await?;

        Ok(())
    }

    /// プレイヤー1/2 の順にターンを並べ替える。
    ///
    /// # Arguments
    /// - `game`: ゲーム情報。
    /// - `submitted_turn`: 今回提出ターン。
    /// - `opponent_turn`: 相手提出ターン。
    ///
    /// # Returns
    /// - `(Turn, Turn)`: `(player1_turn, player2_turn)` の順に整列したターン。
    /// - `Err(String)`: プレイヤー整合性エラー。
    fn arrange_player_turns(
        &self,
        game: &Game,
        submitted_turn: Turn,
        opponent_turn: Turn,
    ) -> Result<(Turn, Turn), String> {
        if submitted_turn.player_id() == game.player1_id()
            && opponent_turn.player_id() == game.player2_id()
        {
            Ok((submitted_turn, opponent_turn))
        } else if submitted_turn.player_id() == game.player2_id()
            && opponent_turn.player_id() == game.player1_id()
        {
            Ok((opponent_turn, submitted_turn))
        } else {
            Err("ターン情報のプレイヤーIDがゲーム参加者と一致しません".to_string())
        }
    }

    /// ゲームIDに紐づくユニット一覧を取得する。
    ///
    /// # Arguments
    /// - `game_id`: ゲームID。
    ///
    /// # Returns
    /// - `Vec<Unit>`: 取得したユニット配列。
    /// - `Err(String)`: 取得失敗。
    async fn load_units(&self, game_id: &GameId) -> Result<Vec<Unit>, String> {
        self.unit_repository
            .get_game_units(game_id)
            .await
            .map_err(|e| format!("ユニット情報の取得に失敗しました: {}", e))
    }

    /// ターン演算結果をユニットへ反映して永続化する。
    ///
    /// # Arguments
    /// - `units`: 更新対象ユニット配列。
    ///
    /// # Returns
    /// - `Ok(())`: 更新成功。
    /// - `Err(String)`: 更新失敗。
    async fn persist_units(&self, units: &Vec<Unit>) -> Result<(), String> {
        self.unit_repository
            .update_units(units)
            .await
            .map_err(|e| format!("ユニット情報の更新に失敗しました: {}", e))
    }

    /// 次ターンへ進めたゲーム情報を永続化する。
    ///
    /// # Arguments
    /// - `game`: 更新対象のゲーム情報。
    ///
    /// # Returns
    /// - `Ok(())`: 更新成功。
    /// - `Err(String)`: 更新失敗。
    async fn persist_game_turn(&self, game: &Game) -> Result<(), String> {
        self.game_repository
            .update_current_turn(game)
            .await
            .map_err(|e| format!("ゲーム情報の更新に失敗しました: {}", e))
    }

    /// 解決結果を各プレイヤーへ WebSocket 通知する。
    ///
    /// # Arguments
    /// - `player1_turn`: プレイヤー1向けの解決済みターン。
    /// - `player2_turn`: プレイヤー2向けの解決済みターン。
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。
    async fn notify_turn_result(
        &self,
        player1_turn: &Turn,
        player2_turn: &Turn,
    ) -> Result<(), String> {
        let player1_connection_id = self
            .connection_repository
            .get_connection_id(player1_turn.player_id().value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        let player2_connection_id = self
            .connection_repository
            .get_connection_id(player2_turn.player_id().value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        // 次の動きの設定の提出時間を作成
        let game_config = GameConfig::get_game_config();
        let motion_lab_end_time = MotionLabEndTime::initial();

        let response_player_1 = WebSocketResponse::TurnExecutionResult {
            turn: player1_turn.clone(),
            motion_lab_end_time: motion_lab_end_time.clone(),
        };
        let response_player_2 = WebSocketResponse::TurnExecutionResult {
            turn: player2_turn.clone(),
            motion_lab_end_time: motion_lab_end_time.clone(),
        };

        self.websocket_sender
            .send_message(&player1_connection_id, &response_player_1)
            .await?;

        self.websocket_sender
            .send_message(&player2_connection_id, &response_player_2)
            .await?;

        Ok(())
    }

    /// 次ターンの動きの設定締切タイマーをセットする。
    ///
    /// # Arguments
    /// - `game_id`: ゲームID
    /// - `turn_number`: ターン番号
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。
    async fn set_motion_lab_timer(
        &self,
        game_id: &GameId,
        turn_number: &TurnNumber,
    ) -> Result<(), String> {
        if turn_number.is_complete() {
            // ゲームが終了している場合はタイマーをセットしない
            return Ok(());
        }
        // 次の動きの設定の提出時間を作成
        let game_config = GameConfig::get_game_config();
        let motion_lab_limit_time = Utc::now()
            + chrono::Duration::seconds(
                game_config.motion_lab_seconds()
                    + game_config.motion_execute_seconds()
                    + game_config.communication_wait_seconds(),
            );

        self.schedule_maker
            .make_schedule_event(game_id, turn_number, &motion_lab_limit_time)
            .await?;
        Ok(())
    }
}
