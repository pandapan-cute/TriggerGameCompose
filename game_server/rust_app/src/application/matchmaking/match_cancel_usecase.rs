use std::sync::Arc;

use crate::domain::{
    matching_management::repositories::matching_repository::MatchingRepository,
    player_management::repositories::connection_repository::ConnectionRepository,
};

pub struct MatchCancelUseCase {
    connection_repository: Arc<dyn ConnectionRepository>,
    matching_repository: Arc<dyn MatchingRepository>,
}

impl MatchCancelUseCase {
    pub fn new(
        connection_repository: Arc<dyn ConnectionRepository>,
        matching_repository: Arc<dyn MatchingRepository>,
    ) -> Self {
        Self {
            connection_repository,
            matching_repository,
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
        let maybe_player_id = self
            .connection_repository
            .get_player_id_by_connection_id(connection_id)
            .await?;

        let Some(player_id) = maybe_player_id else {
            return Ok(());
        };

        self.matching_repository
            .interrupt_waiting_by_player_id(&player_id)
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Default)]
    struct MockConnectionRepository {
        lookup_result: Mutex<Option<String>>,
        deleted_connection_ids: Mutex<Vec<String>>,
    }

    #[async_trait]
    impl ConnectionRepository for MockConnectionRepository {
        async fn save(&self, _player_id: &str, _connection_id: &str) -> Result<(), String> {
            Ok(())
        }

        async fn get_connection_id(&self, _player_id: &str) -> Result<String, String> {
            Err("not used in this test".to_string())
        }

        async fn get_player_id_by_connection_id(
            &self,
            _connection_id: &str,
        ) -> Result<Option<String>, String> {
            Ok(self.lookup_result.lock().unwrap().clone())
        }

        async fn delete_by_connection_id(&self, connection_id: &str) -> Result<(), String> {
            self.deleted_connection_ids
                .lock()
                .unwrap()
                .push(connection_id.to_string());
            self.lookup_result.lock().unwrap().take();
            Ok(())
        }
    }

    #[derive(Default)]
    struct MockMatchingRepository {
        interrupted_player_ids: Mutex<Vec<String>>,
    }

    #[async_trait]
    impl MatchingRepository for MockMatchingRepository {
        async fn save(
            &self,
            _matching: &crate::domain::matching_management::models::matching::Matching,
        ) -> Result<(), String> {
            Ok(())
        }

        async fn update(
            &self,
            _matching: &crate::domain::matching_management::models::matching::Matching,
        ) -> Result<(), String> {
            Ok(())
        }

        async fn get_latest_waiting_matching(
            &self,
        ) -> Result<Option<crate::domain::matching_management::models::matching::Matching>, String>
        {
            Ok(None)
        }

        async fn interrupt_waiting_by_player_id(&self, player_id: &str) -> Result<(), String> {
            self.interrupted_player_ids
                .lock()
                .unwrap()
                .push(player_id.to_string());
            Ok(())
        }
    }

    #[tokio::test]
    /// 未知の connection_id では副作用を起こさず成功終了することを検証する
    async fn execute_unknown_connection_is_noop() {
        let connection_repository = Arc::new(MockConnectionRepository::default());
        let matching_repository = Arc::new(MockMatchingRepository::default());

        let usecase = MatchCancelUseCase::new(connection_repository.clone(), matching_repository);

        let result = usecase.execute("conn-unknown").await;
        assert!(result.is_ok());
        assert!(connection_repository
            .deleted_connection_ids
            .lock()
            .unwrap()
            .is_empty());
    }
}
