#[cfg(test)]
mod tests {
    use super::super::turn_dynamodb_repository::DynamoDbTurnRepository;
	use crate::application::game;
use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
	use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
	use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
	use crate::domain::triggergame_simulator::models::turn::turn_id::turn_id::TurnId;
	use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
	use crate::domain::triggergame_simulator::models::turn::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
	use crate::domain::triggergame_simulator::models::turn::turn_status::turn_status::{
		TurnStatus, TurnStatusValue,
	};
	use crate::domain::triggergame_simulator::models::turn::Turn;
	use crate::domain::triggergame_simulator::repositories::turn_repository::TurnRepository;
use crate::infrastructure::dynamodb::test_utils::create_test_unit;
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

    fn create_test_turn() -> Turn {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let turn_start_datetime = TurnStartDatetime::new(Utc::now());
        let turn_status = TurnStatus::new(TurnStatusValue::StepSetting);
        let step = Step::new(StepId::new(Uuid::new_v4().to_string()), vec![], vec![]);

        Turn::new(
            turn_id,
            game_id,
            player_id,
            turn_number,
            turn_start_datetime,
            turn_status,
            vec![step],
        )
    }

    #[tokio::test]
    async fn test_save_turn() {
        let turn = create_test_turn();

        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbTurnRepository::new(client);

        let result = repo.save(&turn).await;
        assert!(result.is_ok(), "Failed to save turn: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_get_turn_data_found() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let turn_id = TurnId::new(
            game_id.value().to_string()
                + "_"
                + &player_id.value().to_string()
                + "_"
                + &turn_number.value().to_string(),
        );
        let start_datetime = Utc::now();

        let step_id = StepId::new(Uuid::new_v4().to_string());
        let action_id1 = Uuid::new_v4().to_string();
        let action_id2 = Uuid::new_v4().to_string();

        // Action1のマップ作成
        let mut action_map1 = HashMap::new();
        action_map1.insert(
            "action_id".to_string(),
            AttributeValue::S(action_id1.clone()),
        );
        action_map1.insert(
            "action_type".to_string(),
            AttributeValue::S("Move".to_string()),
        );
        action_map1.insert(
            "unit_id".to_string(),
            AttributeValue::S(Uuid::new_v4().to_string()),
        );
        action_map1.insert(
            "unit_type_id".to_string(),
            AttributeValue::S("unit_type_001".to_string()),
        );
        action_map1.insert(
            "position_col".to_string(),
            AttributeValue::N("5".to_string()),
        );
        action_map1.insert(
            "position_row".to_string(),
            AttributeValue::N("10".to_string()),
        );
        action_map1.insert(
            "using_main_trigger_id".to_string(),
            AttributeValue::S("trigger_001".to_string()),
        );
        action_map1.insert(
            "using_sub_trigger_id".to_string(),
            AttributeValue::S("trigger_002".to_string()),
        );
        action_map1.insert(
            "main_trigger_azimuth".to_string(),
            AttributeValue::N("0".to_string()),
        );
        action_map1.insert(
            "sub_trigger_azimuth".to_string(),
            AttributeValue::N("90".to_string()),
        );

        // Action2のマップ作成
        let mut action_map2 = HashMap::new();
        action_map2.insert(
            "action_id".to_string(),
            AttributeValue::S(action_id2.clone()),
        );
        action_map2.insert(
            "action_type".to_string(),
            AttributeValue::S("WAIT".to_string()),
        );
        action_map2.insert(
            "unit_id".to_string(),
            AttributeValue::S(Uuid::new_v4().to_string()),
        );
        action_map2.insert(
            "unit_type_id".to_string(),
            AttributeValue::S("unit_type_002".to_string()),
        );
        action_map2.insert(
            "position_col".to_string(),
            AttributeValue::N("3".to_string()),
        );
        action_map2.insert(
            "position_row".to_string(),
            AttributeValue::N("7".to_string()),
        );
        action_map2.insert(
            "using_main_trigger_id".to_string(),
            AttributeValue::S("trigger_003".to_string()),
        );
        action_map2.insert(
            "using_sub_trigger_id".to_string(),
            AttributeValue::S("trigger_004".to_string()),
        );
        action_map2.insert(
            "main_trigger_azimuth".to_string(),
            AttributeValue::N("180".to_string()),
        );
        action_map2.insert(
            "sub_trigger_azimuth".to_string(),
            AttributeValue::N("270".to_string()),
        );

        // Stepのマップ作成
        let mut step_map = HashMap::new();
        step_map.insert(
            "step_id".to_string(),
            AttributeValue::S(step_id.value().to_string()),
        );
        step_map.insert(
            "actions".to_string(),
            AttributeValue::L(vec![
                AttributeValue::M(action_map1),
                AttributeValue::M(action_map2),
            ]),
        );

        let mut item = HashMap::new();
        item.insert(
            "turn_id".to_string(),
            AttributeValue::S(
                game_id.value().to_string()
                    + "_"
                    + &player_id.value().to_string()
                    + "_"
                    + &turn_number.value().to_string(),
            ),
        );
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(game_id.value().to_string()),
        );
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(player_id.value().to_string()),
        );
        item.insert(
            "turn_number".to_string(),
            AttributeValue::N(turn_number.value().to_string()),
        );
        item.insert(
            "turn_start_datetime".to_string(),
            AttributeValue::S(start_datetime.to_rfc3339()),
        );
        item.insert(
            "turn_status".to_string(),
            AttributeValue::S("StepSetting".to_string()),
        );
        item.insert(
            "steps".to_string(),
            AttributeValue::L(vec![AttributeValue::M(step_map)]),
        );

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbTurnRepository::new(client);

        let result = repo.get_turn_data(&game_id, &player_id, &turn_number).await;
        assert!(result.is_ok(), "Failed to get turn: {:?}", result.err());

        let turn = result.unwrap().unwrap();
        assert_eq!(turn.turn_id().value(), turn_id.value());
        assert_eq!(turn.game_id().value(), game_id.value());
        assert_eq!(turn.player_id().value(), player_id.value());
        assert_eq!(turn.turn_number().value(), turn_number.value());
        assert_eq!(turn.steps().len(), 1);
        assert_eq!(turn.steps()[0].actions().len(), 2);
    }

    #[tokio::test]
    async fn test_get_turn_data_not_found() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);

        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(|| QueryOutput::builder().build());

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbTurnRepository::new(client);

        let result = repo.get_turn_data(&game_id, &player_id, &turn_number).await;
        assert_ne!(result.iter().len(), 0);
    }
}
