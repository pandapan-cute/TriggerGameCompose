use crate::{
    application::websocket::{
        websocket_response::WebSocketResponse, websocket_sender::WebSocketSender,
    },
    domain::matching_management::{
        models::matching::{Matching, MatchingStatusValue, PlayerId},
        repositories::matching_repository::MatchingRepository,
    },
};
use std::sync::Arc;

pub struct MatchmakingApplicationService {
    matching_repository: Arc<dyn MatchingRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

/// マッチメイキングアプリケーションサービスの実装
impl MatchmakingApplicationService {
    /// コンストラクタで Repository を注入
    pub fn new(
        matching_repository: Arc<dyn MatchingRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            matching_repository,
            websocket_sender,
        }
    }

    /// マッチメイキング処理を実行するメソッド
    pub async fn execute(&self, player_id: &str) -> Result<MatchingStatusValue, String> {
        println!("Executing matchmaking for player_id: {}", player_id);
        // 待機中のマッチングを取得
        let waiting_matching = self
            .matching_repository
            .get_latest_waiting_matching()
            .await?;

        println!("Waiting matching: {:?}", waiting_matching);

        let (status, response) = match waiting_matching {
            Some(mut matching) => {
                // 既存のマッチングに参加
                let result = matching.matchmaking(PlayerId::new(player_id));
                if result.is_err() {
                    println!(
                        "Error during matchmaking for player_id {}: {:?}",
                        player_id,
                        result.err()
                    );
                }
                let result = self.matching_repository.update(&matching).await;
                if result.is_err() {
                    // 更新失敗時のエラーハンドリング
                    println!(
                        "Error updating matching for player_id {}: {:?}",
                        player_id,
                        result.err()
                    );
                }
                println!("Matching updated successfully for player_id: {}", player_id);
                // マッチング完了を通知
                let response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::Completed,
                };
                (MatchingStatusValue::Completed, response)
            }
            None => {
                // 新規マッチングを作成
                let new_matching = Matching::create(PlayerId::new(player_id));
                // マッチング情報を保存
                let result = self.matching_repository.save(&new_matching).await;
                if result.is_err() {
                    // 保存失敗時のエラーハンドリング
                    return Err(result.err().unwrap());
                }
                // マッチング待機中を通知
                let response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::InProgress,
                };

                (MatchingStatusValue::InProgress, response)
            }
        };

        // WebSocket で通知を送信
        self.websocket_sender
            .send_message(player_id, &response)
            .await?;

        Ok(status)
    }
}
