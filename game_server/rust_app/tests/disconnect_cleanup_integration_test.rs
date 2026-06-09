use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use chrono::Utc;
use game_server::{
    application::websocket::{
        disconnect_usecase::DisconnectUseCase,
        websocket_response::{OutcomeValue, WebSocketResponse},
        websocket_sender::WebSocketSender,
    },
    domain::{
        matching_management::{
            models::matching::{
                Matching, MatchingEndDatetime, MatchingStatus, MatchingStatusValue,
            },
            repositories::matching_repository::MatchingRepository,
        },
        player_management::{
            models::player::player_id::player_id::PlayerId,
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::{
            models::game::{game::Game, game_id::game_id::GameId, game_state::GameStateValue},
            repositories::game_repository::GameRepository,
        },
    },
};

const PLAYER_A: &str = "550e8400-e29b-41d4-a716-4466554400a1";
const PLAYER_B: &str = "550e8400-e29b-41d4-a716-4466554400b2";
const CONN_A: &str = "conn-a";
const CONN_B: &str = "conn-b";

/// 接続IDとプレイヤーIDの双方向マップを持つインメモリ接続リポジトリ。
#[derive(Default)]
struct InMemoryConnectionRepository {
    player_to_connection: Mutex<HashMap<String, String>>,
    connection_to_player: Mutex<HashMap<String, String>>,
}

#[async_trait]
impl ConnectionRepository for InMemoryConnectionRepository {
    async fn save(&self, player_id: &str, connection_id: &str) -> Result<(), String> {
        let mut player_to_connection = self.player_to_connection.lock().unwrap();
        let mut connection_to_player = self.connection_to_player.lock().unwrap();

        if let Some(old_connection_id) =
            player_to_connection.insert(player_id.to_string(), connection_id.to_string())
        {
            connection_to_player.remove(&old_connection_id);
        }
        connection_to_player.insert(connection_id.to_string(), player_id.to_string());
        Ok(())
    }

    async fn get_connection_id(&self, player_id: &str) -> Result<String, String> {
        self.player_to_connection
            .lock()
            .unwrap()
            .get(player_id)
            .cloned()
            .ok_or_else(|| format!("Connectionが見つかりません: {}", player_id))
    }

    async fn get_player_id_by_connection_id(
        &self,
        connection_id: &str,
    ) -> Result<Option<String>, String> {
        Ok(self
            .connection_to_player
            .lock()
            .unwrap()
            .get(connection_id)
            .cloned())
    }

    async fn delete_by_connection_id(&self, connection_id: &str) -> Result<(), String> {
        let mut player_to_connection = self.player_to_connection.lock().unwrap();
        let mut connection_to_player = self.connection_to_player.lock().unwrap();

        if let Some(player_id) = connection_to_player.remove(connection_id) {
            player_to_connection.remove(&player_id);
        }
        Ok(())
    }
}

/// マッチングデータを保持するインメモリリポジトリ。
#[derive(Default)]
struct InMemoryMatchingRepository {
    matchings: Mutex<Vec<Matching>>,
}

impl InMemoryMatchingRepository {
    /// 指定プレイヤーが player1 の最新マッチングを取得する。
    fn latest_for_player1(&self, player_id: &str) -> Option<Matching> {
        self.matchings
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find(|m| m.player1_id().value() == player_id)
            .cloned()
    }
}

#[async_trait]
impl MatchingRepository for InMemoryMatchingRepository {
    async fn save(&self, matching: &Matching) -> Result<(), String> {
        self.matchings.lock().unwrap().push(matching.clone());
        Ok(())
    }

    async fn update(&self, matching: &Matching) -> Result<(), String> {
        let mut guard = self.matchings.lock().unwrap();
        if let Some(target) = guard
            .iter_mut()
            .find(|item| item.matching_id().value() == matching.matching_id().value())
        {
            *target = matching.clone();
            return Ok(());
        }
        Err("matching not found".to_string())
    }

    async fn get_latest_waiting_matching(&self) -> Result<Option<Matching>, String> {
        Ok(self
            .matchings
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find(|m| m.matching_status().value() == &MatchingStatusValue::InProgress)
            .cloned())
    }

    async fn interrupt_waiting_by_player_id(&self, player_id: &str) -> Result<(), String> {
        let mut guard = self.matchings.lock().unwrap();
        for matching in guard.iter_mut().filter(|m| {
            m.player1_id().value() == player_id
                && m.matching_status().value() == &MatchingStatusValue::InProgress
        }) {
            *matching = Matching::new(
                matching.matching_id().clone(),
                matching.player1_id().clone(),
                matching.player2_id().clone(),
                matching.matching_start_datetime().clone(),
                MatchingEndDatetime::new(Some(Utc::now())),
                MatchingStatus::new(MatchingStatusValue::Interrupted),
            );
        }
        Ok(())
    }
}

/// ゲームデータを保持するインメモリリポジトリ。
#[derive(Default)]
struct InMemoryGameRepository {
    games: Mutex<Vec<Game>>,
}

impl InMemoryGameRepository {
    /// 先頭のゲームを取得する（このテストでは1件のみ保存される前提）。
    fn first(&self) -> Option<Game> {
        self.games.lock().unwrap().first().cloned()
    }
}

#[async_trait]
impl GameRepository for InMemoryGameRepository {
    async fn save(&self, game: &Game) -> Result<(), String> {
        self.games.lock().unwrap().push(game.clone());
        Ok(())
    }

    async fn update(&self, game: &Game) -> Result<(), String> {
        let mut guard = self.games.lock().unwrap();
        if let Some(target) = guard
            .iter_mut()
            .find(|item| item.game_id().value() == game.game_id().value())
        {
            *target = game.clone();
            return Ok(());
        }
        Err("game not found".to_string())
    }

    async fn get_game_by_id(&self, game_id: &GameId) -> Result<Game, String> {
        self.games
            .lock()
            .unwrap()
            .iter()
            .find(|g| g.game_id().value() == game_id.value())
            .cloned()
            .ok_or_else(|| "game not found".to_string())
    }

    async fn get_inprogress_games_by_player_id(
        &self,
        player_id: &str,
    ) -> Result<Vec<Game>, String> {
        Ok(self
            .games
            .lock()
            .unwrap()
            .iter()
            .filter(|g| {
                g.game_state().value() == &GameStateValue::InProgress
                    && (g.player1_id().value() == player_id || g.player2_id().value() == player_id)
            })
            .cloned()
            .collect())
    }
}

/// WebSocket の NotifyGameState 送信内容を検証するためのログ。
#[derive(Debug, Clone, PartialEq, Eq)]
struct NotifyLog {
    connection_id: String,
    game_id: String,
    outcome: OutcomeValue,
    state: GameStateValue,
}

/// NotifyGameState だけを収集するテスト用 WebSocketSender。
#[derive(Default)]
struct CollectingWebSocketSender {
    notify_logs: Mutex<Vec<NotifyLog>>,
}

impl CollectingWebSocketSender {
    /// 収集済み通知件数を返す。
    fn notify_count(&self) -> usize {
        self.notify_logs.lock().unwrap().len()
    }

    /// 先頭の通知ログを返す。
    fn first_notify(&self) -> Option<NotifyLog> {
        self.notify_logs.lock().unwrap().first().cloned()
    }
}

#[async_trait]
impl WebSocketSender for CollectingWebSocketSender {
    async fn send_message(
        &self,
        connection_id: &str,
        response: &WebSocketResponse,
    ) -> Result<(), String> {
        if let WebSocketResponse::NotifyGameState {
            game_id,
            state,
            outcome,
            ..
        } = response
        {
            self.notify_logs.lock().unwrap().push(NotifyLog {
                connection_id: connection_id.to_string(),
                game_id: game_id.to_string(),
                outcome: outcome.clone(),
                state: state.clone(),
            });
        }
        Ok(())
    }
}

#[tokio::test]
/// 切断時にマッチング中断・ゲーム完了更新・対戦相手への勝利通知・接続削除が一連で実行されることを確認する。
async fn disconnect_cancels_matching_and_completes_game_once() {
    let connection_repository = Arc::new(InMemoryConnectionRepository::default());
    let matching_repository = Arc::new(InMemoryMatchingRepository::default());
    let game_repository = Arc::new(InMemoryGameRepository::default());
    let websocket_sender = Arc::new(CollectingWebSocketSender::default());

    connection_repository.save(PLAYER_A, CONN_A).await.unwrap();
    connection_repository.save(PLAYER_B, CONN_B).await.unwrap();

    let matching = Matching::create(PlayerId::new(PLAYER_A.to_string()));
    matching_repository.save(&matching).await.unwrap();

    let game = Game::create(
        GameId::new("550e8400-e29b-41d4-a716-4466554400c3".to_string()),
        &PlayerId::new(PLAYER_A.to_string()),
        &PlayerId::new(PLAYER_B.to_string()),
    );
    game_repository.save(&game).await.unwrap();

    let usecase = DisconnectUseCase::new(
        connection_repository.clone(),
        matching_repository.clone(),
        game_repository.clone(),
        websocket_sender.clone(),
    );

    usecase.execute(CONN_A).await.unwrap();

    let matching_after = matching_repository.latest_for_player1(PLAYER_A).unwrap();
    assert_eq!(
        matching_after.matching_status().value(),
        &MatchingStatusValue::Interrupted
    );

    let game_after = game_repository.first().unwrap();
    assert_eq!(game_after.game_state().value(), &GameStateValue::Completed);

    assert_eq!(websocket_sender.notify_count(), 1);
    let notify = websocket_sender.first_notify().unwrap();
    assert_eq!(notify.connection_id, CONN_B);
    assert_eq!(notify.outcome, OutcomeValue::Win);
    assert_eq!(notify.state, GameStateValue::Completed);

    // 切断した側の connection は削除され、相手側は残る
    let maybe_disconnected_player = connection_repository
        .get_player_id_by_connection_id(CONN_A)
        .await
        .unwrap();
    assert!(maybe_disconnected_player.is_none());
    assert_eq!(
        connection_repository
            .get_connection_id(PLAYER_B)
            .await
            .unwrap(),
        CONN_B
    );
}
