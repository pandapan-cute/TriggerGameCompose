// infrastructure/dynamodb/player_dynamodb_repository.rs

use crate::domain::player_management::models::player::Player;
use crate::domain::player_management::repositories::player_repository::PlayerRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

pub struct DynamoDbPlayerRepository {
    client: DynamoDbClient,
    players_table: &'static str,
}

impl DynamoDbPlayerRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        // テーブル名
        const PLAYERS_TABLE_NAME: &str = "Players";
        Self {
            client,
            players_table: PLAYERS_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Playerを属性値マップに変換
    fn player_to_item(&self, player: &Player) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(player.player_id().value().to_string()),
        );
        item.insert(
            "player_name".to_string(),
            AttributeValue::S(player.player_name().value().to_string()),
        );
        item.insert(
            "registered_datetime".to_string(),
            AttributeValue::S(player.registered_datetime().to_rfc3339()),
        );
        item.insert(
            "mfa_authentication".to_string(),
            AttributeValue::S(player.mfa_authentication().value().to_string()),
        );
        item
    }
}

#[async_trait]
impl PlayerRepository for DynamoDbPlayerRepository {
    async fn save(&self, player: &Player) -> Result<(), String> {
        // Playerアイテムを保存
        let player_item = self.player_to_item(player);
        self.client
            .put_item()
            .table_name(self.players_table)
            .set_item(Some(player_item))
            .send()
            .await
            .map_err(|e| format!("マッチング情報の保存に失敗しました: {}", e))?;
        Ok(())
    }
}
