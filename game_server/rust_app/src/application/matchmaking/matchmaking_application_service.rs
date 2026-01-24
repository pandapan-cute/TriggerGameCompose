use crate::{
    application::websocket::{
        websocket_response::WebSocketResponse, websocket_sender::WebSocketSender,
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
    },
    infrastructure::dynamodb::connection_dynamodb_repository,
};
use std::sync::Arc;

pub struct MatchmakingApplicationService {
    matching_repository: Arc<dyn MatchingRepository>,
    connection_repository: Arc<dyn ConnectionRepository>,
    websocket_sender: Arc<dyn WebSocketSender>,
}

/// マッチメイキングアプリケーションサービスの実装
impl MatchmakingApplicationService {
    /// コンストラクタで Repository を注入
    pub fn new(
        matching_repository: Arc<dyn MatchingRepository>,
        connection_repository: Arc<dyn ConnectionRepository>,
        websocket_sender: Arc<dyn WebSocketSender>,
    ) -> Self {
        Self {
            matching_repository,
            connection_repository,
            websocket_sender,
        }
    }

    /// マッチメイキング処理を実行するメソッド
    pub async fn execute(&self, player_id: &str, connection_id: &str) -> Result<(), String> {
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
                println!("Matching updated successfully for player_id: {}", player_id);
                // マッチング完了を通知
                let response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::Completed,
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
                };
                self.websocket_sender
                    .send_message(&opponent_connection_id, &opponent_response)
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
                // マッチング待機中を通知
                let response = WebSocketResponse::MatchmakingResult {
                    status: MatchingStatusValue::InProgress,
                };
                // WebSocket で通知を送信
                self.websocket_sender
                    .send_message(connection_id, &response)
                    .await?;
            }
        };
        Ok(())
    }
}
