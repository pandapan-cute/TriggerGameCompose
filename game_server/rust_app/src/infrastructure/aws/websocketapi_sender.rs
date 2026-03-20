use async_trait::async_trait;
use aws_sdk_apigatewaymanagement::{primitives::Blob, Client};

use crate::{
    application::websocket::{
        websocket_response::WebSocketResponse, websocket_sender::WebSocketSender,
    },
    config::env::AppEnv,
};

const MAX_WEBSOCKET_MESSAGE_BYTES: usize = 32 * 1024;

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
        let payload_len = data.len();

        // API Gateway WebSocket の 1メッセージ上限(32KB)を超えると 413 が返る。
        if payload_len > MAX_WEBSOCKET_MESSAGE_BYTES
            && AppEnv::from_env().unwrap_or(AppEnv::Local) == AppEnv::Prod
        {
            return Err(format!(
                "Failed to send message. connection_id={}, payload_bytes={} exceeds 32KB limit",
                connection_id, payload_len
            ));
        }

        self.client
            .post_to_connection()
            .connection_id(connection_id)
            .data(Blob::new(data))
            .send()
            .await
            .map_err(|e| {
                // `Display` だと "service error" までしか出ないため `Debug` で詳細を残す
                let debug_error = format!("{:?}", e);
                eprintln!(
                    "WebSocket send failed. connection_id={}, payload_bytes={}, detail={}",
                    connection_id, payload_len, debug_error
                );
                format!(
                    "Failed to send message. connection_id={}, payload_bytes={}, detail={}",
                    connection_id, payload_len, debug_error
                )
            })?;

        // デバッグ用ログ
        // println!(
        //     "WebSocketメッセージを送信 {}, {:?}",
        //     connection_id, response
        // );

        Ok(())
    }
}
