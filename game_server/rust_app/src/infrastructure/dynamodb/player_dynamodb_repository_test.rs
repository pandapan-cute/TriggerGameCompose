#[cfg(test)]
mod tests {
    use crate::domain::player_management::{
        models::player::{
            mfa_authentication::mfa_authentication::MFAAuthentication,
            player_id::player_id::PlayerId, player_name::player_name::PlayerName,
            registered_datetime::registered_datetime::RegisteredDatetime, Player,
        },
        repositories::player_repository::PlayerRepository,
    };

    use super::super::player_dynamodb_repository::DynamoDbPlayerRepository;
    use aws_sdk_dynamodb::{
        config::{BehaviorVersion, Region},
        operation::get_item::{GetItemInput, GetItemOutput},
        operation::put_item::{PutItemInput, PutItemOutput},
        operation::update_item::{UpdateItemInput, UpdateItemOutput},
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
    async fn test_save_player() {
        let datetime = Utc::now();
        let player = Player::new(
            PlayerId::new(Uuid::new_v4().to_string()),
            PlayerName::new("テストプレイヤー".to_string()),
            RegisteredDatetime::new(datetime),
            MFAAuthentication::new(false),
        );

        // PutItemの成功レスポンスをモック
        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbPlayerRepository::new(client);

        let result = repo.save(&player).await;

        assert!(result.is_ok(), "Failed to save: {:?}", result.err());
    }
}
