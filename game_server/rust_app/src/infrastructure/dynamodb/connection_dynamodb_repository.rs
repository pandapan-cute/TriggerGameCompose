// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::domain::player_management::models::player::Player;
use crate::domain::player_management::repositories::player_repository::PlayerRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

/// DynamoDBを使用したConnectionリポジトリの実装
/// このリポジトリはドメインの外部に位置します
/// Lambdaでの特有のコネクション管理処理を担当します
pub struct DynamoDbConnectionRepository {
    client: DynamoDbClient,
    connections_table: &'static str,
}

impl DynamoDbConnectionRepository {
    pub fn new(client: DynamoDbClient, connection_id: &str, player_id: &str) -> Self {
        // テーブル名
        const CONNECTIONS_TABLE_NAME: &str = "Connections";
        Self {
            client,
            connections_table: CONNECTIONS_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Playerを属性値マップに変換
    fn connection_to_item(
        &self,
        player_id: &str,
        connection_id: &str,
    ) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "connection_id".to_string(),
            AttributeValue::S(connection_id.to_string()),
        );
        item.insert(
            "player_name".to_string(),
            AttributeValue::S(player_id.to_string()),
        );
        item
    }

    /// PlayerIdからConnectionIdを取得するメソッド
    pub async fn get_connection_id(&self, player_id: &str) -> Result<String, String> {
        // Connectionアイテムを取得
        let result = self
            .client
            .query()
            .table_name(self.connections_table)
            .index_name("PlayerIndex") // GSI名
            .key_condition_expression("player_id = :player_id")
            .expression_attribute_values(":player_id", AttributeValue::S(player_id.to_string()))
            .scan_index_forward(true) // 昇順（最も古いデータが先頭）
            .limit(1) // 1件のみ取得
            .send()
            .await
            .map_err(|e| format!("Failed to query connection: {}", e))?;

        println!("Query result: {:?}", result);

        let items = result.items();
        if items.is_empty() {
            return Err("Connectionが見つかりません".to_string());
        }

        let connection_item = &items[0];

        // Matchingの属性を抽出
        let connection_id_str = connection_item
            .get("connection_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("connection_id not found")?;

        Ok(connection_id_str.to_string())
    }

    /// Connectionアイテムを保存
    pub async fn save(&self, player_id: &str, connection_id: &str) -> Result<(), String> {
        let connection_item = self.connection_to_item(player_id, connection_id);
        self.client
            .put_item()
            .table_name(self.connections_table)
            .set_item(Some(connection_item))
            .send()
            .await
            .map_err(|e| format!("コネクション情報の保存に失敗しました: {}", e))?;
        Ok(())
    }
}
