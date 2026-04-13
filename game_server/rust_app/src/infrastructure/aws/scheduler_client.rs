use aws_config::BehaviorVersion;
use aws_sdk_scheduler::Client as SchedulerClient;

/// EventBridge Scheduler クライアントをラップする構造体。
///
/// 用途:
/// - Scheduler クライアントをDIで渡しやすくする
/// - 生成戦略（ローカル/本番）を集約する
pub struct EventBridgeSchedulerClient {
    client: SchedulerClient,
}

impl EventBridgeSchedulerClient {
    /// ローカル/本番を自動判定してクライアントを生成する。
    pub async fn new() -> Self {
        let client = create_eventbridge_scheduler_client().await;
        Self { client }
    }

    /// 既存クライアントをラップして構造体を生成する。
    pub fn from_client(client: SchedulerClient) -> Self {
        Self { client }
    }

    /// 内部で保持している SDK クライアントを参照する。
    pub fn client(&self) -> &SchedulerClient {
        &self.client
    }
}

/// EventBridge Scheduler クライアントを作成（ローカル/本番を自動判定）
///
/// 判定ルール:
/// - `EVENTBRIDGE_SCHEDULER_ENDPOINT` がある場合: ローカルエンドポイントを使用
/// - ない場合: AWS本番エンドポイントを使用
pub async fn create_eventbridge_scheduler_client() -> SchedulerClient {
    let mut config_loader = aws_config::defaults(BehaviorVersion::latest());

    // ローカル実行時はダミー認証情報とリージョンを明示して解決失敗を回避する。
    if std::env::var("EVENTBRIDGE_SCHEDULER_ENDPOINT").is_ok() {
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

    // Scheduler専用設定を作成する。
    if let Ok(endpoint) = std::env::var("EVENTBRIDGE_SCHEDULER_ENDPOINT") {
        println!("Using custom EventBridge Scheduler endpoint: {}", endpoint);
        let scheduler_config = aws_sdk_scheduler::config::Builder::from(&config)
            .endpoint_url(endpoint)
            .build();
        SchedulerClient::from_conf(scheduler_config)
    } else {
        SchedulerClient::new(&config)
    }
}
