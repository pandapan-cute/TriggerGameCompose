use std::sync::Arc;

use crate::{
    application::websocket::{
        websocket_response::{OutcomeValue, WebSocketResponse},
        websocket_sender::WebSocketSender,
    },
    domain::{
        player_management::{
            models::player::player_id::player_id::PlayerId,
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::{
            models::{
                game::{game::Game, game_id::game_id::GameId},
                turn::turn_number::turn_number::TurnNumber,
            },
            repositories::{game_repository::GameRepository, turn_repository::TurnRepository},
        },
    },
};

pub struct MotionLabLimitUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    turn_repository: Arc<dyn TurnRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

impl MotionLabLimitUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        turn_repository: Arc<dyn TurnRepository>,

        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            turn_repository,
            websocket_sender,
        }
    }

    /// 動きの設定締切タイマーを実行する関数
    ///
    /// # Arguments
    /// - `game_id`: ゲームID
    /// - `turn_number`: ターン番号
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。
    pub async fn execute(&self, game_id: String, turn_number: i32) -> Result<(), String> {
        // ゲーム情報の取得
        let mut game = self
            .game_repository
            .get_game_by_id(&GameId::new(game_id))
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        if game.current_turn_number().value() > turn_number {
            // すでに処理済みのターンの場合は何もしない
            return Ok(());
        } else {
            // ゲーム状態をcompletedに更新する
            game.complete_game_state();
            self.game_repository.update(&game).await?;
        }

        let turn_data_1 = self
            .turn_repository
            .get_turn_data(
                game.game_id(),
                game.player1_id(),
                &TurnNumber::new(turn_number),
            )
            .await?;

        if turn_data_1.is_some() {
            // turn_data_1は提出されているのでplayer1の勝利とする
            self.response_win_game_state(&game, game.player1_id())
                .await?;
        } else {
            // turn_data_1が提出されていないのでplayer1の敗北とする
            self.response_lose_game_state(&game, game.player1_id())
                .await?;
        }

        let turn_data_2 = self
            .turn_repository
            .get_turn_data(
                game.game_id(),
                game.player2_id(),
                &TurnNumber::new(turn_number),
            )
            .await?;

        if turn_data_2.is_some() {
            // turn_data_2は提出されているのでplayer2の勝利とする
            self.response_win_game_state(&game, game.player2_id())
                .await?;
        } else {
            // turn_data_2が提出されていないのでplayer2の敗北とする
            self.response_lose_game_state(&game, game.player2_id())
                .await?;
        }
        Ok(())
    }

    /// 勝利を通知するためのWebSocketレスポンスを送信する関数
    ///
    /// # Arguments
    /// - `game_id`: ゲームID
    /// - `player_id`: プレイヤーID
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。
    async fn response_win_game_state(
        &self,
        game: &Game,
        player_id: &PlayerId,
    ) -> Result<(), String> {
        let response = WebSocketResponse::NotifyGameState {
            message: "対戦相手がリタイアしました。あなたの勝利です。".to_string(),
            state: game.game_state().value().clone(),
            outcome: OutcomeValue::Win,
        };
        if let Err(e) = self.response_message(player_id, response).await {
            eprintln!("WebSocketメッセージの送信に失敗しました: {}", e);
        }
        Ok(())
    }

    /// 敗北を通知するためのWebSocketレスポンスを送信する関数
    ///
    /// # Arguments
    /// - `game_id`: ゲームID
    /// - `player_id`: プレイヤーID
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。    
    async fn response_lose_game_state(
        &self,
        game: &Game,
        player_id: &PlayerId,
    ) -> Result<(), String> {
        let response = WebSocketResponse::NotifyGameState {
            message: "ゲームは終了しました。通信状況を確認してください。".to_string(),
            state: game.game_state().value().clone(),
            outcome: OutcomeValue::Lose,
        };
        if let Err(e) = self.response_message(player_id, response).await {
            eprintln!("WebSocketメッセージの送信に失敗しました: {}", e);
        }
        Ok(())
    }

    /// WebSocketレスポンスを送信する共通関数
    ///
    /// # Arguments
    /// - `player_id`: プレイヤーID
    /// - `response`: 送信するWebSocketレスポンス
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。    
    async fn response_message(
        &self,
        player_id: &PlayerId,
        response: WebSocketResponse,
    ) -> Result<(), String> {
        let connection_id = self
            .connection_repository
            .get_connection_id(player_id.value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        self.websocket_sender
            .send_message(&connection_id, &response)
            .await
            .map_err(|e| {
                format!(
                    "WebSocketメッセージの送信に失敗しました: {}, response: {:?}",
                    e, response
                )
            })?;
        Ok(())
    }
}
