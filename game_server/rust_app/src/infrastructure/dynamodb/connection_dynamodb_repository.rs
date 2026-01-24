// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::domain::player_management::models::player::Player;
use crate::domain::player_management::repositories::connection_repository::ConnectionRepository;
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
    pub fn new(client: DynamoDbClient) -> Self {
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
            .table_name(self.connections_table)
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
            .table_name(self.connections_table)
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
}
