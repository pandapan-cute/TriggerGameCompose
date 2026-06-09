use std::sync::Arc;

use crate::{
    application::websocket::{
        websocket_response::{OutcomeValue, WebSocketResponse},
        websocket_sender::WebSocketSender,
    },
    domain::{
        player_management::{
            models::player::{self, player_id::player_id::PlayerId},
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::repositories::game_repository::GameRepository,
    },
};

pub struct InterruptGameUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

impl InterruptGameUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            websocket_sender,
        }
    }

    /// ゲームの中断処理を行う。
    ///
    /// ポリシー:
    /// - 不明な connection_id は成功扱い (no-op)
    /// - ゲーム中断は waiting(InProgress) のみ対象
    /// - Completed を Interrupted で上書きしない (repository 側の条件更新)
    /// - 同一 disconnect の再実行は収束する (idempotent)
    pub async fn execute(&self, connection_id: &str) -> Result<(), String> {
        let maybe_player_id = self
            .connection_repository
            .get_player_id_by_connection_id(connection_id)
            .await?;

        let Some(player_id) = maybe_player_id else {
            return Ok(());
        };

        // プレイヤーのゲームを取得
        let player_id = PlayerId::new(player_id);
        let inprogress_games = self
            .game_repository
            .get_inprogress_games_by_player_id(&player_id.value().to_string())
            .await?;

        for mut game in inprogress_games {
            // ゲーム状態を完了に更新して保存
            game.complete_game_state();
            self.game_repository.update(&game).await?;

            let opponent_connection_id = self
                .connection_repository
                .get_connection_id(
                    game.get_opponent_player_id(&player_id)
                        .map_err(|e| format!("対戦相手のプレイヤーIDの取得に失敗しました: {}", e))?
                        .value(),
                )
                .await?;

            // 対戦相手にゲーム終了(勝利通知)を送る
            let response = WebSocketResponse::NotifyGameState {
                game_id: game.game_id().value().to_string(),
                message: "対戦相手がリタイアしました。あなたの勝利です。".to_string(),
                state: game.game_state().value().clone(),
                outcome: OutcomeValue::Win,
            };
            self.websocket_sender
                .send_message(&opponent_connection_id, &response)
                .await?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::application::websocket::websocket_response::WebSocketResponse;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::{
        game::Game, game_id::game_id::GameId,
    };

    use super::*;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct MockConnectionRepository {
        lookup_result: Mutex<Option<String>>,
        deleted_connection_ids: Mutex<Vec<String>>,
    }

    #[async_trait]
    impl ConnectionRepository for MockConnectionRepository {
        async fn save(&self, _player_id: &str, _connection_id: &str) -> Result<(), String> {
            Ok(())
        }

        async fn get_connection_id(&self, _player_id: &str) -> Result<String, String> {
            Err("not used in this test".to_string())
        }

        async fn get_player_id_by_connection_id(
            &self,
            _connection_id: &str,
        ) -> Result<Option<String>, String> {
            Ok(self.lookup_result.lock().unwrap().clone())
        }

        async fn delete_by_connection_id(&self, connection_id: &str) -> Result<(), String> {
            self.deleted_connection_ids
                .lock()
                .unwrap()
                .push(connection_id.to_string());
            self.lookup_result.lock().unwrap().take();
            Ok(())
        }
    }

    #[derive(Default)]
    struct MockGameRepository {
        game: Mutex<Option<Game>>,
        inprogress_games: Mutex<Vec<Game>>,
        updated_games: Mutex<Vec<Game>>,
    }

    #[async_trait]
    impl GameRepository for MockGameRepository {
        async fn save(&self, _game: &Game) -> Result<(), String> {
            Ok(())
        }

        async fn update(&self, game: &Game) -> Result<(), String> {
            self.updated_games.lock().unwrap().push(game.clone());
            Ok(())
        }

        async fn get_game_by_id(&self, _game_id: &GameId) -> Result<Game, String> {
            Ok(self
                .game
                .lock()
                .unwrap()
                .clone()
                .ok_or_else(|| "Game not found".to_string())?)
        }

        async fn get_inprogress_games_by_player_id(
            &self,
            _player_id: &str,
        ) -> Result<Vec<Game>, String> {
            let game = create_test_game();
            Ok(vec![game])
        }
    }

    fn create_test_game() -> Game {
        Game::create(
            GameId::new(uuid::Uuid::new_v4().to_string()),
            &PlayerId::new(uuid::Uuid::new_v4().to_string()),
            &PlayerId::new(uuid::Uuid::new_v4().to_string()),
        )
    }

    #[derive(Default)]
    struct MockWebSocketSender {}

    #[async_trait]
    impl WebSocketSender for MockWebSocketSender {
        async fn send_message(
            &self,
            _connection_id: &str,
            _response: &WebSocketResponse,
        ) -> Result<(), String> {
            Ok(())
        }
    }

    #[tokio::test]
    /// 未知の connection_id では副作用を起こさず成功終了することを検証する
    async fn execute_unknown_connection_is_noop() {
        let connection_repository = Arc::new(MockConnectionRepository::default());
        let game_repository = Arc::new(MockGameRepository {
            game: Mutex::new(None),
            inprogress_games: Mutex::new(vec![create_test_game()]),
            updated_games: Mutex::new(vec![]),
        });

        let websocket_sender = Arc::new(MockWebSocketSender::default());
        let usecase = InterruptGameUseCase::new(
            connection_repository.clone(),
            game_repository,
            websocket_sender,
        );

        let result = usecase.execute("conn-unknown").await;
        assert!(result.is_ok());
        assert!(connection_repository
            .deleted_connection_ids
            .lock()
            .unwrap()
            .is_empty());
    }
}
