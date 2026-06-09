use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use game_server::{
    application::{
        matchmaking::{
            match_cancel_usecase::MatchCancelUseCase,
            matchmaking_application_service::MatchmakingApplicationService,
            matchmaking_dto::CreateUnitDto,
        },
        schedule::schedule_maker::ScheduleMaker,
        websocket::{websocket_response::WebSocketResponse, websocket_sender::WebSocketSender},
    },
    domain::{
        matching_management::{
            models::matching::{
                Matching, MatchingEndDatetime, MatchingStatus, MatchingStatusValue,
            },
            repositories::matching_repository::MatchingRepository,
        },
        player_management::repositories::connection_repository::ConnectionRepository,
        triggergame_simulator::{
            models::{
                game::{game::Game, game_id::game_id::GameId},
                turn::turn_number::turn_number::TurnNumber,
            },
            repositories::game_repository::GameRepository,
        },
        unit_management::{models::unit::Unit, repositories::unit_repository::UnitRepository},
    },
};

const PLAYER_A: &str = "550e8400-e29b-41d4-a716-4466554400a1";
const PLAYER_B: &str = "550e8400-e29b-41d4-a716-4466554400b2";
const CONN_A1: &str = "conn-a-1";
const CONN_A2: &str = "conn-a-2";
const CONN_B: &str = "conn-b";

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

#[derive(Default)]
struct InMemoryMatchingRepository {
    matchings: Mutex<Vec<Matching>>,
}

impl InMemoryMatchingRepository {
    fn statuses_for_player1(&self, player_id: &str) -> Vec<MatchingStatusValue> {
        self.matchings
            .lock()
            .unwrap()
            .iter()
            .filter(|matching| matching.player1_id().value() == player_id)
            .map(|matching| matching.matching_status().value().clone())
            .collect()
    }

    fn has_completed_match_between(&self, player1_id: &str, player2_id: &str) -> bool {
        self.matchings.lock().unwrap().iter().any(|matching| {
            matching.player1_id().value() == player1_id
                && matching
                    .player2_id()
                    .as_ref()
                    .map(|id| id.value() == player2_id)
                    .unwrap_or(false)
                && matching.matching_status().value() == &MatchingStatusValue::Completed
        })
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
            .find(|matching| matching.matching_status().value() == &MatchingStatusValue::InProgress)
            .cloned())
    }

    async fn interrupt_waiting_by_player_id(&self, player_id: &str) -> Result<(), String> {
        let mut guard = self.matchings.lock().unwrap();
        for matching in guard.iter_mut().filter(|matching| {
            matching.player1_id().value() == player_id
                && matching.matching_status().value() == &MatchingStatusValue::InProgress
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

#[derive(Default)]
struct InMemoryUnitRepository {
    units: Mutex<Vec<Unit>>,
}

#[async_trait]
impl UnitRepository for InMemoryUnitRepository {
    async fn save(&self, unit: &Unit) -> Result<(), String> {
        self.units.lock().unwrap().push(unit.clone());
        Ok(())
    }

    async fn update(&self, unit: &Unit) -> Result<(), String> {
        let mut guard = self.units.lock().unwrap();
        if let Some(target) = guard
            .iter_mut()
            .find(|item| item.unit_id().value() == unit.unit_id().value())
        {
            *target = unit.clone();
        }
        Ok(())
    }

    async fn update_units(&self, units: &Vec<Unit>) -> Result<(), String> {
        for unit in units {
            self.update(unit).await?;
        }
        Ok(())
    }

    async fn get_game_units(&self, game_id: &GameId) -> Result<Vec<Unit>, String> {
        Ok(self
            .units
            .lock()
            .unwrap()
            .iter()
            .filter(|unit| unit.game_id().value() == game_id.value())
            .cloned()
            .collect())
    }
}

#[derive(Default)]
struct InMemoryGameRepository {
    games: Mutex<Vec<Game>>,
}

impl InMemoryGameRepository {
    fn saved_count(&self) -> usize {
        self.games.lock().unwrap().len()
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
        }
        Ok(())
    }

    async fn get_game_by_id(&self, game_id: &GameId) -> Result<Game, String> {
        self.games
            .lock()
            .unwrap()
            .iter()
            .find(|game| game.game_id().value() == game_id.value())
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
                g.game_state().is_in_progress()
                    && (g.player1_id().value() == player_id || g.player2_id().value() == player_id)
            })
            .cloned()
            .collect())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MatchmakingNotification {
    connection_id: String,
    status: MatchingStatusValue,
    game_id: Option<String>,
}

#[derive(Default)]
struct CollectingWebSocketSender {
    notifications: Mutex<Vec<MatchmakingNotification>>,
}

impl CollectingWebSocketSender {
    fn contains_status(&self, connection_id: &str, status: MatchingStatusValue) -> bool {
        self.notifications
            .lock()
            .unwrap()
            .iter()
            .any(|n| n.connection_id == connection_id && n.status == status)
    }
}

#[async_trait]
impl WebSocketSender for CollectingWebSocketSender {
    async fn send_message(
        &self,
        connection_id: &str,
        response: &WebSocketResponse,
    ) -> Result<(), String> {
        if let WebSocketResponse::MatchmakingResult {
            status, game_id, ..
        } = response
        {
            self.notifications
                .lock()
                .unwrap()
                .push(MatchmakingNotification {
                    connection_id: connection_id.to_string(),
                    status: status.clone(),
                    game_id: game_id.clone(),
                });
        }
        Ok(())
    }
}

#[derive(Default)]
struct NoopScheduleMaker;

#[async_trait]
impl ScheduleMaker for NoopScheduleMaker {
    async fn make_schedule_event(
        &self,
        _game_id: &GameId,
        _turn_number: &TurnNumber,
        _time: &DateTime<Utc>,
    ) -> Result<(), String> {
        Ok(())
    }
}

fn create_test_units(seed: &str) -> Vec<CreateUnitDto> {
    vec![CreateUnitDto {
        unit_type_id: format!("unit-type-{}", seed),
        initial_x: 3,
        initial_y: 4,
        using_main_trigger_id: format!("main-trigger-{}", seed),
        using_sub_trigger_id: format!("sub-trigger-{}", seed),
        main_trigger_ids: vec![format!("main-trigger-{}", seed)],
        sub_trigger_ids: vec![format!("sub-trigger-{}", seed)],
    }]
}

type TestSetup = (
    Arc<InMemoryConnectionRepository>,
    Arc<InMemoryMatchingRepository>,
    Arc<InMemoryGameRepository>,
    Arc<CollectingWebSocketSender>,
    MatchmakingApplicationService,
    MatchCancelUseCase,
);

fn setup() -> TestSetup {
    let connection_repository = Arc::new(InMemoryConnectionRepository::default());
    let matching_repository = Arc::new(InMemoryMatchingRepository::default());
    let game_repository = Arc::new(InMemoryGameRepository::default());
    let websocket_sender = Arc::new(CollectingWebSocketSender::default());

    let disconnect_usecase =
        MatchCancelUseCase::new(connection_repository.clone(), matching_repository.clone());

    let matchmaking_service = MatchmakingApplicationService::new(
        matching_repository.clone(),
        connection_repository.clone(),
        Arc::new(InMemoryUnitRepository::default()),
        game_repository.clone(),
        websocket_sender.clone(),
        Arc::new(NoopScheduleMaker),
    );

    (
        connection_repository,
        matching_repository,
        game_repository,
        websocket_sender,
        matchmaking_service,
        disconnect_usecase,
    )
}

#[tokio::test]
async fn acceptance_pattern1_disconnect_then_rejoin_starts_game() {
    let (
        connection_repository,
        matching_repository,
        game_repository,
        websocket_sender,
        matchmaking_service,
        disconnect_usecase,
    ) = setup();

    connection_repository.save(PLAYER_A, CONN_A1).await.unwrap();
    matchmaking_service
        .execute(PLAYER_A, CONN_A1, create_test_units("a-first"))
        .await
        .unwrap();

    disconnect_usecase.execute(CONN_A1).await.unwrap();

    connection_repository.save(PLAYER_B, CONN_B).await.unwrap();
    matchmaking_service
        .execute(PLAYER_B, CONN_B, create_test_units("b"))
        .await
        .unwrap();

    connection_repository.save(PLAYER_A, CONN_A2).await.unwrap();
    matchmaking_service
        .execute(PLAYER_A, CONN_A2, create_test_units("a-rejoin"))
        .await
        .unwrap();

    assert!(websocket_sender.contains_status(CONN_A2, MatchingStatusValue::Completed));
    assert!(websocket_sender.contains_status(CONN_B, MatchingStatusValue::Completed));
    assert_eq!(game_repository.saved_count(), 1);

    let a_statuses = matching_repository.statuses_for_player1(PLAYER_A);
    assert!(a_statuses.contains(&MatchingStatusValue::Interrupted));
}

#[tokio::test]
async fn acceptance_pattern2_refresh_disconnect_connect_then_game_starts() {
    let (
        connection_repository,
        matching_repository,
        game_repository,
        websocket_sender,
        matchmaking_service,
        disconnect_usecase,
    ) = setup();

    connection_repository.save(PLAYER_A, CONN_A1).await.unwrap();
    matchmaking_service
        .execute(PLAYER_A, CONN_A1, create_test_units("a-before-refresh"))
        .await
        .unwrap();

    disconnect_usecase.execute(CONN_A1).await.unwrap();

    connection_repository.save(PLAYER_A, CONN_A2).await.unwrap();
    matchmaking_service
        .execute(PLAYER_A, CONN_A2, create_test_units("a-after-refresh"))
        .await
        .unwrap();

    connection_repository.save(PLAYER_B, CONN_B).await.unwrap();
    matchmaking_service
        .execute(PLAYER_B, CONN_B, create_test_units("b"))
        .await
        .unwrap();

    assert!(websocket_sender.contains_status(CONN_A2, MatchingStatusValue::Completed));
    assert!(websocket_sender.contains_status(CONN_B, MatchingStatusValue::Completed));
    assert_eq!(game_repository.saved_count(), 1);

    let a_statuses = matching_repository.statuses_for_player1(PLAYER_A);
    assert!(a_statuses.contains(&MatchingStatusValue::Interrupted));
    assert!(a_statuses.contains(&MatchingStatusValue::Completed));
}

#[tokio::test]
async fn disconnect_when_not_matching_is_noop() {
    let (
        _connection_repository,
        matching_repository,
        _game_repository,
        _websocket_sender,
        _matchmaking_service,
        disconnect_usecase,
    ) = setup();

    disconnect_usecase
        .execute("unknown-connection")
        .await
        .unwrap();

    assert!(matching_repository
        .statuses_for_player1(PLAYER_A)
        .is_empty());
    assert!(matching_repository
        .statuses_for_player1(PLAYER_B)
        .is_empty());
}

#[tokio::test]
async fn completion_is_not_overwritten_by_disconnect_interruption() {
    let (
        connection_repository,
        matching_repository,
        _game_repository,
        websocket_sender,
        matchmaking_service,
        disconnect_usecase,
    ) = setup();

    connection_repository.save(PLAYER_A, CONN_A1).await.unwrap();
    matchmaking_service
        .execute(PLAYER_A, CONN_A1, create_test_units("a"))
        .await
        .unwrap();

    connection_repository.save(PLAYER_B, CONN_B).await.unwrap();
    matchmaking_service
        .execute(PLAYER_B, CONN_B, create_test_units("b"))
        .await
        .unwrap();

    disconnect_usecase.execute(CONN_A1).await.unwrap();

    assert!(matching_repository.has_completed_match_between(PLAYER_A, PLAYER_B));
    assert!(websocket_sender.contains_status(CONN_A1, MatchingStatusValue::Completed));
    assert!(websocket_sender.contains_status(CONN_B, MatchingStatusValue::Completed));
}
