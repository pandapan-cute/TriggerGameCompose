#[cfg(test)]
mod tests {
    use super::super::connection_dynamodb_repository::DynamoDbConnectionRepository;
    use crate::domain::player_management::repositories::connection_repository::ConnectionRepository;
    use aws_sdk_dynamodb::{
        config::{BehaviorVersion, Region},
        operation::delete_item::{DeleteItemInput, DeleteItemOutput},
        operation::get_item::{GetItemInput, GetItemOutput},
        operation::put_item::{PutItemInput, PutItemOutput},
        operation::query::{QueryInput, QueryOutput},
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

    fn setup_mock_client_with_rules(rules: &[Rule]) -> Client {
        let mut mock_interceptor = MockResponseInterceptor::new().rule_mode(RuleMode::MatchAny);
        for rule in rules {
            mock_interceptor = mock_interceptor.with_rule(rule);
        }

        let config = Config::builder()
            .behavior_version(BehaviorVersion::latest())
            .region(Region::new("ap-northeast-1"))
            .interceptor(mock_interceptor)
            .build();

        Client::from_conf(config)
    }

    #[tokio::test]
    /// Connections テーブルへ player_id と connection_id の紐付けを保存できることを検証する
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
    /// player_id から connection_id を取得できることを検証する
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
    /// 未登録の player_id では期待どおりエラーを返すことを検証する
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

    #[tokio::test]
    /// GSI を使った reverse lookup で connection_id から player_id を取得できることを検証する
    async fn test_get_player_id_by_connection_id_success() {
        let player_id = "550e8400-e29b-41d4-a716-446655440001";
        let connection_id = "test-connection-456";

        let mut item = HashMap::new();
        item.insert(
            "connection_id".to_string(),
            AttributeValue::S(connection_id.to_string()),
        );
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(player_id.to_string()),
        );

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo
            .get_player_id_by_connection_id(connection_id)
            .await
            .expect("reverse lookup should succeed");

        assert_eq!(result.as_deref(), Some(player_id));
    }

    #[tokio::test]
    /// reverse lookup 対象が存在しない場合に None を返すことを検証する
    async fn test_get_player_id_by_connection_id_not_found() {
        let connection_id = "test-connection-456";

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(|| QueryOutput::builder().build());

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo
            .get_player_id_by_connection_id(connection_id)
            .await
            .expect("reverse lookup should succeed");

        assert!(result.is_none());
    }

    #[tokio::test]
    /// reverse lookup 後に対象 connection を削除できることを検証する
    async fn test_delete_by_connection_id_success() {
        let player_id = "550e8400-e29b-41d4-a716-446655440001";
        let connection_id = "test-connection-456";

        let mut item = HashMap::new();
        item.insert(
            "connection_id".to_string(),
            AttributeValue::S(connection_id.to_string()),
        );
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(player_id.to_string()),
        );

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });

        let delete_rule = mock!(Client::delete_item)
            .match_requests(|_: &DeleteItemInput| true)
            .then_output(|| DeleteItemOutput::builder().build());

        let client = setup_mock_client_with_rules(&[query_rule, delete_rule]);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo.delete_by_connection_id(connection_id).await;

        assert!(result.is_ok(), "delete should succeed: {:?}", result.err());
    }

    #[tokio::test]
    /// 削除対象が存在しない場合でも no-op で成功することを検証する
    async fn test_delete_by_connection_id_noop_when_not_found() {
        let connection_id = "test-connection-456";

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(|| QueryOutput::builder().build());

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbConnectionRepository::new(client);

        let result = repo.delete_by_connection_id(connection_id).await;

        assert!(result.is_ok(), "delete no-op should succeed: {:?}", result.err());
    }
}
