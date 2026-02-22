#[cfg(test)]
mod tests {
    use crate::domain::{player_management::models::player::player_id::player_id::PlayerId, triggergame_simulator::models::game::game::Game};
	use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
	use crate::domain::triggergame_simulator::models::game::current_turn_number::current_turn_number::CurrentTurnNumber;
    use crate::domain::triggergame_simulator::repositories::game_repository::GameRepository;

    use super::super::game_dynamodb_repository::DynamoDbGameRepository;
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
    use std::collections::HashMap;
    use uuid::Uuid;

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
    async fn test_save_game() {
        let game = Game::new(
            GameId::new(Uuid::new_v4().to_string()),
            CurrentTurnNumber::new(1),
            PlayerId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
        );

        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbGameRepository::new(client);

        let result = repo.save(&game).await;
        assert!(result.is_ok(), "Failed to save game: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_update_game() {
        let game = Game::new(
            GameId::new(Uuid::new_v4().to_string()),
            CurrentTurnNumber::new(2),
            PlayerId::new(Uuid::new_v4().to_string()),
            PlayerId::new(Uuid::new_v4().to_string()),
        );

        let update_item_rule = mock!(Client::update_item)
            .match_requests(|_: &UpdateItemInput| true)
            .then_output(|| UpdateItemOutput::builder().build());

        let client = setup_mock_client(update_item_rule);
        let repo = DynamoDbGameRepository::new(client);

        let result = repo.update_current_turn(&game).await;
        assert!(result.is_ok(), "Failed to update game: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_get_game_by_id_found() {
        let game_id = GameId::new(Uuid::new_v4().to_string());

        let mut item = HashMap::new();
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(game_id.value().to_string()),
        );
        item.insert(
            "current_turn_number".to_string(),
            AttributeValue::N("3".to_string()),
        );
        item.insert(
            "player1_id".to_string(),
            AttributeValue::S(Uuid::new_v4().to_string()),
        );
        item.insert(
            "player2_id".to_string(),
            AttributeValue::S(Uuid::new_v4().to_string()),
        );
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbGameRepository::new(client);

        let result = repo.get_game_by_id(&game_id).await;
        assert!(result.is_ok());
        let game = result.unwrap();
        assert_eq!(game.game_id().value(), game_id.value());
        assert_eq!(game.current_turn_number().value(), 3);
    }
}
