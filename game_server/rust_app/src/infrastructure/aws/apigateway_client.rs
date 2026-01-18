use aws_config::BehaviorVersion;
use aws_sdk_apigatewaymanagement::Client;

/// API Gateway Management API クライアントを作成
pub async fn create_apigateway_client(domain_name: &str, stage: &str) -> Client {
    let mut config_loader = aws_config::defaults(BehaviorVersion::latest());

    if std::env::var("DYNAMODB_ENDPOINT").is_ok() {
        config_loader = config_loader
            .region(aws_config::Region::new("ap-northeast-1"))
            .credentials_provider(aws_credential_types::Credentials::new(
                "dummy",
                "dummy",
                None,
                None,
                "local-provider",
            ));
    }

    let config = config_loader.load().await;

    let endpoint = if let Ok(ws_endpoint) = std::env::var("WEBSOCKET_GATEWAY_ENDPOINT") {
        println!("Using local WebSocket Gateway: {}", ws_endpoint);
        ws_endpoint
    } else {
        println!("Using production WebSocket Gateway");
        format!("https://{}/{}", domain_name, stage)
    };

    let api_config = aws_sdk_apigatewaymanagement::config::Builder::from(&config)
        .endpoint_url(endpoint)
        .build();

    Client::from_conf(api_config)
}
