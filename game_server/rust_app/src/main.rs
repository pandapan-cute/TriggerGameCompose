use std::sync::Arc;

use aws_sdk_apigatewaymanagement::primitives::Blob;
use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};

use infrastructure::aws::{
    apigateway_client::create_apigateway_client, dynamodb_client::create_dynamodb_client,
};

use crate::{
    application::{
        matchmaking::matchmaking_application_service::MatchmakingApplicationService,
        websocket::{
            websocket_request::WebSocketRequest, websocket_response::WebSocketResponse,
            websocket_sender::WebSocketSender,
        },
    },
    infrastructure::{
        aws::websocketapi_sender::WebSocketapiSender,
        dynamodb::{
            connection_dynamodb_repository::DynamoDbConnectionRepository,
            matching_dynamodb_repository::DynamoDbMatchingRepository,
        },
    },
};

mod application;
mod domain;
mod infrastructure;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WebSocketEvent {
    #[serde(rename = "requestContext")]
    request_context: RequestContext,
    body: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestContext {
    connection_id: String,
    route_key: String,
    domain_name: String,
    stage: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response {
    status_code: u16,
    body: String,
}

async fn handler(event: LambdaEvent<WebSocketEvent>) -> Result<Response, Error> {
    println!("Received event");
    let (event, _context) = event.into_parts();

    let apigateway_client = create_apigateway_client(
        &event.request_context.domain_name,
        &event.request_context.stage,
    )
    .await;

    // ルートごとの処理
    match event.request_context.route_key.as_str() {
        "$connect" => {
            println!("Client connected: {}", event.request_context.connection_id);
        }
        "$disconnect" => {
            println!(
                "Client disconnected: {}",
                event.request_context.connection_id
            );
        }
        "$default" => {
            // メッセージ受信時の処理
            if let Some(body) = event.body {
                println!("Received: {}", body);

                // WebSocket送信の作成
                let websocket_sender = WebSocketapiSender::new(apigateway_client);

                // メッセージをパース
                let message = match serde_json::from_str::<WebSocketRequest>(&body) {
                    Ok(msg) => msg,
                    Err(e) => {
                        println!("Failed to parse message: {}", e);

                        // エラーレスポンスを返す
                        let error_response = WebSocketResponse::Error {
                            message: format!("Invalid message format: {}", e),
                        };

                        websocket_sender
                            .send_message(&event.request_context.connection_id, &error_response)
                            .await?;

                        return Ok(Response {
                            status_code: 500,
                            body: "message format error".to_string(),
                        });
                    }
                };

                println!("Parsed message: {:?}", message);

                // DynamoDBクライアントの作成
                let dynamo_client = create_dynamodb_client().await;

                // コネクションIDを保存するリポジトリ
                let connection_dynamodb_repository =
                    DynamoDbConnectionRepository::new(dynamo_client.clone());

                // アクションごとの処理
                let response = match message {
                    // NOTE: ここに他のアクションも追加していく
                    // マッチメイキングリクエストの処理
                    WebSocketRequest::Matchmaking { player_id } => {
                        // コネクションIDとPlayerIDの紐付けを保存
                        connection_dynamodb_repository
                            .save(&event.request_context.connection_id, &player_id)
                            .await?;
                        let matching_repository =
                            DynamoDbMatchingRepository::new(dynamo_client.clone());
                        let service = MatchmakingApplicationService::new(
                            Arc::new(matching_repository),
                            Arc::new(websocket_sender),
                        );
                        // マッチメイキング処理を実行
                        match service
                            .execute(&player_id, &event.request_context.connection_id)
                            .await
                        {
                            Ok(result_message) => WebSocketResponse::MatchmakingResult {
                                status: result_message,
                            },
                            Err(err_message) => WebSocketResponse::Error {
                                message: err_message,
                            },
                        }
                    }

                    WebSocketRequest::Ping => WebSocketResponse::Pong,
                };
            }
        }
        _ => {
            println!("Unknown route: {}", event.request_context.route_key);
        }
    }

    Ok(Response {
        status_code: 200,
        body: "OK".to_string(),
    })
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    println!("Starting Lambda...");
    lambda_runtime::run(service_fn(handler)).await
}
