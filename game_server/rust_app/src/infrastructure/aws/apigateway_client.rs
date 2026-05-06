use aws_config::BehaviorVersion;
use aws_sdk_apigatewaymanagement::Client;

/// API Gateway Management API クライアントを作成
pub async fn create_apigateway_client(domain_name: Option<&str>, stage: Option<&str>) -> Client {
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
    } else if let Ok(ws_management_endpoint) = std::env::var("WEBSOCKET_MANAGEMENT_ENDPOINT") {
        println!(
            "Using deployed WebSocket Management endpoint: {}",
            ws_management_endpoint
        );
        ws_management_endpoint
    } else if let (Some(domain), Some(stage_name)) = (domain_name, stage) {
        println!("Using WebSocket endpoint from request context");
        format!("https://{}/{}", domain, stage_name)
    } else {
        panic!(
            "WebSocket endpoint could not be resolved. Set WEBSOCKET_MANAGEMENT_ENDPOINT or pass request context domain/stage."
        )
    };

    let api_config = aws_sdk_apigatewaymanagement::config::Builder::from(&config)
        .endpoint_url(endpoint)
        .build();

    Client::from_conf(api_config)
}
