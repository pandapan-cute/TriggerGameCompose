#[cfg(test)]
mod tests {
    use super::super::connection_dynamodb_repository::DynamoDbConnectionRepository;
    use crate::domain::player_management::repositories::connection_repository::ConnectionRepository;
    use aws_sdk_dynamodb::{
        config::{BehaviorVersion, Region},
        operation::get_item::{GetItemInput, GetItemOutput},
        operation::put_item::{PutItemInput, PutItemOutput},
        types::AttributeValue,
        Client, Config,
    };
    use aws_smithy_mocks::{mock, MockResponseInterceptor, Rule, RuleMode};
    use std::collections::HashMap;

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
    async fn test_save_connection() {
        let player_id = "550e8400-e29b-41d4-a716-446655440001";
        let connection_id = "test-connection-456";

        // PutItemの成功レスポンスをモック
        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo.save(player_id, connection_id).await;

        assert!(
            result.is_ok(),
            "Failed to save connection: {:?}",
            result.err()
        );
    }

    #[tokio::test]
    async fn test_get_connection_id_success() {
        let player_id = "550e8400-e29b-41d4-a716-446655440001";
        let connection_id = "test-connection-456";

        // GetItemの成功レスポンスをモック
        let mut item = HashMap::new();
        item.insert(
            "connection_id".to_string(),
            AttributeValue::S(connection_id.to_string()),
        );
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(player_id.to_string()),
        );

        let get_item_rule = mock!(Client::get_item)
            .match_requests(|_: &GetItemInput| true)
            .then_output(move || {
                GetItemOutput::builder()
                    .set_item(Some(item.clone()))
                    .build()
            });

        let client = setup_mock_client(get_item_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo.get_connection_id(player_id).await;

        assert!(
            result.is_ok(),
            "Failed to get connection: {:?}",
            result.err()
        );
        assert_eq!(result.unwrap(), connection_id);
    }

    #[tokio::test]
    async fn test_get_connection_id_not_found() {
        let player_id = "550e8400-e29b-41d4-a716-446655440001";
        let connection_id = "test-connection-456";

        // 空の結果を返すGetItemレスポンスをモック
        let get_item_rule = mock!(Client::get_item)
            .match_requests(|_: &GetItemInput| true)
            .then_output(|| GetItemOutput::builder().build());

        let client = setup_mock_client(get_item_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo.get_connection_id(player_id).await;

        assert!(
            result.is_err(),
            "Expected error for non-existent connection"
        );
        assert_eq!(
            result.unwrap_err(),
            format!("Connectionが見つかりません: {}", player_id)
        );
    }
}
