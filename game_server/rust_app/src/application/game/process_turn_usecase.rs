use std::sync::Arc;

use crate::{
    application::game::turn_action_dto::TurnActionDto,
    domain::{
        player_management::models::player::player_id::player_id::PlayerId,
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
    },
};

pub struct ProcessTurnUseCase {
    game_repository: Arc<dyn GameRepository>,
    turn_repository: Arc<dyn TurnRepository>,
}

impl ProcessTurnUseCase {
    pub fn new(
        game_repository: Arc<dyn GameRepository>,
        turn_repository: Arc<dyn TurnRepository>,
    ) -> Self {
        Self {
            game_repository,
            turn_repository,
        }
    }

    pub async fn execute(
        &self,
        game_id: GameId,
        player_id: PlayerId,
        steps: Vec<Step>,
    ) -> Result<(), String> {
        // ゲーム情報の取得
        let game = self
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
            TurnStatus::new(TurnStatusValue::UnitStepping),
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
        }

        // プレイヤー1とプレイヤー2のターン情報の結合
        turn.merge(&opponent_turn_data.unwrap())?;

        // ターンエンティティの演算処理開始

        // println!("Processing turn for game_id: {}", game_id);
        Ok(())
    }
}
