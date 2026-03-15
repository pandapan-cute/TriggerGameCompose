use std::sync::Arc;

use crate::{
    application::{
        game::{
            turn_resolution_service::TurnResolutionService,
            turn_submission_service::{SubmissionResult, TurnSubmissionService},
        },
        websocket::websocket_sender::WebSocketSender,
    },
    domain::{
        player_management::repositories::connection_repository::ConnectionRepository,
        triggergame_simulator::{
            models::step::step::Step,
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
        let submission_service =
            TurnSubmissionService::new(self.game_repository.clone(), self.turn_repository.clone());
        let resolution_service = TurnResolutionService::new(
            self.connection_repository.clone(),
            self.game_repository.clone(),
            self.unit_repository.clone(),
            self.websocket_sender.clone(),
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
}
