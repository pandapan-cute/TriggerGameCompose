#[cfg(test)]
mod tests {
    use crate::domain::{
        player_management::models::player::player_id::player_id::PlayerId,
        triggergame_simulator::models::game::game_id::game_id::GameId,
        unit_management::{
            models::unit::{
                current_action_points::current_action_points::CurrentActionPoints,
                having_main_trigger_ids::having_main_trigger_ids::HavingMainTriggerIds,
                having_sub_trigger_ids::having_sub_trigger_ids::HavingSubTriggerIds,
                is_bailout::is_bailout::IsBailout, main_trigger_hp::main_trigger_hp::MainTriggerHP,
                position::position::Position, sight_range::sight_range::SightRange,
                sub_trigger_hp::sub_trigger_hp::SubTriggerHP, unit_id::unit_id::UnitId,
                unit_type_id::unit_type_id::UnitTypeId,
                using_main_trigger_id::using_main_trigger_id::UsingMainTriggerId,
                using_sub_trigger_id::using_sub_trigger_id::UsingSubTriggerId,
                wait_time::wait_time::WaitTime, Unit,
            },
            repositories::unit_repository::UnitRepository,
        },
    };

    use super::super::unit_dynamodb_repository::DynamoDbUnitRepository;
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

    /// テスト用のUnitを作成
    fn create_test_unit() -> Unit {
        let game_id = "550e8400-e29b-41d4-a716-446655440000";
        let player_uuid = "550e8400-e29b-41d4-a716-446655440001";
        Unit::create(
            UnitTypeId::new("unit_type_001".to_string()),
            GameId::new(game_id.to_string()),
            PlayerId::new(player_uuid.to_string()),
            Position::new(5, 10),
            HavingMainTriggerIds::new(vec![
                "main_trigger_001".to_string(),
                "main_trigger_002".to_string(),
            ]),
            HavingSubTriggerIds::new(vec![
                "sub_trigger_001".to_string(),
                "sub_trigger_002".to_string(),
            ]),
            100,
            100,
            8,
            13,
        )
    }

    #[tokio::test]
    async fn test_save_unit() {
        let unit = create_test_unit();

        // PutItemの成功レスポンスをモック
        let put_item_rule = mock!(Client::put_item)
            .match_requests(|_: &PutItemInput| true)
            .then_output(|| PutItemOutput::builder().build());

        let client = setup_mock_client(put_item_rule);
        let repo = DynamoDbUnitRepository::new(client);

        let result = repo.save(&unit).await;

        assert!(result.is_ok(), "Failed to save: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_update_unit() {
        let mut unit = create_test_unit();

        // ユニットの状態を更新
        unit.move_to(Position::new(7, 12), 4).unwrap();
        unit.consume_action_points(1).unwrap();

        // UpdateItemの成功レスポンスをモック
        let update_item_rule = mock!(Client::update_item)
            .match_requests(|_: &UpdateItemInput| true)
            .then_output(|| UpdateItemOutput::builder().build());

        let client = setup_mock_client(update_item_rule);
        let repo = DynamoDbUnitRepository::new(client);

        let result = repo.update(&unit).await;
        assert!(result.is_ok(), "Failed to update: {:?}", result.err());
    }

    #[tokio::test]
    async fn test_get_match_units_found() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let unit_id = UnitId::new(Uuid::new_v4().to_string());
        let player_uuid = "550e8400-e29b-41d4-a716-446655440001";

        // 返却するアイテムを構築
        let mut item = HashMap::new();
        item.insert(
            "unit_id".to_string(),
            AttributeValue::S(unit_id.value().to_string()),
        );
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(game_id.value().to_string()),
        );
        item.insert(
            "unit_type_id".to_string(),
            AttributeValue::S("unit_type_001".to_string()),
        );
        item.insert(
            "owner_player_id".to_string(),
            AttributeValue::S(player_uuid.to_string()),
        );
        item.insert(
            "current_action_points".to_string(),
            AttributeValue::N("2".to_string()),
        );
        item.insert("wait_time".to_string(), AttributeValue::N("0".to_string()));

        // Positionオブジェクト
        let mut position_map = HashMap::new();
        position_map.insert("x".to_string(), AttributeValue::N("5".to_string()));
        position_map.insert("y".to_string(), AttributeValue::N("10".to_string()));
        item.insert("position".to_string(), AttributeValue::M(position_map));

        item.insert(
            "having_main_trigger_ids".to_string(),
            AttributeValue::L(vec![
                AttributeValue::S("main_trigger_001".to_string()),
                AttributeValue::S("main_trigger_002".to_string()),
            ]),
        );
        item.insert(
            "having_sub_trigger_ids".to_string(),
            AttributeValue::L(vec![
                AttributeValue::S("sub_trigger_001".to_string()),
                AttributeValue::S("sub_trigger_002".to_string()),
            ]),
        );
        item.insert(
            "main_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item.insert(
            "sub_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item.insert(
            "sight_range".to_string(),
            AttributeValue::N("3".to_string()),
        );
        item.insert("is_bailout".to_string(), AttributeValue::Bool(false));

        // Query のモックに成功レスポンスを設定
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item.clone()]))
                    .build()
            });

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbUnitRepository::new(client);

        let result = repo.get_game_units(game_id).await;
        assert!(result.is_ok(), "Failed to get units: {:?}", result.err());

        let units = result.unwrap();
        assert_eq!(units.len(), 1);
        assert_eq!(units[0].unit_id().value(), unit_id.value());
    }

    #[tokio::test]
    async fn test_get_game_units_not_found() {
        let game_id = GameId::new(Uuid::new_v4().to_string());

        // Query でアイテムが見つからないレスポンスをモック
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(|| QueryOutput::builder().build());

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbUnitRepository::new(client);

        let result = repo.get_game_units(game_id).await;
        assert!(result.is_ok());

        let units = result.unwrap();
        assert_eq!(units.len(), 0);
    }

    #[tokio::test]
    async fn test_get_game_units_multiple_units() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let unit_id_1 = UnitId::new(Uuid::new_v4().to_string());
        let unit_id_2 = UnitId::new(Uuid::new_v4().to_string());
        let player_uuid_1 = "550e8400-e29b-41d4-a716-446655440001";
        let player_uuid_2 = "550e8400-e29b-41d4-a716-446655440002";

        // 1つ目のユニット
        let mut item1 = HashMap::new();
        item1.insert(
            "unit_id".to_string(),
            AttributeValue::S(unit_id_1.value().to_string()),
        );
        item1.insert(
            "game_id".to_string(),
            AttributeValue::S(game_id.value().to_string()),
        );
        item1.insert(
            "unit_type_id".to_string(),
            AttributeValue::S("unit_type_001".to_string()),
        );
        item1.insert(
            "owner_player_id".to_string(),
            AttributeValue::S(player_uuid_1.to_string()),
        );
        item1.insert(
            "current_action_points".to_string(),
            AttributeValue::N("2".to_string()),
        );
        item1.insert("wait_time".to_string(), AttributeValue::N("0".to_string()));
        let mut position_map1 = HashMap::new();
        position_map1.insert("x".to_string(), AttributeValue::N("5".to_string()));
        position_map1.insert("y".to_string(), AttributeValue::N("10".to_string()));
        item1.insert("position".to_string(), AttributeValue::M(position_map1));
        item1.insert(
            "having_main_trigger_ids".to_string(),
            AttributeValue::L(vec![AttributeValue::S("main_trigger_001".to_string())]),
        );
        item1.insert(
            "having_sub_trigger_ids".to_string(),
            AttributeValue::L(vec![AttributeValue::S("sub_trigger_001".to_string())]),
        );
        item1.insert(
            "main_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item1.insert(
            "sub_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item1.insert(
            "sight_range".to_string(),
            AttributeValue::N("3".to_string()),
        );
        item1.insert("is_bailout".to_string(), AttributeValue::Bool(false));

        // 2つ目のユニット
        let mut item2 = HashMap::new();
        item2.insert(
            "unit_id".to_string(),
            AttributeValue::S(unit_id_2.value().to_string()),
        );
        item2.insert(
            "game_id".to_string(),
            AttributeValue::S(game_id.value().to_string()),
        );
        item2.insert(
            "unit_type_id".to_string(),
            AttributeValue::S("unit_type_002".to_string()),
        );
        item2.insert(
            "owner_player_id".to_string(),
            AttributeValue::S(player_uuid_2.to_string()),
        );
        item2.insert(
            "current_action_points".to_string(),
            AttributeValue::N("2".to_string()),
        );
        item2.insert("wait_time".to_string(), AttributeValue::N("0".to_string()));
        let mut position_map2 = HashMap::new();
        position_map2.insert("x".to_string(), AttributeValue::N("8".to_string()));
        position_map2.insert("y".to_string(), AttributeValue::N("15".to_string()));
        item2.insert("position".to_string(), AttributeValue::M(position_map2));
        item2.insert(
            "having_main_trigger_ids".to_string(),
            AttributeValue::L(vec![AttributeValue::S("main_trigger_002".to_string())]),
        );
        item2.insert(
            "having_sub_trigger_ids".to_string(),
            AttributeValue::L(vec![AttributeValue::S("sub_trigger_002".to_string())]),
        );
        item2.insert(
            "main_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item2.insert(
            "sub_trigger_hp".to_string(),
            AttributeValue::N("100".to_string()),
        );
        item2.insert(
            "sight_range".to_string(),
            AttributeValue::N("3".to_string()),
        );
        item2.insert("is_bailout".to_string(), AttributeValue::Bool(false));

        // Query のモックに複数アイテムを返す
        let query_rule = mock!(Client::query)
            .match_requests(|_: &QueryInput| true)
            .then_output(move || {
                QueryOutput::builder()
                    .set_items(Some(vec![item1.clone(), item2.clone()]))
                    .build()
            });

        let client = setup_mock_client(query_rule);
        let repo = DynamoDbUnitRepository::new(client);

        let result = repo.get_game_units(game_id).await;
        assert!(result.is_ok(), "Failed to get units: {:?}", result.err());

        let units = result.unwrap();
        assert_eq!(units.len(), 2);
        assert_eq!(units[0].unit_id().value(), unit_id_1.value());
        assert_eq!(units[1].unit_id().value(), unit_id_2.value());
    }
}
