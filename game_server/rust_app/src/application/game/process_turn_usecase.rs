use std::sync::Arc;

use crate::{
    application::{
        game,
        websocket::{websocket_response::WebSocketResponse, websocket_sender::WebSocketSender},
    },
    domain::{
        player_management::{
            models::player::player_id::player_id::PlayerId,
            repositories::connection_repository::{self, ConnectionRepository},
        },
        triggergame_simulator::{
            models::{
                game::{game::Game, game_id::game_id::GameId},
                step::step::Step,
                turn::{
                    turn_id::turn_id::TurnId,
                    turn_number::turn_number::TurnNumber,
                    turn_start_datetime::turn_start_datetime::TurnStartDatetime,
                    turn_status::turn_status::{TurnStatus, TurnStatusValue},
                    Turn,
                },
            },
            repositories::{game_repository::GameRepository, turn_repository::TurnRepository},
        },
        unit_management::repositories::unit_repository::UnitRepository,
    },
};

pub struct ProcessTurnUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    game_repository: Arc<dyn GameRepository>,
    turn_repository: Arc<dyn TurnRepository>,
    unit_repository: Arc<dyn UnitRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

impl ProcessTurnUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        turn_repository: Arc<dyn TurnRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            turn_repository,
            unit_repository,
            websocket_sender,
        }
    }

    pub async fn execute(
        &self,
        game_id: String,
        player_id: String,
        steps: Vec<Step>,
    ) -> Result<(), String> {
        let game_id = GameId::new(game_id);
        let player_id = PlayerId::new(player_id);
        // ゲーム情報の取得
        let mut game = self
            .game_repository
            .get_game_by_id(&game_id)
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        // すでに登録されていないか確認
        let turn_data = self
            .turn_repository
            .get_turn_data(
                &game_id,
                &player_id,
                &TurnNumber::new(game.current_turn_number().value()),
            )
            .await?;
        if turn_data.is_some() {
            return Err("このターンの情報はすでに登録されています。".to_string());
        }

        // ターンエンティティの作成
        let mut turn = Turn::new(
            TurnId::new(
                game_id.clone().value().to_string()
                    + "_"
                    + &player_id.value().to_string()
                    + "_"
                    + &game.current_turn_number().value().to_string(),
            ),
            game_id.clone(),
            player_id.clone(),
            TurnNumber::new(game.current_turn_number().value()),
            TurnStartDatetime::new(chrono::Utc::now()),
            TurnStatus::new(TurnStatusValue::StepSetting),
            steps,
        );

        // リクエストされたターンの情報をDBに登録
        self.turn_repository
            .save(&turn)
            .await
            .map_err(|e| format!("ターン情報の登録に失敗しました: {}", e))?;

        // すでに登録済みの対戦相手のターン情報を取得
        let opponent_turn_data = self
            .turn_repository
            .get_turn_data(
                &game_id,
                &game.get_opponent_player_id(&player_id)?,
                &TurnNumber::new(game.current_turn_number().value()),
            )
            .await?;

        // 対戦相手のターン情報が登録済みでなければ何もしないで返す
        if opponent_turn_data.is_none() {
            return Ok(());
        } else {
            println!(
                "対戦相手のターン情報が登録されていることを確認しました ゲームID: {}, プレイヤーID: {}, ターン番号: {:?}",
                game_id.value(),
                game.get_opponent_player_id(&player_id)?.value(),
                TurnNumber::new(game.current_turn_number().value()).value()
            );
        }

        // ユニット情報の取得
        let units = self
            .unit_repository
            .get_game_units(&game_id)
            .await
            .map_err(|e| format!("ユニット情報の取得に失敗しました: {}", e))?;

        // **ターンエンティティの演算処理開始**
        let result_units = turn.turn_start(units, &opponent_turn_data.unwrap())?;

        // ユニット情報の更新
        self.unit_repository
            .update_units(&result_units)
            .await
            .map_err(|e| format!("ユニット情報の更新に失敗しました: {}", e))?;

        // ゲームのターン数を更新
        game.advance_to_next_turn()
            .map_err(|e| format!("ターン数の更新に失敗しました: {}", e))?;
        self.game_repository
            .update_current_turn(&game)
            .await
            .map_err(|e| format!("ゲーム情報の更新に失敗しました: {}", e))?;

        // ターンの完了
        let response = WebSocketResponse::TurnExecutionResult { turn };
        // コネクションの取得
        let player1_connection_id = self
            .connection_repository
            .get_connection_id(game.player1_id().value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        // WebSocket で通知を送信
        self.websocket_sender
            .send_message(&player1_connection_id, &response)
            .await?;

        let player2_connection_id = self
            .connection_repository
            .get_connection_id(game.player2_id().value())
            .await
            .map_err(|e| format!("コネクションIDの取得に失敗しました: {}", e))?;

        self.websocket_sender
            .send_message(&player2_connection_id, &response)
            .await?;

        // println!("Processing turn for game_id: {}", game_id);
        Ok(())
    }
}
