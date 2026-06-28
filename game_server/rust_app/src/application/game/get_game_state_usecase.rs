use std::sync::Arc;

use crate::{
    application::{
        game::{enemy_unit_dto::EnemyUnitDto, friend_unit_dto::FriendUnitDto},
        websocket::{websocket_response::WebSocketResponse, websocket_sender::WebSocketSender},
    },
    domain::{
        player_management::{
            models::player::player_id::player_id::PlayerId,
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::{
            models::game::game_id::game_id::GameId, repositories::game_repository::GameRepository,
        },
        unit_management::{models::unit::Unit, repositories::unit_repository::UnitRepository},
    },
};

pub struct GetGameStateUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

impl GetGameStateUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            unit_repository,
            websocket_sender,
        }
    }

    pub async fn execute(&self, game_id: GameId, player_id: PlayerId) -> Result<(), String> {
        // ゲーム情報の取得
        let game = self
            .game_repository
            .get_game_by_id(&game_id)
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        // ユニット情報の取得
        let units = self
            .unit_repository
            .get_game_units(&game_id)
            .await
            .map_err(|e| format!("ユニット情報の取得に失敗しました: {}", e))?;

        let connection_id = self
            .connection_repository
            .get_connection_id(player_id.value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        // 敵味方ユニットを分割
        let (enemy_units, friend_units): (Vec<_>, Vec<_>) = units
            .iter()
            .cloned()
            .partition(|u| u.owner_player_id() != &player_id);

        // 敵ユニット可視性判定用: ベイルアウトしていない味方ユニットのみを使用
        let active_friend_units: Vec<Unit> = friend_units
            .iter()
            .filter(|u| !u.is_bailed_out())
            .cloned()
            .collect();

        let response = WebSocketResponse::GetGameStateResult {
            game_state: game.game_state().value().clone(),
            current_turn_number: game.current_turn_number().clone(),
            motion_lab_end_time: game.motion_lab_end_time().clone(),
            enemy_units: EnemyUnitDto::from_units(
                &enemy_units,
                &active_friend_units,
                game.visibility(),
            ),
            friend_units: FriendUnitDto::from_units(&friend_units),
            field_steps: game.visibility().field_steps().to_vec(),
            visibility: game.visibility().calculate_visibility(&active_friend_units),
        };

        self.websocket_sender
            .send_message(&connection_id, &response)
            .await?;

        // println!("Processing turn for game_id: {}", game_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;

    use crate::{
        domain::{
            triggergame_simulator::models::{
                game::{
                    game::Game, game_state::GameState, game_type::GameType,
                    motion_lab_end_time::MotionLabEndTime,
                },
                turn::turn_number::turn_number::TurnNumber,
            },
            unit_management::models::unit::{
                having_trigger_ids::having_trigger_ids::HavingTriggerIds,
                position::position::Position, trigger_id::trigger_id::TriggerId,
                unit_type_id::unit_type_id::UnitTypeId,
            },
        },
        infrastructure::dynamodb::test_utils::{
            create_active_and_bailed_out_unit_pair, create_simple_visibility_from_field_steps,
        },
    };

    /// `GetGameStateResult` からテストで必要な項目だけ保持する構造体。
    #[derive(Clone)]
    struct CapturedGetGameStateResult {
        enemy_units: Vec<EnemyUnitDto>,
        visibility: Vec<Vec<bool>>,
    }

    struct MockGameRepository {
        game: Mutex<Option<Game>>,
    }

    #[async_trait]
    impl GameRepository for MockGameRepository {
        async fn save(&self, _game: &Game) -> Result<(), String> {
            Ok(())
        }

        async fn update(&self, _game: &Game) -> Result<(), String> {
            Ok(())
        }

        async fn get_game_by_id(&self, _game_id: &GameId) -> Result<Game, String> {
            self.game
                .lock()
                .unwrap()
                .clone()
                .ok_or_else(|| "Game not found".to_string())
        }

        async fn get_inprogress_games_by_player_id(
            &self,
            _player_id: &str,
        ) -> Result<Vec<Game>, String> {
            Ok(Vec::new())
        }
    }

    struct MockUnitRepository {
        units: Mutex<Vec<Unit>>,
    }

    #[async_trait]
    impl UnitRepository for MockUnitRepository {
        async fn save(&self, _unit: &Unit) -> Result<(), String> {
            Ok(())
        }

        async fn update(&self, _unit: &Unit) -> Result<(), String> {
            Ok(())
        }

        async fn update_units(&self, _units: &Vec<Unit>) -> Result<(), String> {
            Ok(())
        }

        async fn get_game_units(&self, _game_id: &GameId) -> Result<Vec<Unit>, String> {
            Ok(self.units.lock().unwrap().clone())
        }
    }

    struct MockConnectionRepository {
        connection_id: String,
    }

    #[async_trait]
    impl ConnectionRepository for MockConnectionRepository {
        async fn save(&self, _player_id: &str, _connection_id: &str) -> Result<(), String> {
            Ok(())
        }

        async fn get_connection_id(&self, _player_id: &str) -> Result<String, String> {
            Ok(self.connection_id.clone())
        }

        async fn get_player_id_by_connection_id(
            &self,
            _connection_id: &str,
        ) -> Result<Option<String>, String> {
            Ok(None)
        }

        async fn delete_by_connection_id(&self, _connection_id: &str) -> Result<(), String> {
            Ok(())
        }
    }

    struct MockWebSocketSender {
        sent_connection_ids: Mutex<Vec<String>>,
        last_get_game_state: Mutex<Option<CapturedGetGameStateResult>>,
    }

    #[async_trait]
    impl WebSocketSender for MockWebSocketSender {
        async fn send_message(
            &self,
            connection_id: &str,
            response: &WebSocketResponse,
        ) -> Result<(), String> {
            self.sent_connection_ids
                .lock()
                .unwrap()
                .push(connection_id.to_string());

            if let WebSocketResponse::GetGameStateResult {
                enemy_units,
                visibility,
                ..
            } = response
            {
                self.last_get_game_state
                    .lock()
                    .unwrap()
                    .replace(CapturedGetGameStateResult {
                        enemy_units: enemy_units.clone(),
                        visibility: visibility.clone(),
                    });
            }

            Ok(())
        }
    }

    #[allow(dead_code)]
    fn setup_mocks(
        game: Game,
        units: Vec<Unit>,
    ) -> (
        Arc<MockGameRepository>,
        Arc<MockUnitRepository>,
        Arc<MockConnectionRepository>,
        Arc<MockWebSocketSender>,
    ) {
        (
            Arc::new(MockGameRepository {
                game: Mutex::new(Some(game)),
            }),
            Arc::new(MockUnitRepository {
                units: Mutex::new(units),
            }),
            Arc::new(MockConnectionRepository {
                connection_id: "test-connection-id".to_string(),
            }),
            Arc::new(MockWebSocketSender {
                sent_connection_ids: Mutex::new(Vec::new()),
                last_get_game_state: Mutex::new(None),
            }),
        )
    }

    /// テスト用に `Game` を再構築する。
    fn create_test_game(game_id: GameId, player1_id: PlayerId, player2_id: PlayerId) -> Game {
        let field_steps =
            crate::domain::triggergame_simulator::models::game::visibility::Visibility::create()
                .field_steps()
                .clone();
        let visibility = create_simple_visibility_from_field_steps(field_steps);

        Game::reconstruct(
            game_id,
            GameState::initial(),
            GameType::initial(),
            TurnNumber::initial(),
            MotionLabEndTime::initial(),
            player1_id,
            player2_id,
            visibility,
        )
    }

    /// 位置と所持者を指定してテスト用ユニットを作成する。
    fn create_unit(
        game_id: &GameId,
        owner_id: &PlayerId,
        col: i32,
        row: i32,
        main_trigger_id: &str,
    ) -> Unit {
        Unit::create(
            UnitTypeId::new("unit_type_test".to_string()),
            game_id.clone(),
            owner_id.clone(),
            Position::new(col, row),
            TriggerId::new(main_trigger_id.to_string()),
            TriggerId::new("sub_trigger_test".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new(main_trigger_id.to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("sub_trigger_test".to_string())]),
            100,
            100,
            8,
            10,
        )
    }

    /// アクティブな味方ユニットの視界に敵が入る場合、敵DTOが可視状態になることを検証する。
    #[tokio::test]
    async fn test_enemy_units_visible_only_from_active_units() {
        let game_id = GameId::new("550e8400-e29b-41d4-a716-4466554400a1".to_string());
        let friend_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400f1".to_string());
        let enemy_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400e1".to_string());

        let game = create_test_game(
            game_id.clone(),
            friend_player_id.clone(),
            enemy_player_id.clone(),
        );

        let (active_friend, bailed_friend) =
            create_active_and_bailed_out_unit_pair(game_id.clone(), friend_player_id.clone());
        // GameConfig は 36x36。enemy_position 反転後に (5,5) へ来るよう (30,30) を配置する。
        let enemy = create_unit(&game_id, &enemy_player_id, 30, 30, "enemy_main_trigger");

        let units = vec![active_friend, bailed_friend, enemy];
        let (game_repo, unit_repo, connection_repo, websocket_sender) = setup_mocks(game, units);

        let usecase = GetGameStateUseCase::new(
            connection_repo.clone(),
            game_repo.clone(),
            unit_repo.clone(),
            websocket_sender.clone(),
        );

        let result = usecase.execute(game_id, friend_player_id).await;
        assert!(result.is_ok());

        let captured = websocket_sender
            .last_get_game_state
            .lock()
            .unwrap()
            .clone()
            .expect("GetGameStateResult が送信されていません");

        assert_eq!(captured.enemy_units.len(), 1);
        let enemy_dto = &captured.enemy_units[0];
        assert_ne!(enemy_dto.unit_type_id, "UNKNOWN");
        assert_eq!(enemy_dto.position.col(), 30);
        assert_eq!(enemy_dto.position.row(), 30);
        assert!(!enemy_dto.is_bailout);
    }

    /// 味方ユニットが全員ベイルアウト済みのとき、敵が UNKNOWN かつ不可視になることを検証する。
    #[tokio::test]
    async fn test_enemy_units_hidden_when_all_viewers_bailout() {
        let game_id = GameId::new("550e8400-e29b-41d4-a716-4466554400a2".to_string());
        let friend_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400f2".to_string());
        let enemy_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400e2".to_string());

        let game = create_test_game(
            game_id.clone(),
            friend_player_id.clone(),
            enemy_player_id.clone(),
        );

        let (mut friend_a, mut friend_b) =
            create_active_and_bailed_out_unit_pair(game_id.clone(), friend_player_id.clone());
        friend_a.bailout();
        friend_b.bailout();

        let enemy = create_unit(&game_id, &enemy_player_id, 6, 5, "BAGWORM");

        let units = vec![friend_a, friend_b, enemy];
        let (game_repo, unit_repo, connection_repo, websocket_sender) = setup_mocks(game, units);

        let usecase = GetGameStateUseCase::new(
            connection_repo.clone(),
            game_repo.clone(),
            unit_repo.clone(),
            websocket_sender.clone(),
        );

        let result = usecase.execute(game_id, friend_player_id).await;
        assert!(result.is_ok());

        let captured = websocket_sender
            .last_get_game_state
            .lock()
            .unwrap()
            .clone()
            .expect("GetGameStateResult が送信されていません");

        assert_eq!(captured.enemy_units.len(), 1);
        let enemy_dto = &captured.enemy_units[0];
        assert_eq!(enemy_dto.unit_type_id, "UNKNOWN");
        assert_eq!(enemy_dto.position.col(), -1);
        assert_eq!(enemy_dto.position.row(), -1);
        assert!(!captured.visibility[5][6]);
    }

    /// ベイルアウト済み味方ユニットの位置が視界に含まれないことを検証する。
    #[tokio::test]
    async fn test_visibility_excludes_bailed_out_units() {
        let game_id = GameId::new("550e8400-e29b-41d4-a716-4466554400a3".to_string());
        let friend_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400f3".to_string());
        let enemy_player_id = PlayerId::new("550e8400-e29b-41d4-a716-4466554400e3".to_string());

        let game = create_test_game(
            game_id.clone(),
            friend_player_id.clone(),
            enemy_player_id.clone(),
        );

        let active_friend = create_unit(&game_id, &friend_player_id, 1, 1, "friend_main_trigger");
        let mut bailed_friend =
            create_unit(&game_id, &friend_player_id, 10, 10, "friend_main_trigger");
        bailed_friend.bailout();

        let units = vec![active_friend, bailed_friend];
        let (game_repo, unit_repo, connection_repo, websocket_sender) = setup_mocks(game, units);

        let usecase = GetGameStateUseCase::new(
            connection_repo.clone(),
            game_repo.clone(),
            unit_repo.clone(),
            websocket_sender.clone(),
        );

        let result = usecase.execute(game_id, friend_player_id).await;
        assert!(result.is_ok());

        let captured = websocket_sender
            .last_get_game_state
            .lock()
            .unwrap()
            .clone()
            .expect("GetGameStateResult が送信されていません");

        assert!(captured.visibility[1][1]);
        assert!(!captured.visibility[10][10]);
    }
}
