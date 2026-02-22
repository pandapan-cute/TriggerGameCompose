use async_trait::async_trait;
use aws_sdk_apigatewaymanagement::{primitives::Blob, Client};

use crate::application::websocket::{
    websocket_response::WebSocketResponse, websocket_sender::WebSocketSender,
};

pub struct WebSocketapiSender {
    client: Client,
}

impl WebSocketapiSender {
    pub fn new(client: Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl WebSocketSender for WebSocketapiSender {
    /// WebSocketメッセージを送信する
    async fn send_message(
        &self,
        connection_id: &str,
        response: &WebSocketResponse,
    ) -> Result<(), String> {
        let data =
            serde_json::to_vec(response).map_err(|e| format!("Serialization error: {}", e))?;

        self.client
            .post_to_connection()
            .connection_id(connection_id)
            .data(Blob::new(data))
            .send()
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        // デバッグ用ログ
        // println!(
        //     "WebSocketメッセージを送信 {}, {:?}",
        //     connection_id, response
        // );

        Ok(())
    }
}
