use std::sync::Arc;

use crate::{
    application::{
        game::{
            self,
            interrupt_game_usecase::{self, InterruptGameUseCase},
        },
        matchmaking::match_cancel_usecase::{self, MatchCancelUseCase},
        websocket::websocket_sender::WebSocketSender,
    },
    domain::{
        matching_management::repositories::matching_repository::MatchingRepository,
        player_management::repositories::connection_repository::ConnectionRepository,
        triggergame_simulator::repositories::game_repository::GameRepository,
    },
};

pub struct DisconnectUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    matching_repository: Arc<dyn MatchingRepository>,
    game_repository: Arc<dyn GameRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

impl DisconnectUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        matching_repository: Arc<dyn MatchingRepository>,
        game_repository: Arc<dyn GameRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            connection_repository,
            matching_repository,
            game_repository,
            websocket_sender,
        }
    }

    /// 切断時の後始末を行う。
    ///
    /// ポリシー:
    /// - 不明な connection_id は成功扱い (no-op)
    /// - マッチング中断は waiting(InProgress) のみ対象
    /// - Completed を Interrupted で上書きしない (repository 側の条件更新)
    /// - 同一 disconnect の再実行は収束する (idempotent)
    pub async fn execute(&self, connection_id: &str) -> Result<(), String> {
        // まずはマッチングの中断を試みる
        let match_cancel_usecase = MatchCancelUseCase::new(
            Arc::clone(&self.connection_repository),
            Arc::clone(&self.matching_repository),
        );
        match_cancel_usecase.execute(connection_id).await?;

        // ゲームの中断を試みる
        let interrupt_game_usecase = InterruptGameUseCase::new(
            Arc::clone(&self.connection_repository),
            Arc::clone(&self.game_repository),
            Arc::clone(&self.websocket_sender),
        );
        interrupt_game_usecase.execute(connection_id).await?;

        self.connection_repository
            .delete_by_connection_id(connection_id)
            .await?;

        Ok(())
    }
}
