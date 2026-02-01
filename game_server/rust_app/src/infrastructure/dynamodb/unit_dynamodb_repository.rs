// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::domain::matching_management::models::matching::{
    matching_id, Matching, MatchingEndDatetime, MatchingId, MatchingStartDatetime, MatchingStatus,
    MatchingStatusValue,
};
use crate::domain::matching_management::repositories::matching_repository::MatchingRepository;
use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::having_main_trigger_ids::having_main_trigger_ids::HavingMainTriggerIds;
use crate::domain::unit_management::models::unit::having_sub_trigger_ids::having_sub_trigger_ids::HavingSubTriggerIds;
use crate::domain::unit_management::models::unit::is_bailout::is_bailout::IsBailout;
use crate::domain::unit_management::models::unit::main_trigger_hp::main_trigger_hp::MainTriggerHP;
use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::unit_management::models::unit::sight_range::sight_range::SightRange;
use crate::domain::unit_management::models::unit::sub_trigger_hp::sub_trigger_hp::SubTriggerHP;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;
use crate::domain::unit_management::models::unit::using_main_trigger_id::using_main_trigger_id::UsingMainTriggerId;
use crate::domain::unit_management::models::unit::using_sub_trigger_id::using_sub_trigger_id::UsingSubTriggerId;
use crate::domain::unit_management::models::unit::wait_time::wait_time::WaitTime;
use crate::domain::unit_management::models::unit::Unit;
use crate::domain::unit_management::repositories::unit_repository::UnitRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

pub struct DynamoDbUnitRepository {
    client: DynamoDbClient,
    units_table: &'static str,
}

impl DynamoDbUnitRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        // テーブル名
        const UNITS_TABLE_NAME: &str = "Units";
        Self {
            client: client,
            units_table: UNITS_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Playerを属性値マップに変換
    fn unit_to_item(&self, unit: &Unit) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "unit_id".to_string(),
            AttributeValue::S(unit.unit_id().value().to_string()),
        );
        item.insert(
            "unit_type_id".to_string(),
            AttributeValue::S(unit.unit_type_id().value().to_string()),
        );
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(unit.game_id().value().to_string()),
        );
        item.insert(
            "owner_player_id".to_string(),
            AttributeValue::S(unit.owner_player_id().value().to_string()),
        );
        item.insert(
            "current_action_points".to_string(),
            AttributeValue::N(unit.current_action_points().value().to_string()),
        );
        item.insert(
            "wait_time".to_string(),
            AttributeValue::N(unit.wait_time().value().to_string()),
        );
        // ポジションのオブジェクトを作る
        let mut position_map = HashMap::new();
        position_map.insert(
            "x".to_string(),
            AttributeValue::N(unit.position().x().to_string()),
        );
        position_map.insert(
            "y".to_string(),
            AttributeValue::N(unit.position().y().to_string()),
        );
        item.insert("position".to_string(), AttributeValue::M(position_map));
        item.insert(
            "using_main_trigger_id".to_string(),
            AttributeValue::S(unit.using_main_trigger_id().value().to_string()),
        );
        item.insert(
            "using_sub_trigger_id".to_string(),
            AttributeValue::S(unit.using_sub_trigger_id().value().to_string()),
        );
        item.insert(
            "having_main_trigger_ids".to_string(),
            AttributeValue::L(
                unit.having_main_trigger_ids()
                    .value()
                    .iter()
                    .map(|id| AttributeValue::S(id.to_string()))
                    .collect(),
            ),
        );
        item.insert(
            "having_sub_trigger_ids".to_string(),
            AttributeValue::L(
                unit.having_sub_trigger_ids()
                    .value()
                    .iter()
                    .map(|id| AttributeValue::S(id.to_string()))
                    .collect(),
            ),
        );
        item.insert(
            "main_trigger_hp".to_string(),
            AttributeValue::N(unit.main_trigger_hp().value().to_string()),
        );
        item.insert(
            "sub_trigger_hp".to_string(),
            AttributeValue::N(unit.sub_trigger_hp().value().to_string()),
        );
        item.insert(
            "sight_range".to_string(),
            AttributeValue::N(unit.sight_range().value().to_string()),
        );
        item.insert(
            "is_bailout".to_string(),
            AttributeValue::Bool(unit.is_bailed_out()),
        );
        item
    }

    /// ヘルパーメソッド：DynamoDBから取得したデータをUnitエンティティに変換
    fn from_dynamo_db_to_unit(
        &self,
        item: &HashMap<String, AttributeValue>,
    ) -> Result<Unit, String> {
        let unit_id = UnitId::new(
            item.get("unit_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("unit_id not found or invalid")?
                .to_string(),
        );

        let unit_type_id = UnitTypeId::new(
            item.get("unit_type_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("unit_type_id not found or invalid")?
                .to_string(),
        );

        let game_id = GameId::new(
            item.get("game_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("game_id not found or invalid")?
                .to_string(),
        );

        let owner_player_id = PlayerId::new(
            item.get("owner_player_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("owner_player_id not found or invalid")?
                .to_string(),
        );

        let current_action_points = CurrentActionPoints::new(
            item.get("current_action_points")
                .and_then(|v| v.as_n().ok())
                .and_then(|n| n.parse::<i32>().ok())
                .ok_or("current_action_points not found or invalid")?,
        );

        let wait_time = WaitTime::new(
            item.get("wait_time")
                .and_then(|v| v.as_n().ok())
                .and_then(|n| n.parse::<i32>().ok())
                .ok_or("wait_time not found or invalid")?,
        );

        let position_map = item
            .get("position")
            .and_then(|v| v.as_m().ok())
            .ok_or("position not found or invalid")?;
        let x = position_map
            .get("x")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .ok_or("position.x not found or invalid")?;
        let y = position_map
            .get("y")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse::<i32>().ok())
            .ok_or("position.y not found or invalid")?;
        let position = Position::new(x, y);

        let using_main_trigger_id = UsingMainTriggerId::new(
            item.get("using_main_trigger_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("using_main_trigger_id not found or invalid")?
                .to_string(),
        );

        let using_sub_trigger_id = UsingSubTriggerId::new(
            item.get("using_sub_trigger_id")
                .and_then(|v| v.as_s().ok())
                .ok_or("using_sub_trigger_id not found or invalid")?
                .to_string(),
        );

        let having_main_trigger_ids = HavingMainTriggerIds::new(
            item.get("having_main_trigger_ids")
                .and_then(|v| v.as_l().ok())
                .ok_or("having_main_trigger_ids not found or invalid")?
                .iter()
                .filter_map(|v| v.as_s().ok())
                .map(|s| s.to_string())
                .collect(),
        );

        let having_sub_trigger_ids = HavingSubTriggerIds::new(
            item.get("having_sub_trigger_ids")
                .and_then(|v| v.as_l().ok())
                .ok_or("having_sub_trigger_ids not found or invalid")?
                .iter()
                .filter_map(|v| v.as_s().ok())
                .map(|s| s.to_string())
                .collect(),
        );

        let main_trigger_hp = MainTriggerHP::new(
            item.get("main_trigger_hp")
                .and_then(|v| v.as_n().ok())
                .and_then(|n| n.parse::<i32>().ok())
                .ok_or("main_trigger_hp not found or invalid")?,
        );

        let sub_trigger_hp = SubTriggerHP::new(
            item.get("sub_trigger_hp")
                .and_then(|v| v.as_n().ok())
                .and_then(|n| n.parse::<i32>().ok())
                .ok_or("sub_trigger_hp not found or invalid")?,
        );

        let sight_range = SightRange::new(
            item.get("sight_range")
                .and_then(|v| v.as_n().ok())
                .and_then(|n| n.parse::<i32>().ok())
                .ok_or("sight_range not found or invalid")?,
        );

        let is_bailout = IsBailout::new(
            item.get("is_bailout")
                .and_then(|v| v.as_bool().ok())
                .copied()
                .ok_or("is_bailout not found or invalid")?,
        );

        Ok(Unit::reconstruct(
            unit_id,
            unit_type_id,
            game_id,
            owner_player_id,
            current_action_points,
            wait_time,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp,
            sub_trigger_hp,
            sight_range,
            is_bailout,
        ))
    }
}

#[async_trait]
impl UnitRepository for DynamoDbUnitRepository {
    /// ユニット情報の保存
    async fn save(&self, unit: &Unit) -> Result<(), String> {
        // Unitアイテムを保存
        let unit_item = self.unit_to_item(unit);
        self.client
            .put_item()
            .table_name(self.units_table)
            .set_item(Some(unit_item))
            .send()
            .await
            .map_err(|e| format!("ユニット情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    async fn update(&self, unit: &Unit) -> Result<(), String> {
        // DynamoDBでは put_item で上書き更新
        // または update_item を使用して部分更新

        // UPDATE式を動的に構築
        let update_parts = vec![
            "using_main_trigger_id = :using_main_trigger_id",
            "using_sub_trigger_id = :using_sub_trigger_id",
            "current_action_points = :current_action_points",
            "position = :position",
            "sight_range = :sight_range",
            "is_bailout = :is_bailout",
        ];

        let update_expression = format!("SET {}", update_parts.join(", "));

        // ポジションのオブジェクトを作る
        let mut position_map = HashMap::new();
        position_map.insert(
            "x".to_string(),
            AttributeValue::N(unit.position().x().to_string()),
        );
        position_map.insert(
            "y".to_string(),
            AttributeValue::N(unit.position().y().to_string()),
        );

        let request = self
            .client
            .update_item()
            .table_name(self.units_table)
            .key(
                "unit_id",
                AttributeValue::S(unit.unit_id().value().to_string()),
            )
            .update_expression(update_expression)
            .expression_attribute_values(
                ":current_action_points",
                AttributeValue::N(unit.current_action_points().value().to_string()),
            )
            .expression_attribute_values(":position", AttributeValue::M(position_map))
            .expression_attribute_values(
                ":sight_range",
                AttributeValue::N(unit.sight_range().value().to_string()),
            )
            .expression_attribute_values(":is_bailout", AttributeValue::Bool(unit.is_bailed_out()))
            .expression_attribute_values(
                ":using_main_trigger_id",
                AttributeValue::S(unit.using_main_trigger_id().value().to_string()),
            )
            .expression_attribute_values(
                ":using_sub_trigger_id",
                AttributeValue::S(unit.using_sub_trigger_id().value().to_string()),
            );

        let _ = request.send().await.map_err(|e| {
            println!("Failed to update matching: {}", e);

            // SDK のエラー詳細も出力
            if let Some(service_error) = e.as_service_error() {
                eprintln!("Service Error: {:?}", service_error);
            }
        });

        Ok(())
    }

    /// 対戦のユニットを一覧取得
    async fn get_game_units(&self, game_id: GameId) -> Result<Vec<Unit>, String> {
        println!("Querying for latest waiting matching...");
        // Unitアイテムを取得
        // GSIを使用してgame_idを指定したデータを取得
        let result = self
            .client
            .query()
            .table_name(self.units_table)
            .index_name("GameIdIndex") // GSI名
            .key_condition_expression("game_id = :game_id")
            .expression_attribute_values(":game_id", AttributeValue::S(game_id.value().to_string()))
            .send()
            .await
            .map_err(|e| format!("Failed to query matching: {}", e))?;
        println!("Query result: {:?}", result);

        let items = result.items();
        if items.is_empty() {
            return Ok(vec![]);
        }
        let mut units: Vec<Unit> = Vec::new();
        for unit_item in items {
            // アイテムをUnitオブジェクトに変換
            let unit = self.from_dynamo_db_to_unit(unit_item)?;
            units.push(unit);
        }
        Ok(units)
    }
}
