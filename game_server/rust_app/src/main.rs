use std::sync::Arc;

use aws_sdk_apigatewaymanagement::primitives::Blob;
use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use infrastructure::aws::{
    apigateway_client::create_apigateway_client, dynamodb_client::create_dynamodb_client,
};

use crate::{
    application::{
        game::{
            get_game_state_usecase::GetGameStateUseCase, process_turn_usecase::ProcessTurnUseCase,
        },
        matchmaking::{
            disconnect_usecase::DisconnectUseCase,
            matchmaking_application_service::MatchmakingApplicationService,
        },
        schedule::{
            motion_lab_limit_usecase::MotionLabLimitUseCase, schedule_maker::ScheduleMaker,
        },
        websocket::{
            websocket_request::WebSocketRequest, websocket_response::WebSocketResponse,
            websocket_sender::WebSocketSender,
        },
    },
    domain::{
        player_management::{
            models::player::player_id::player_id::PlayerId,
            repositories::connection_repository::ConnectionRepository,
        },
        triggergame_simulator::{
            models::game::game_id::game_id::GameId, repositories::game_repository::GameRepository,
        },
    },
    infrastructure::{
        aws::{
            eventbridge_schedule_maker::EventBridgeScheduleMaker,
            websocketapi_sender::WebSocketapiSender,
        },
        dynamodb::{
            connection_dynamodb_repository::DynamoDbConnectionRepository,
            game_dynamodb_repository::DynamoDbGameRepository,
            matching_dynamodb_repository::DynamoDbMatchingRepository,
            turn_dynamodb_repository::DynamoDbTurnRepository,
            unit_dynamodb_repository::DynamoDbUnitRepository,
        },
    },
};

mod application;
mod config;
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

/// WebSocketイベントかどうかを判定する。
fn is_websocket_event(event: &Value) -> bool {
    event
        .get("requestContext")
        .and_then(|request_context| request_context.get("routeKey"))
        .is_some()
}

/// スケジュールイベントかどうかを判定する。
fn is_scheduler_event(event: &Value) -> bool {
    matches!(
        event
            .get("eventType")
            .and_then(|event_type| event_type.as_str()),
        Some("turnTimeout")
    )
}

/// Lambda関数のエントリーポイント。
/// WebSocketイベントとスケジュールイベントの判定はこの関数内で行い、各イベントタイプに応じた処理関数を呼び出す。
async fn handler(event: LambdaEvent<Value>) -> Result<Response, Error> {
    println!("Received event");
    let (event, _context) = event.into_parts();

    if is_websocket_event(&event) {
        let websocket_event: WebSocketEvent = serde_json::from_value(event)?;
        return handle_websocket_event(websocket_event).await;
    }

    if is_scheduler_event(&event) {
        let scheduler_event: SchedulerEvent = serde_json::from_value(event)?;
        return handle_scheduler_event(scheduler_event).await;
    }

    println!("Unsupported event payload: {}", event);

    Ok(Response {
        status_code: 400,
        body: "Unsupported event payload".to_string(),
    })
}

/// WebSocketイベントの処理関数。ルートごとの処理やアクションごとの処理を実装する。
async fn handle_websocket_event(event: WebSocketEvent) -> Result<Response, Error> {
    let apigateway_client = create_apigateway_client(
        Some(&event.request_context.domain_name),
        Some(&event.request_context.stage),
    )
    .await;

    // ルートごとの処理
    match event.request_context.route_key.as_str() {
        "$connect" => {
            println!("Client connected: {}", event.request_context.connection_id);
        }
        "$disconnect" => {
            let connection_id = event.request_context.connection_id.clone();
            println!("Client disconnected: {}", connection_id);

            let dynamo_client = create_dynamodb_client().await;
            let connection_repository = DynamoDbConnectionRepository::new(dynamo_client.clone());
            let matching_repository = DynamoDbMatchingRepository::new(dynamo_client);
            let disconnect_usecase = DisconnectUseCase::new(
                Arc::new(connection_repository),
                Arc::new(matching_repository),
            );

            disconnect_usecase.execute(&connection_id).await.map_err(|e| {
                tracing::error!(connection_id = %connection_id, error = %e, "Disconnect cleanup failed");
                Error::from(e)
            })?;
        }
        "$default" => {
            // メッセージ受信時の処理
            if let Some(body) = event.body {
                // 受信したメッセージのログ出力
                // println!("Received: {}", body);

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

                // パースしたメッセージのログ出力
                // println!("Parsed message: {:?}", message);

                // DynamoDBクライアントの作成
                let dynamo_client = create_dynamodb_client().await;
                // コネクションIDを保存するリポジトリ
                let connection_repository =
                    DynamoDbConnectionRepository::new(dynamo_client.clone());
                // ユニット情報を保存するリポジトリ
                let unit_repository = DynamoDbUnitRepository::new(dynamo_client.clone());
                // ゲーム情報を保存するリポジトリ
                let game_repository = DynamoDbGameRepository::new(dynamo_client.clone());
                // ターン情報を保存するリポジトリ
                let turn_repository = DynamoDbTurnRepository::new(dynamo_client.clone());
                // スケジュールイベント作例用クラス
                let schedule_maker = EventBridgeScheduleMaker::new().await;

                // アクションごとの処理
                match message {
                    // NOTE: ここに他のアクションも追加していく
                    // マッチメイキングリクエストの処理
                    WebSocketRequest::Matchmaking { player_id, units } => {
                        // コネクションIDとPlayerIDの紐付けを保存
                        connection_repository
                            .save(&player_id, &event.request_context.connection_id)
                            .await?;

                        // マッチングリポジトリとサービスの作成
                        let matching_repository =
                            DynamoDbMatchingRepository::new(dynamo_client.clone());
                        let service = MatchmakingApplicationService::new(
                            Arc::new(matching_repository),
                            Arc::new(connection_repository),
                            Arc::new(unit_repository),
                            Arc::new(game_repository),
                            Arc::new(websocket_sender),
                            Arc::new(schedule_maker),
                        );
                        // マッチメイキング処理を実行
                        service
                            .execute(&player_id, &event.request_context.connection_id, units)
                            .await?;
                    }

                    // マッチングキャンセルリクエストの処理
                    WebSocketRequest::CancelMatching {} => {
                        let connection_id = &event.request_context.connection_id;
                        // マッチングリポジトリとサービスの作成
                        let matching_repository =
                            DynamoDbMatchingRepository::new(dynamo_client.clone());
                        let disconnect_usecase = DisconnectUseCase::new(
                            Arc::new(connection_repository),
                            Arc::new(matching_repository),
                        );

                        disconnect_usecase.execute(connection_id).await.map_err(|e| {
                            tracing::error!(connection_id = %connection_id, error = %e, "マッチングのキャンセルに失敗しました");
                            Error::from(e)
                        })?;
                    }

                    // ゲーム状態取得リクエストの処理
                    WebSocketRequest::GetGameState { player_id, game_id } => {
                        // コネクションIDとPlayerIDの紐付けを保存
                        connection_repository
                            .save(player_id.value(), &event.request_context.connection_id)
                            .await?;
                        let service = GetGameStateUseCase::new(
                            Arc::new(connection_repository),
                            Arc::new(game_repository),
                            Arc::new(unit_repository),
                            Arc::new(websocket_sender),
                        );
                        service.execute(game_id, player_id).await?;
                    }

                    // ターン実行リクエストの処理
                    WebSocketRequest::TurnExecution {
                        game_id,
                        player_id,
                        steps,
                    } => {
                        let service = ProcessTurnUseCase::new(
                            Arc::new(connection_repository),
                            Arc::new(game_repository),
                            Arc::new(turn_repository),
                            Arc::new(unit_repository),
                            Arc::new(websocket_sender),
                            Arc::new(schedule_maker),
                        );
                        service.execute(game_id, player_id, steps).await?;
                    }

                    WebSocketRequest::Ping => {
                        // Pongレスポンスを返す
                        let pong_response = WebSocketResponse::Pong;
                        websocket_sender
                            .send_message(&event.request_context.connection_id, &pong_response)
                            .await?;
                    }
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SchedulerEvent {
    game_id: String,
    turn_number: i32,
    event_type: String,
}

/// スケジュールイベントの処理関数。EventBridge Scheduler からのイベントを受け取り、ターンタイムアウト処理を実装する。
async fn handle_scheduler_event(event: SchedulerEvent) -> Result<Response, Error> {
    println!(
        "Received scheduler event: event_type={}, game_id={}, turn_number={}",
        event.event_type, event.game_id, event.turn_number
    );

    let apigateway_client = create_apigateway_client(None, None).await;

    // DynamoDBクライアントの作成
    let dynamo_client = create_dynamodb_client().await;
    // コネクションIDを保存するリポジトリ
    let connection_repository = DynamoDbConnectionRepository::new(dynamo_client.clone());
    // ユニット情報を保存するリポジトリ
    let unit_repository = DynamoDbUnitRepository::new(dynamo_client.clone());
    // ゲーム情報を保存するリポジトリ
    let game_repository = DynamoDbGameRepository::new(dynamo_client.clone());
    // ターン情報を保存するリポジトリ
    let turn_repository = DynamoDbTurnRepository::new(dynamo_client.clone());

    let usecase = MotionLabLimitUseCase::new(
        Arc::new(connection_repository),
        Arc::new(game_repository),
        Arc::new(turn_repository),
        Arc::new(WebSocketapiSender::new(apigateway_client)),
    );

    usecase
        .execute(event.game_id, event.turn_number)
        .await
        .map_err(|e| {
            println!("スケジューライベントの実行に失敗しました: {}", e);
            Error::from(e)
        })?;

    Ok(Response {
        status_code: 200,
        body: "Scheduler event accepted".to_string(),
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
