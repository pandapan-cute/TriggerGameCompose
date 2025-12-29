use aws_config::BehaviorVersion;
use aws_sdk_apigatewaymanagement::{Client, primitives::Blob};
use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};

mod domain;

#[derive(Deserialize)]
struct WebSocketEvent {
    #[serde(rename = "requestContext")]
    request_context: RequestContext,
    body: Option<String>,
}

#[derive(Deserialize)]
struct RequestContext {
    #[serde(rename = "connectionId")]
    connection_id: String,
    #[serde(rename = "routeKey")]
    route_key: String,
    #[serde(rename = "domainName")]
    domain_name: String,
    stage: String,
}

#[derive(Serialize)]
struct Response {
    #[serde(rename = "statusCode")]
    status_code: u16,
    body: String,
}

async fn handler(event: LambdaEvent<WebSocketEvent>) -> Result<Response, Error> {
    let (event, _context) = event.into_parts();
    
    // API Gateway Management API クライアントの作成
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let endpoint = format!(
        "https://{}/{}", 
        event.request_context.domain_name,
        event.request_context.stage
    );
    
    let api_config = aws_sdk_apigatewaymanagement::config::Builder::from(&config)
        .endpoint_url(endpoint)
        .build();
    let client = Client::from_conf(api_config);

    // ルートごとの処理
    match event.request_context.route_key.as_str() {
        "$connect" => {
            println!("Client connected: {}", event.request_context.connection_id);
        }
        "$disconnect" => {
            println!("Client disconnected: {}", event.request_context.connection_id);
        }
        "$default" => {
            // メッセージ受信時の処理
            if let Some(body) = event.body {
                println!("Received: {}", body);
                
                // クライアントにメッセージを返送
                let response_message = serde_json::json!({
                    "action": "message",
                    "data": format!("Echo: {}", body)
                });
                
                client.post_to_connection()
                    .connection_id(&event.request_context.connection_id)
                    .data(Blob::new(serde_json::to_vec(&response_message)?))
                    .send()
                    .await?;
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

    lambda_runtime::run(service_fn(handler)).await
}