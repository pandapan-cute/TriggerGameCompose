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
            services::enemy_strategy_service::EnemyStrategyService,
        },
        unit_management::{models::unit::Unit, repositories::unit_repository::UnitRepository},
    },
};

/// 両者提出後のターン解決（演算・永続化・通知）を担当するサービス。
pub struct PveTurnResolutionService {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
    enemy_strategy_service: Arc<dyn EnemyStrategyService>,
}

impl PveTurnResolutionService {
    /// `PveTurnResolutionService` を生成する。
    ///
    /// # Arguments
    /// - `connection_repository`: プレイヤー接続情報取得用リポジトリ。
    /// - `game_repository`: ゲーム情報更新用リポジトリ。
    /// - `unit_repository`: ユニット情報更新用リポジトリ。
    /// - `websocket_sender`: WebSocket 通知送信コンポーネント。
    /// - `enemy_strategy_service`: 敵AI戦略サービス。
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
        enemy_strategy_service: Arc<dyn EnemyStrategyService>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            unit_repository,
            websocket_sender,
            enemy_strategy_service,
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
        mut submitted_turn: Turn,
    ) -> Result<(), String> {
        // ユニット情報の取得
        let mut units = self.load_units(&game.game_id()).await?;

        // PvEの場合、相手ターンはAIのターンとして生成する
        let mut opponent_turn = self.generate_ai_turn(&game, &mut units)?;

        game.turn_start(&mut submitted_turn, &mut opponent_turn, &mut units)?;

        self.persist_units(&units).await?;

        game.advance_to_next_turn()
            .map_err(|e| format!("ターン数の更新に失敗しました: {}", e))?;
        self.persist_game_turn(&game).await?;

        self.notify_turn_result(&submitted_turn).await?;

        Ok(())
    }

    /// AIを使って相手のターン設定を生成する。
    ///
    /// # Arguments
    /// - `game`: ゲーム情報。 (PvEの場合、player1がプレイヤー、player2がAI)
    /// - `units`: ゲームに参加しているユニット情報。
    /// # Returns
    /// - `Turn`: 生成されたAIターン。
    /// - `Err(String)`: 生成失敗。
    fn generate_ai_turn(&self, game: &Game, units: &mut Vec<Unit>) -> Result<Turn, String> {
        let player_units = units
            .iter()
            .filter(|u| u.owner_player_id() == game.player1_id())
            .cloned()
            .collect::<Vec<Unit>>();

        let enemy_units = units
            .iter()
            .filter(|u| u.owner_player_id() == game.player2_id())
            .cloned()
            .collect::<Vec<Unit>>();

        self.enemy_strategy_service
            .generate_ai_turn(player_units, enemy_units)
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
            .update(game)
            .await
            .map_err(|e| format!("ゲーム情報の更新に失敗しました: {}", e))
    }

    /// 解決結果をプレイヤーへ WebSocket 通知する。
    ///
    /// # Arguments
    /// - `player_turn`: プレイヤー向けの解決済みターン。
    ///
    /// # Returns
    /// - `Ok(())`: 通知成功。
    /// - `Err(String)`: 通知失敗。
    async fn notify_turn_result(&self, player_turn: &Turn) -> Result<(), String> {
        let player_connection_id = self
            .connection_repository
            .get_connection_id(player_turn.player_id().value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        // 次の動きの設定の提出時間を作成
        let game_config = GameConfig::get_game_config();
        let motion_lab_end_time = MotionLabEndTime::initial();

        let response_player = WebSocketResponse::TurnExecutionResult {
            turn: player_turn.clone(),
            motion_lab_end_time: motion_lab_end_time.clone(),
        };

        self.websocket_sender
            .send_message(&player_connection_id, &response_player)
            .await?;

        Ok(())
    }
}
