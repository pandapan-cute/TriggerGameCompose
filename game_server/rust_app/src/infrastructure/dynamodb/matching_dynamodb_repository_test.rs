#[cfg(test)]
mod tests {
    use crate::domain::{
        matching_management::{
            models::matching::{
                Matching, MatchingEndDatetime, MatchingId, MatchingStartDatetime, MatchingStatus,
                MatchingStatusValue,
            },
            repositories::matching_repository::MatchingRepository,
        },
        player_management::models::player::player_id::player_id::PlayerId,
    };

    use super::super::matching_dynamodb_repository::DynamoDbMatchingRepository;
    use aws_sdk_dynamodb::{
        config::{BehaviorVersion, Region},
        operation::{
            put_item::{PutItemInput, PutItemOutput},
            query::{QueryInput, QueryOutput},
            update_item::{UpdateItemInput, UpdateItemOutput},
        },
        types::AttributeValue,
        Client, Config,
    };
    use aws_smithy_mocks::{mock, MockResponseInterceptor, Rule, RuleMode};
    use chrono::Utc;
    use std::collections::HashMap;
    use uuid::Uuid;

    /// モッククライアントをセットアップ
    fn setup_mock_client(rule: Rule) -> Client {
        let mock_interceptor = MockResponseInterceptor::new()
            .rule_mode(RuleMode::MatchAny)
            .with_rule(&rule);

        let config = Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("ap-northeast-1"))
            .interceptor(mock_interceptor)
            .build();

        Client::from_conf(config)
    }

    #[tokio::test]
    async fn test_save_matching() {
        let datetime = Utc::now();
        let uuid1 = "550e8400-e29b-41d4-a716-446655440001";
        let matching = Matching::new(
            MatchingId::new(Uuid::new_v4().to_string()),
            PlayerId::new(uuid1.to_string()),
            None,
            MatchingStartDatetime::new(datetime),
            MatchingEndDatetime::new(None),
            MatchingStatus::new(MatchingStatusValue::InProgress),
        );

        // PutItemの成功レスポンスをモック
        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbMatchingRepository::new(client);

        let result = repo.save(&matching).await;

        assert!(result.is_ok(), "Failed to save: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_update_matching() {
        let datetime = Utc::now();
        let uuid1 = "550e8400-e29b-41d4-a716-446655440001";
        let uuid2 = "550e8400-e29b-41d4-a716-446655440002";
        let matching = Matching::new(
            MatchingId::new(Uuid::new_v4().to_string()),
            PlayerId::new(uuid1.to_string()),
            Some(PlayerId::new(uuid2.to_string())),
            MatchingStartDatetime::new(datetime),
            MatchingEndDatetime::new(Some(datetime)),
            MatchingStatus::new(MatchingStatusValue::Completed),
        );

        // UpdateItemの成功レスポンスをモック
        let update_item_rule = mock!(Client::update_item)
            .match_requests(|_: &UpdateItemInput| true)
            .then_output(|| UpdateItemOutput::builder().build());

        let client = setup_mock_client(update_item_rule);
        let repo = DynamoDbMatchingRepository::new(client);

        let result = repo.update(&matching).await;
        assert!(result.is_ok(), "Failed to update: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_get_latest_waiting_matching_found() {
        let matching_id = MatchingId::new(Uuid::new_v4().to_string());
        let uuid1 = "550e8400-e29b-41d4-a716-446655440001";
        let player_id = PlayerId::new(uuid1.to_string());
        let datetime = Utc::now();

        // 返却するアイテムを構築
        let mut item = HashMap::new();
        item.insert(
            "matching_id".to_string(),
            AttributeValue::S(matching_id.value().to_string()),
        );
        item.insert(
            "player1_id".to_string(),
            AttributeValue::S(player_id.value().to_string()),
        );
        item.insert(
            "matching_start_datetime".to_string(),
            AttributeValue::S(datetime.to_rfc3339()),
        );
        item.insert(
            "matching_status".to_string(),
            AttributeValue::S("InProgress".to_string()),
        );

        // Query のモックに成功レスポンスを設定
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });
        let client = setup_mock_client(query_rule);
        let repo = DynamoDbMatchingRepository::new(client);

        let result = repo.get_latest_waiting_matching().await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_some());
    }

    #[tokio::test]
    async fn test_get_latest_waiting_matching_not_found() {
        // GetItemでアイテムが見つからないレスポンスをモック
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(|| QueryOutput::builder().build());

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbMatchingRepository::new(client);

        let result = repo.get_latest_waiting_matching().await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}
