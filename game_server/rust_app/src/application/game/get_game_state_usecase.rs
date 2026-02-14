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
        unit_management::repositories::unit_repository::UnitRepository,
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

        let response = WebSocketResponse::GetGameStateResult {
            current_turn_number: game.current_turn_number().value() as u32,
            enemy_units: EnemyUnitDto::from_units(&enemy_units),
            friend_units: FriendUnitDto::from_units(&friend_units),
        };

        self.websocket_sender
            .send_message(&connection_id, &response)
            .await?;

        // println!("Processing turn for game_id: {}", game_id);
        Ok(())
    }
}
