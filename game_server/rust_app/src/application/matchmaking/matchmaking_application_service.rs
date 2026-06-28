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
            models::player::player_id::player_id::PlayerId,
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
            models::unit::{self, Unit},
            repositories::unit_repository::UnitRepository,
        },
    },
    infrastructure::dynamodb::connection_dynamodb_repository,
};
use std::sync::Arc;

pub struct MatchmakingApplicationService {
    matching_repository: Arc<dyn MatchingRepository>,
    connection_repository: Arc<dyn ConnectionRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    game_repository: Arc<dyn GameRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
    schedule_maker: Arc<dyn ScheduleMaker>,
}

/// マッチメイキングアプリケーションサービスの実装
impl MatchmakingApplicationService {
    /// コンストラクタで Repository を注入
    pub fn new(
        matching_repository: Arc<dyn MatchingRepository>,
        connection_repository: Arc<dyn ConnectionRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        game_repository: Arc<dyn GameRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
        schedule_maker: Arc<dyn ScheduleMaker>,
    ) -> Self {
        Self {
            matching_repository,
            connection_repository,
            unit_repository,
            game_repository,
            websocket_sender,
            schedule_maker,
        }
    }

    /// マッチメイキング処理を実行するメソッド
    pub async fn execute(
        &self,
        player_id: &str,
        connection_id: &str,
        units: Vec<CreateUnitDto>,
    ) -> Result<(), String> {
        println!("Executing matchmaking for player_id: {}", player_id);
        // 待機中のマッチングを取得
        let waiting_matching = self
            .matching_repository
            .get_latest_waiting_matching()
            .await?;

        println!("Waiting matching: {:?}", waiting_matching);

        match waiting_matching {
            Some(mut matching) => {
                println!(
                    "プレイヤー１のID: {}、プレイヤー２のID: {}",
                    matching.player1_id().value(),
                    player_id
                );
                if matching.player1_id().value().eq(player_id) {
                    // 自分自身のマッチングには参加できない
                    let response = WebSocketResponse::MatchmakingResult {
                        status: MatchingStatusValue::InProgress,
                        game_id: None,
                        motion_lab_end_time: None,
                        enemy_units: vec![],
                        friend_units: vec![],
                        field_steps: vec![],
                    };
                    // WebSocket で通知を送信
                    self.websocket_sender
                        .send_message(connection_id, &response)
                        .await?;
                    return Ok(());
                }

                // 既存のマッチングに参加
                let result = matching
                    .matchmaking(PlayerId::new(player_id.to_string()))
                    .map_err(|e| {
                        format!(
                            "マッチング参加に失敗しました。player_id: {}, error: {}",
                            player_id, e
                        )
                    });
                if result.is_err() {
                    return Err(result.err().unwrap());
                }
                let result = self.matching_repository.update(&matching).await;
                if result.is_err() {
                    // 更新失敗時のエラーハンドリング
                    return Err(result.err().unwrap());
                }
                // ゲーム情報を登録
                let game_id = GameId::new(matching.matching_id().value().to_string());
                let game = Game::new(
                    game_id.clone(),
                    GameState::initial(),
                    GameType::initial(), // PvP用の初期化
                    TurnNumber::initial(),
                    MotionLabEndTime::initial_matching(),
                    matching.player1_id().clone(),
                    PlayerId::new(player_id.to_string()),
                );
                let result = self.game_repository.save(&game).await;
                if result.is_err() {
                    return Err(result.err().unwrap());
                }

                println!("Matching updated successfully for player_id: {}", player_id);
                // ユニット情報をエンティティに変換
                let unit_entities: Vec<Unit> = CreateUnitDto::to_units(
                    &units,
                    &GameId::new(matching.matching_id().value().to_string()), // GameId をMatchingから生成する
                    &PlayerId::new(player_id.to_string()),
                );
                // すでに登録済みの敵ユニット情報を取得
                let enemy_units = self
                    .unit_repository
                    .get_game_units(&GameId::new(matching.matching_id().value().to_string()))
                    .await?;
                // ユニット情報を保存
                self.insert_units(&unit_entities).await?;
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

                // 対戦相手のコネクションIDを取得
                let opponent_player_id = matching.player1_id().value();
                let opponent_connection_id = self
                    .connection_repository
                    .get_connection_id(opponent_player_id)
                    .await?;
                // 対戦相手にマッチング完了を通知
                let opponent_response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::Completed,
                    game_id: Some(game_id.value().to_string()),
                    motion_lab_end_time: Some(game.motion_lab_end_time().clone()),
                    enemy_units: EnemyUnitDto::from_units(&enemy_units, &unit_entities, visibility),
                    friend_units: FriendUnitDto::from_units(&enemy_units),
                    field_steps: game.visibility().field_steps().to_vec(),
                };
                self.websocket_sender
                    .send_message(&opponent_connection_id, &opponent_response)
                    .await?;
                // 次の動きの設定の締切タイマーをセット
                self.set_motion_lab_timer(&game_id, &TurnNumber::initial())
                    .await?;
            }
            None => {
                // 新規マッチングを作成
                let new_matching = Matching::create(PlayerId::new(player_id.to_string()));
                // マッチング情報を保存
                let result = self.matching_repository.save(&new_matching).await;
                if result.is_err() {
                    // 保存失敗時のエラーハンドリング
                    return Err(result.err().unwrap());
                }
                // ユニット情報をエンティティに変換
                let unit_entities: Vec<Unit> = CreateUnitDto::to_units(
                    &units,
                    &GameId::new(new_matching.matching_id().value().to_string()), // GameId をMatchingから生成する
                    &PlayerId::new(player_id.to_string()),
                );
                // ユニット情報を保存
                self.insert_units(&unit_entities).await?;
                // マッチング待機中を通知
                let response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::InProgress,
                    game_id: None,
                    motion_lab_end_time: None,
                    enemy_units: vec![],
                    friend_units: vec![],
                    field_steps: vec![],
                };
                // WebSocket で通知を送信
                self.websocket_sender
                    .send_message(connection_id, &response)
                    .await?;
            }
        };
        Ok(())
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

    /// 次ターンの動きの設定締切タイマーをセットする。
    /// NOTE: turn_resolution_service.rsにも同様の処理があるので同期に注意
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
        // 次の動きの設定の提出時間を作成
        let game_config = GameConfig::get_game_config();
        // マッチング時は動きの設定時間+通信待機時間、2ターン目以降は動きの設定時間+ユニットの行動時間+通信待機時間を加算する
        let motion_lab_limit_time = Utc::now()
            + chrono::Duration::seconds(
                game_config.motion_lab_seconds() + game_config.communication_wait_seconds(),
            );

        self.schedule_maker
            .make_schedule_event(game_id, turn_number, &motion_lab_limit_time)
            .await?;
        Ok(())
    }
}
