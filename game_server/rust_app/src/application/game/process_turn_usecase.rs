use std::sync::Arc;

use crate::{
    application::{
        game::{
            pve_turn_resolution_service::PveTurnResolutionService,
            turn_resolution_service::TurnResolutionService,
            turn_submission_service::{SubmissionResult, TurnSubmissionService},
        },
        schedule::schedule_maker::ScheduleMaker,
        websocket::websocket_sender::WebSocketSender,
    },
    domain::{
        player_management::repositories::connection_repository::ConnectionRepository,
        triggergame_simulator::{
            models::{
                game::{
                    game_id::game_id::GameId,
                    game_type::{GameType, GameTypeValue},
                },
                step::step::Step,
                turn::{
                    turn_id::turn_id::TurnId,
                    turn_start_datetime::turn_start_datetime::TurnStartDatetime,
                    turn_status::turn_status::{TurnStatus, TurnStatusValue},
                    Turn,
                },
            },
            repositories::{game_repository::GameRepository, turn_repository::TurnRepository},
            services::enemy_strategy_service::EnemyStrategyService,
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
    schedule_maker: Arc<dyn ScheduleMaker>,
    enemy_strategy_service: Arc<dyn EnemyStrategyService>,
}

impl ProcessTurnUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        game_repository: Arc<dyn GameRepository>,
        turn_repository: Arc<dyn TurnRepository>,
        unit_repository: Arc<dyn UnitRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
        schedule_maker: Arc<dyn ScheduleMaker>,
        enemy_strategy_service: Arc<dyn EnemyStrategyService>,
    ) -> Self {
        Self {
            connection_repository,
            game_repository,
            turn_repository,
            unit_repository,
            websocket_sender,
            schedule_maker,
            enemy_strategy_service,
        }
    }

    pub async fn execute(
        &self,
        game_id: String,
        player_id: String,
        steps: Vec<Step>,
    ) -> Result<(), String> {
        let game_id_obj = GameId::new(game_id.clone());
        let game = self
            .game_repository
            .get_game_by_id(&game_id_obj)
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        match game.game_type().get_value() {
            GameTypeValue::PvP => {
                let submission_service = TurnSubmissionService::new(
                    self.game_repository.clone(),
                    self.turn_repository.clone(),
                );
                let resolution_service = TurnResolutionService::new(
                    self.connection_repository.clone(),
                    self.game_repository.clone(),
                    self.unit_repository.clone(),
                    self.websocket_sender.clone(),
                    self.schedule_maker.clone(),
                );

                match submission_service
                    .accept_submission(game_id, player_id, steps)
                    .await?
                {
                    SubmissionResult::WaitingForOpponent => Ok(()),
                    SubmissionResult::ReadyToResolve {
                        game,
                        player_turn,
                        opponent_turn,
                        game_id,
                        ..
                    } => {
                        resolution_service
                            .resolve_turns(game, game_id, player_turn, opponent_turn)
                            .await
                    }
                }
            }

            GameTypeValue::PvE => {
                let pve_resolution_service = PveTurnResolutionService::new(
                    self.connection_repository.clone(),
                    self.game_repository.clone(),
                    self.unit_repository.clone(),
                    self.websocket_sender.clone(),
                    self.enemy_strategy_service.clone(),
                );

                let turn_id = TurnId::initial();

                let turn = Turn::new(
                    turn_id,
                    game_id_obj.clone(),
                    game.player1_id().clone(),
                    game.current_turn_number().clone(),
                    TurnStartDatetime::initial(),
                    TurnStatus::new(TurnStatusValue::StepSetting),
                    steps,
                );

                pve_resolution_service.resolve_turns(game, turn).await
            }
        }
    }
}
