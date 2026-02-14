// infrastructure/dynamodb/game_dynamodb_repository.rs

use crate::domain::matching_management::repositories::matching_repository::MatchingRepository;
use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::current_turn_number::current_turn_number::CurrentTurnNumber;
use crate::domain::triggergame_simulator::models::game::game::Game;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::triggergame_simulator::repositories::game_repository::GameRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

pub struct DynamoDbGameRepository {
    client: DynamoDbClient,
    games_table: &'static str,
}

impl DynamoDbGameRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        // テーブル名
        const GAMES_TABLE_NAME: &str = "Games";
        Self {
            client: client,
            games_table: GAMES_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Gameを属性値マップに変換
    fn game_to_item(&self, game: &Game) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(game.game_id().value().to_string()),
        );
        item.insert(
            "current_turn_number".to_string(),
            AttributeValue::N(game.current_turn_number().value().to_string()),
        );
        item.insert(
            "player1_id".to_string(),
            AttributeValue::S(game.player1_id().value().to_string()),
        );
        item.insert(
            "player2_id".to_string(),
            AttributeValue::S(game.player2_id().value().to_string()),
        );
        item
    }
}

#[async_trait]
impl GameRepository for DynamoDbGameRepository {
    async fn save(&self, game: &Game) -> Result<(), String> {
        // Gameアイテムを保存
        let game_item = self.game_to_item(game);
        self.client
            .put_item()
            .table_name(self.games_table)
            .set_item(Some(game_item))
            .send()
            .await
            .map_err(|e| format!("ゲーム情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    async fn update(&self, game: &Game) -> Result<(), String> {
        // DynamoDBでは put_item で上書き更新
        // または update_item を使用して部分更新

        // UPDATE式を動的に構築
        let update_parts = vec!["current_turn_number = :current_turn_number"];

        let update_expression = format!("SET {}", update_parts.join(", "));

        let request = self
            .client
            .update_item()
            .table_name(self.games_table)
            .key(
                "game_id",
                AttributeValue::S(game.game_id().value().to_string()),
            )
            .update_expression(update_expression)
            .expression_attribute_values(
                ":current_turn_number",
                AttributeValue::N(game.current_turn_number().value().to_string()),
            )
            .expression_attribute_values(
                ":player1_id",
                AttributeValue::S(game.player1_id().value().to_string()),
            )
            .expression_attribute_values(
                ":player2_id",
                AttributeValue::S(game.player2_id().value().to_string()),
            );

        let _ = request.send().await.map_err(|e| {
            println!("Failed to update game: {}", e);

            // SDK のエラー詳細も出力
            if let Some(service_error) = e.as_service_error() {
                eprintln!("Service Error: {:?}", service_error);
            }
        });

        Ok(())
    }

    /// マッチング待機中の最新情報を取得
    async fn get_game_by_id(&self, game_id: &GameId) -> Result<Game, String> {
        println!("ゲーム {} を取得中...", game_id.value());
        // game_idを指定して1件取得（プライマリキー検索）
        let result = self
            .client
            .get_item()
            .table_name(self.games_table)
            .key("game_id", AttributeValue::S(game_id.value().to_string()))
            .send()
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        println!("GetItem result: {:?}", result);

        let game_item = result
            .item()
            .ok_or("ゲームが見つかりませんでした。".to_string())?;

        // Gameの属性を抽出
        let game_id_str = game_item
            .get("game_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("ゲームIDが見つかりませんでした。")?;
        let current_turn_number_str = game_item
            .get("current_turn_number")
            .and_then(|v| v.as_n().ok())
            .ok_or("現在のターン番号が見つかりませんでした。")?;
        let player1_id_str = game_item
            .get("player1_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("プレイヤー1のIDが見つかりませんでした。")?;
        let player2_id_str = game_item
            .get("player2_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("プレイヤー2のIDが見つかりませんでした。")?;

        Ok(Game::reconstruct(
            GameId::new(game_id_str.to_string()),
            CurrentTurnNumber::new(
                current_turn_number_str
                    .parse::<i32>()
                    .map_err(|e| format!("現在のターン番号の解析に失敗しました: {}", e))?,
            ),
            PlayerId::new(player1_id_str.to_string()),
            PlayerId::new(player2_id_str.to_string()),
        ))
    }
}
