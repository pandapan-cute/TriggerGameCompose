use async_trait::async_trait;
use aws_sdk_scheduler::{
    types::{ActionAfterCompletion, FlexibleTimeWindow, FlexibleTimeWindowMode, Target},
    Client as SchedulerClient,
};
use chrono::{DateTime, Utc};
use serde_json::json;

use crate::{
    application::schedule::schedule_maker::ScheduleMaker,
    domain::triggergame_simulator::models::{
        game::game_id::game_id::GameId, turn::turn_number::turn_number::TurnNumber,
    },
    infrastructure::aws::scheduler_client::EventBridgeSchedulerClient,
};

/// EventBridge Scheduler へスケジュールを登録する実装。
pub struct EventBridgeScheduleMaker {
    scheduler_client: SchedulerClient,
    target_arn: String,
    role_arn: String,
    group_name: String,
}

impl EventBridgeScheduleMaker {
    /// 環境変数から必要な設定を読み取り、スケジューラ作成インスタンスを生成する。
    ///
    /// 必須環境変数:
    /// - EVENTBRIDGE_SCHEDULER_TARGET_ARN
    /// - EVENTBRIDGE_SCHEDULER_ROLE_ARN
    ///
    /// 任意環境変数:
    /// - EVENTBRIDGE_SCHEDULER_GROUP_NAME（未指定時は `default`）
    pub async fn new() -> Result<Self, String> {
        let scheduler_client = EventBridgeSchedulerClient::new().await;

        let target_arn = std::env::var("EVENTBRIDGE_SCHEDULER_TARGET_ARN")
            .map_err(|_| "EVENTBRIDGE_SCHEDULER_TARGET_ARN is not set".to_string())?;
        let role_arn = std::env::var("EVENTBRIDGE_SCHEDULER_ROLE_ARN")
            .map_err(|_| "EVENTBRIDGE_SCHEDULER_ROLE_ARN is not set".to_string())?;
        let group_name = std::env::var("EVENTBRIDGE_SCHEDULER_GROUP_NAME")
            .unwrap_or_else(|_| "default".to_string());

        Ok(Self {
            scheduler_client: scheduler_client.client().clone(),
            target_arn,
            role_arn,
            group_name,
        })
    }

    /// テストやDI向けに各依存を明示して生成する。
    pub fn from_client(
        scheduler_client: SchedulerClient,
        target_arn: String,
        role_arn: String,
        group_name: String,
    ) -> Self {
        Self {
            scheduler_client,
            target_arn,
            role_arn,
            group_name,
        }
    }

    fn build_schedule_name(&self, game_id: &GameId, turn_number: &TurnNumber) -> String {
        format!(
            "triggergame-{}-turn-{}",
            game_id.value(),
            turn_number.value()
        )
    }

    fn build_schedule_expression(&self, time: &DateTime<Utc>) -> String {
        // EventBridge Scheduler の at() は秒精度のタイムスタンプ形式を期待する。
        // 例: at(2026-04-13T12:34:56)
        format!("at({})", time.format("%Y-%m-%dT%H:%M:%S"))
    }
}

#[async_trait]
impl ScheduleMaker for EventBridgeScheduleMaker {
    async fn make_schedule_event(
        &self,
        game_id: &GameId,
        turn_number: &TurnNumber,
        time: &DateTime<Utc>,
    ) -> Result<(), String> {
        let schedule_name = self.build_schedule_name(game_id, turn_number);
        let schedule_expression = self.build_schedule_expression(time);

        // スケジュール起動先Lambdaへ渡すペイロード。
        let payload = json!({
            "gameId": game_id.value(),
            "turnNumber": turn_number.value(),
            "eventType": "turnTimeout"
        })
        .to_string();

        let flexible_time_window = FlexibleTimeWindow::builder()
            .mode(FlexibleTimeWindowMode::Off)
            .build()
            .map_err(|e| format!("failed to build flexible time window: {}", e))?;

        let target = Target::builder()
            .arn(&self.target_arn)
            .role_arn(&self.role_arn)
            .input(payload)
            .build()
            .map_err(|e| format!("failed to build schedule target: {}", e))?;

        self.scheduler_client
            .create_schedule()
            .name(schedule_name)
            .group_name(&self.group_name)
            .schedule_expression(schedule_expression)
            .flexible_time_window(flexible_time_window)
            .target(target)
            .action_after_completion(ActionAfterCompletion::Delete)
            .send()
            .await
            .map_err(|e| format!("failed to create schedule event: {}", e))?;

        Ok(())
    }
}
