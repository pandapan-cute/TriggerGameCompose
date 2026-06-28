use chrono::Utc;

use crate::{
    application::{
        game::{enemy_unit_dto::EnemyUnitDto, friend_unit_dto::FriendUnitDto},
        matchmaking::matchmaking_dto::CreateUnitDto,
        schedule::schedule_maker::ScheduleMaker,
        websocket::{websocket_response::WebSocketResponse, websocket_sender::WebSocketSender},
    },
    domain::{
        matching_management::{
            models::matching::{Matching, MatchingStatusValue},
            repositories::matching_repository::MatchingRepository,
        },
        player_management::{
            models::player::{self, player_id::player_id::PlayerId},
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::{
            configs::game_config::GameConfig,
            models::{
                game::{
                    game::Game, game_id::game_id::GameId, game_state::GameState,
                    game_type::GameType, motion_lab_end_time::MotionLabEndTime, visibility,
                },
                turn::turn_number::turn_number::TurnNumber,
            },
            repositories::game_repository::GameRepository,
        },
        unit_management::{
            models::unit::{
                self, having_trigger_ids::having_trigger_ids::HavingTriggerIds,
                position::position::Position, trigger_id::trigger_id::TriggerId,
                unit_type_id::unit_type_id::UnitTypeId, Unit,
            },
            repositories::unit_repository::UnitRepository,
        },
    },
    infrastructure::dynamodb::connection_dynamodb_repository,
};
use std::sync::Arc;

pub struct PveMatchmakingApplicationService {
    connection_repository: Arc<dyn ConnectionRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    game_repository: Arc<dyn GameRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

/// PvEマッチメイキングアプリケーションサービスの実装
impl PveMatchmakingApplicationService {
    /// コンストラクタで Repository を注入
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        game_repository: Arc<dyn GameRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            unit_repository,
            game_repository,
            websocket_sender,
        }
    }

    /// PvE対戦のマッチメイキング処理を実行するメソッド
    pub async fn execute(
        &self,
        player_id: &str,
        connection_id: &str,
        units: Vec<CreateUnitDto>,
    ) -> Result<(), String> {
        let player_id_obj = PlayerId::new(player_id.to_string());
        // ゲーム情報を登録
        let game_id = GameId::initial();
        let game = Game::new(
            game_id.clone(),
            GameState::initial(),
            GameType::initial_pve(), // PvE用の初期化
            TurnNumber::initial(),
            MotionLabEndTime::initial_matching(),
            player_id_obj.clone(),
            PlayerId::new("00000000-0000-0000-0000-000000000000".to_string()), // AIプレイヤーのIDを仮に設定
        );
        let result = self.game_repository.save(&game).await;
        if result.is_err() {
            return Err(result.err().unwrap());
        }

        println!("Matching updated successfully for player_id: {}", player_id);
        // ユニット情報をエンティティに変換
        let unit_entities: Vec<Unit> = CreateUnitDto::to_units(
            &units,
            &game_id, // GameId をMatchingから生成する
            &player_id_obj,
        );
        // ユニット情報を保存
        self.insert_units(&unit_entities).await?;
        // AIが使う敵ユニット情報を作成して保存
        let enemy_units = self
            .create_and_save_enemy_units(&game_id, &game.player2_id())
            .await?;
        let visibility = game.visibility();
        // マッチング完了を通知
        let response = WebSocketResponse::MatchmakingResult {
            status: MatchingStatusValue::Completed,
            game_id: Some(game_id.value().to_string()),
            motion_lab_end_time: Some(game.motion_lab_end_time().clone()),
            enemy_units: EnemyUnitDto::from_units(&enemy_units, &unit_entities, visibility),
            friend_units: FriendUnitDto::from_units(&unit_entities),
            field_steps: game.visibility().field_steps().to_vec(),
        };
        // WebSocket で通知を送信
        self.websocket_sender
            .send_message(connection_id, &response)
            .await?;

        Ok(())
    }

    /// AIユニット情報を作成、保存するメソッド
    async fn create_and_save_enemy_units(
        &self,
        game_id: &GameId,
        player_id: &PlayerId,
    ) -> Result<Vec<Unit>, String> {
        let mut units: Vec<Unit> = Vec::new();

        let mikumo_osamu = Unit::create(
            UnitTypeId::new("MIKUMO_OSAMU".to_string()),
            game_id.clone(),
            player_id.clone(),
            Position::new(4, 34),
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("ASTEROID".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("RAYGUST".to_string()),
                TriggerId::new("THRUSTER".to_string()),
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("ASTEROID".to_string()),
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("SPIDER".to_string()),
            ]),
            100,
            100,
            8,
            13,
        );
        units.push(mikumo_osamu);

        let kuga_yuma = Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            game_id.clone(),
            player_id.clone(),
            Position::new(12, 34),
            TriggerId::new("SCORPION".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("SCORPION".to_string()),
                TriggerId::new("THRUSTER".to_string()),
                TriggerId::new("GRASSHOPPER".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("SCORPION".to_string()),
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("GRASSHOPPER".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            100,
            100,
            8,
            16,
        );
        units.push(kuga_yuma);

        let amatori_chika = Unit::create(
            UnitTypeId::new("AMATORI_CHIKA".to_string()),
            game_id.clone(),
            player_id.clone(),
            Position::new(20, 34),
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("BAGWORM".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("IBIS".to_string()),
                TriggerId::new("LIGHTNING".to_string()),
                TriggerId::new("HOUND".to_string()),
                TriggerId::new("SHIELD".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("REDBULLET".to_string()),
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            100,
            100,
            8,
            12,
        );
        units.push(amatori_chika);

        let hyuse_kuronin = Unit::create(
            UnitTypeId::new("HYUSE_KURONIN".to_string()),
            game_id.clone(),
            player_id.clone(),
            Position::new(28, 34),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("KOGETSU".to_string()),
                TriggerId::new("SENKU".to_string()),
                TriggerId::new("SHIELD".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("VIPER".to_string()),
                TriggerId::new("ESCUDE".to_string()),
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            100,
            100,
            8,
            15,
        );
        units.push(hyuse_kuronin);

        // ユニット情報を保存
        self.insert_units(&units).await?;
        Ok(units)
    }

    /// ユニット情報を保存するメソッド
    async fn insert_units(&self, units: &Vec<Unit>) -> Result<(), String> {
        for unit in units {
            // ここでユニットの保存処理を実装
            let result = self.unit_repository.save(&unit).await;
            if result.is_err() {
                return Err(result.err().unwrap());
            }
        }
        Ok(())
    }
}
