use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::Client as DynamoDbClient;

/// DynamoDB クライアントを作成（ローカル/本番を自動判定）
pub async fn create_dynamodb_client() -> DynamoDbClient {
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

    // DynamoDB専用の設定を作成
    if let Ok(endpoint) = std::env::var("DYNAMODB_ENDPOINT") {
        println!("Using custom DynamoDB endpoint: {}", endpoint);
        let dynamodb_config = aws_sdk_dynamodb::config::Builder::from(&config)
            .endpoint_url(endpoint)
            .build();
        DynamoDbClient::from_conf(dynamodb_config)
    } else {
        DynamoDbClient::new(&config)
    }
}
