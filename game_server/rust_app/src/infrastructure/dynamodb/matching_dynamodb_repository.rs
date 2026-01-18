// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::domain::matching_management::models::matching::{
    Matching, MatchingEndDatetime, MatchingId, MatchingStartDatetime, MatchingStatus,
    MatchingStatusValue, PlayerId,
};
use crate::domain::matching_management::repositories::matching_repository::MatchingRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

pub struct DynamoDbMatchingRepository {
    client: DynamoDbClient,
    matchings_table: &'static str,
}

impl DynamoDbMatchingRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        // テーブル名
        const MATCHINGS_TABLE_NAME: &str = "Matchings";
        Self {
            client: client,
            matchings_table: MATCHINGS_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Playerを属性値マップに変換
    fn matching_to_item(&self, matching: &Matching) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "matching_id".to_string(),
            AttributeValue::S(matching.matching_id().value().to_string()),
        );
        item.insert(
            "player1_id".to_string(),
            AttributeValue::S(matching.player1_id().value().to_string()),
        );
        matching.player2_id().clone().map(|player2_id| {
            item.insert(
                "player2_id".to_string(),
                AttributeValue::S(player2_id.value().to_string()),
            );
        });
        item.insert(
            "matching_start_datetime".to_string(),
            AttributeValue::S(matching.matching_start_datetime().to_rfc3339()),
        );
        // matching_end_datetimeはOption型なので、存在する場合のみ保存
        matching.matching_end_datetime().to_rfc3339().map(|dt_str| {
            item.insert(
                "matching_end_datetime".to_string(),
                AttributeValue::S(dt_str),
            );
        });
        item.insert(
            "matching_status".to_string(),
            AttributeValue::S(matching.matching_status().value().to_string()),
        );
        item
    }
}

#[async_trait]
impl MatchingRepository for DynamoDbMatchingRepository {
    async fn save(&self, matching: &Matching) -> Result<(), String> {
        // Matchingアイテムを保存
        let matching_item = self.matching_to_item(matching);
        self.client
            .put_item()
            .table_name(self.matchings_table)
            .set_item(Some(matching_item))
            .send()
            .await
            .map_err(|e| format!("マッチング情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    async fn update(&self, matching: &Matching) -> Result<(), String> {
        // DynamoDBでは put_item で上書き更新
        // または update_item を使用して部分更新

        // UPDATE式を動的に構築
        let mut update_parts = vec![
            "player1_id = :player1_id",
            "matching_start_datetime = :start_datetime",
            "matching_status = :status",
        ];

        if matching.player2_id().is_some() {
            update_parts.push("player2_id = :player2_id");
        }

        if matching.matching_end_datetime().value().is_some() {
            update_parts.push("matching_end_datetime = :end_datetime");
        }

        let update_expression = format!("SET {}", update_parts.join(", "));

        let mut request = self
            .client
            .update_item()
            .table_name(self.matchings_table)
            .key(
                "matching_id",
                AttributeValue::S(matching.matching_id().value().to_string()),
            )
            .update_expression(update_expression)
            .expression_attribute_values(
                ":player1_id",
                AttributeValue::S(matching.player1_id().value().to_string()),
            )
            .expression_attribute_values(
                ":start_datetime",
                AttributeValue::S(matching.matching_start_datetime().to_rfc3339()),
            )
            .expression_attribute_values(
                ":status",
                AttributeValue::S(matching.matching_status().value().to_string()),
            );

        // Option型のフィールドを条件付きで追加
        if let Some(player2_id) = matching.player2_id() {
            request = request.expression_attribute_values(
                ":player2_id",
                AttributeValue::S(player2_id.value().to_string()),
            );
        }

        if let Some(end_datetime) = matching.matching_end_datetime().value() {
            request = request.expression_attribute_values(
                ":end_datetime",
                AttributeValue::S(end_datetime.to_rfc3339()),
            );
        }

        let _ = request.send().await.map_err(|e| {
            println!("Failed to update matching: {}", e);

            // SDK のエラー詳細も出力
            if let Some(service_error) = e.as_service_error() {
                eprintln!("Service Error: {:?}", service_error);
            }
        });

        Ok(())
    }

    /// マッチング待機中の最新情報を取得
    async fn get_latest_waiting_matching(&self) -> Result<Option<Matching>, String> {
        println!("Querying for latest waiting matching...");
        // Playerアイテムを取得
        // GSIを使用してmatching_status=0のデータを
        // matching_start_datetimeの昇順で1件取得
        let result = self
            .client
            .query()
            .table_name(self.matchings_table)
            .index_name("MatchingStatusIndex") // GSI名
            .key_condition_expression("matching_status = :status")
            .expression_attribute_values(
                ":status",
                AttributeValue::S(MatchingStatus::new(MatchingStatusValue::InProgress).fmt_value()), // InProgress
            )
            .scan_index_forward(true) // 昇順（最も古いデータが先頭）
            .limit(1) // 1件のみ取得
            .send()
            .await
            .map_err(|e| format!("Failed to query matching: {}", e))?;

        println!("Query result: {:?}", result);

        let items = result.items();
        if items.is_empty() {
            return Ok(None);
        }

        let matching_item = &items[0];

        // Matchingの属性を抽出
        let matching_id_str = matching_item
            .get("matching_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("matching_id not found")?;
        let matching_start_datetime_str = matching_item
            .get("matching_start_datetime")
            .and_then(|v| v.as_s().ok())
            .ok_or("matching_start_datetime not found")?;
        let matching_status_str = matching_item
            .get("matching_status")
            .and_then(|v| v.as_s().ok())
            .ok_or("matching_status not found")?;
        let player1_id_str = matching_item
            .get("player1_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("player1_id not found")?;

        // player2_idはOption型
        let player2_id = matching_item
            .get("player2_id")
            .and_then(|v| v.as_s().ok())
            .map(|id| PlayerId::new(id));

        Ok(Some(Matching::new(
            MatchingId::new(matching_id_str.to_string()),
            PlayerId::new(player1_id_str),
            player2_id,
            MatchingStartDatetime::new_string(matching_start_datetime_str),
            MatchingEndDatetime::new(None),
            MatchingStatus::new_string(matching_status_str),
        )))
    }
}
