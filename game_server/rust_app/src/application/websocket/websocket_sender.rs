use async_trait::async_trait;

use crate::application::websocket::websocket_response::WebSocketResponse;

/// WebSocket送信のトレイト
/// 実際の送信処理はインフラ層で実装
#[async_trait]
pub trait WebSocketSender: Send + Sync {
    async fn send_message(
        &self,
        connection_id: &str,
        response: &WebSocketResponse,
    ) -> Result<(), String>;
}
