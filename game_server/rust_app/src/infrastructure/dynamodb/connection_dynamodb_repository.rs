// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::config::env::resolve_table_name;
use crate::domain::player_management::models::player::Player;
use crate::domain::player_management::repositories::connection_repository::ConnectionRepository;
use crate::domain::player_management::repositories::player_repository::PlayerRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

const CONNECTION_ID_INDEX_NAME: &str = "ConnectionIdIndex";

/// DynamoDBを使用したConnectionリポジトリの実装
/// このリポジトリはドメインの外部に位置します
/// Lambdaでの特有のコネクション管理処理を担当します
pub struct DynamoDbConnectionRepository {
    client: DynamoDbClient,
    connections_table: String,
}

impl DynamoDbConnectionRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        Self {
            client,
            connections_table: resolve_table_name("Connections"),
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
            "player_id".to_string(),
            AttributeValue::S(player_id.to_string()),
        );
        item
    }
}

#[async_trait]
impl ConnectionRepository for DynamoDbConnectionRepository {
    /// コネクション情報を保存
    /// Connectionアイテムを保存
    async fn save(&self, player_id: &str, connection_id: &str) -> Result<(), String> {
        let connection_item = self.connection_to_item(player_id, connection_id);
        self.client
            .put_item()
            .table_name(self.connections_table.as_str())
            .set_item(Some(connection_item))
            .send()
            .await
            .map_err(|e| format!("コネクション情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    /// コネクション情報を取得
    /// PlayerIdからConnectionIdを取得するメソッド
    async fn get_connection_id(&self, player_id: &str) -> Result<String, String> {
        // プライマリキーで直接取得（GSI不要）
        let result = self
            .client
            .get_item()
            .table_name(self.connections_table.as_str())
            .key("player_id", AttributeValue::S(player_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("Failed to get connection: {}", e))?;

        let item = result
            .item()
            .ok_or_else(|| format!("Connectionが見つかりません: {}", player_id))?;

        // connection_id属性を抽出
        let connection_id_str = item
            .get("connection_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("connection_id not found")?;

        Ok(connection_id_str.to_string())
    }

    async fn get_player_id_by_connection_id(
        &self,
        connection_id: &str,
    ) -> Result<Option<String>, String> {
        let result = self
            .client
            .query()
            .table_name(self.connections_table.as_str())
            .index_name(CONNECTION_ID_INDEX_NAME)
            .key_condition_expression("connection_id = :connection_id")
            .expression_attribute_values(
                ":connection_id",
                AttributeValue::S(connection_id.to_string()),
            )
            .limit(1)
            .send()
            .await
            .map_err(|e| format!("Failed to reverse lookup player_id: {}", e))?;

        let Some(item) = result.items().first() else {
            return Ok(None);
        };

        let player_id = item
            .get("player_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("player_id not found")?
            .to_string();

        Ok(Some(player_id))
    }

    async fn delete_by_connection_id(&self, connection_id: &str) -> Result<(), String> {
        let Some(player_id) = self.get_player_id_by_connection_id(connection_id).await? else {
            return Ok(());
        };

        self.client
            .delete_item()
            .table_name(self.connections_table.as_str())
            .key("player_id", AttributeValue::S(player_id))
            .send()
            .await
            .map_err(|e| format!("Failed to delete connection: {}", e))?;

        Ok(())
    }
}
