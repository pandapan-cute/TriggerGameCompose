// infrastructure/dynamodb/game_dynamodb_repository.rs

use crate::config::env::resolve_table_name;
use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::game::Game;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::triggergame_simulator::models::game::game_state::{GameState, GameStateValue};
use crate::domain::triggergame_simulator::models::game::motion_lab_end_time::MotionLabEndTime;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
use crate::domain::triggergame_simulator::repositories::game_repository::GameRepository;
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use std::collections::HashMap;

pub struct DynamoDbGameRepository {
    client: DynamoDbClient,
    games_table: String,
}

impl DynamoDbGameRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        Self {
            client,
            games_table: resolve_table_name("Games"),
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
            "game_state".to_string(),
            AttributeValue::S(game.game_state().value().to_string()),
        );
        item.insert(
            "current_turn_number".to_string(),
            AttributeValue::N(game.current_turn_number().value().to_string()),
        );
        item.insert(
            "motion_lab_end_time".to_string(),
            AttributeValue::S(game.motion_lab_end_time().value().to_rfc3339()),
        );
        item.insert(
            "player1_id".to_string(),
            AttributeValue::S(game.player1_id().value().to_string()),
        );
        item.insert(
            "player2_id".to_string(),
            AttributeValue::S(game.player2_id().value().to_string()),
        );

        let field_steps = game
            .visibility()
            .field_steps()
            .iter()
            .map(|row| {
                AttributeValue::L(
                    row.iter()
                        .map(|height| AttributeValue::N(height.to_string()))
                        .collect(),
                )
            })
            .collect();
        item.insert("field_steps".to_string(), AttributeValue::L(field_steps));

        item
    }

    // ヘルパーメソッド：DynamoDBアイテムをGameに変換
    fn item_to_game(&self, game_item: &HashMap<String, AttributeValue>) -> Result<Game, String> {
        // Gameの属性を抽出
        let game_id_str = game_item
            .get("game_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("ゲームIDが見つかりませんでした。")?;
        let game_state_str = game_item
            .get("game_state")
            .and_then(|v| v.as_s().ok())
            .ok_or("ゲームステートが見つかりませんでした。")?;
        let current_turn_number_str = game_item
            .get("current_turn_number")
            .and_then(|v| v.as_n().ok())
            .ok_or("現在のターン番号が見つかりませんでした。")?;
        let motion_lab_end_time_str = game_item
            .get("motion_lab_end_time")
            .and_then(|v| v.as_s().ok())
            .ok_or("動きの設定の終了時間が見つかりませんでした。")?;
        let player1_id_str = game_item
            .get("player1_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("プレイヤー1のIDが見つかりませんでした。")?;
        let player2_id_str = game_item
            .get("player2_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("プレイヤー2のIDが見つかりませんでした。")?;

        let visibility = if let Some(field_steps_attr) = game_item.get("field_steps") {
            let rows = field_steps_attr
                .as_l()
                .map_err(|_| "field_steps の形式が不正です。".to_string())?;

            let field_steps = rows
                .iter()
                .map(|row_attr| {
                    let row = row_attr
                        .as_l()
                        .map_err(|_| "field_steps の行形式が不正です。".to_string())?;

                    row.iter()
                        .map(|height_attr| {
                            let height_str = height_attr
                                .as_n()
                                .map_err(|_| "field_steps の高さ形式が不正です。".to_string())?;
                            height_str
                                .parse::<i32>()
                                .map_err(|e| format!("field_steps の高さ解析に失敗しました: {}", e))
                        })
                        .collect::<Result<Vec<i32>, String>>()
                })
                .collect::<Result<Vec<Vec<i32>>, String>>()?;

            Visibility::new(field_steps)
        } else {
            Visibility::create()
        };

        Ok(Game::reconstruct(
            GameId::new(game_id_str.to_string()),
            GameState::new_string(game_state_str.to_string()),
            TurnNumber::new(
                current_turn_number_str
                    .parse::<i32>()
                    .map_err(|e| format!("現在のターン番号の解析に失敗しました: {}", e))?,
            ),
            motion_lab_end_time_str
                .parse::<chrono::DateTime<chrono::Utc>>()
                .map_err(|e| format!("動きの設定の終了時間の解析に失敗しました: {}", e))
                .map(MotionLabEndTime::new)?,
            PlayerId::new(player1_id_str.to_string()),
            PlayerId::new(player2_id_str.to_string()),
            visibility,
        ))
    }
}

#[async_trait]
impl GameRepository for DynamoDbGameRepository {
    /// ゲーム情報を保存する。
    async fn save(&self, game: &Game) -> Result<(), String> {
        // Gameアイテムを保存
        let game_item = self.game_to_item(game);
        self.client
            .put_item()
            .table_name(self.games_table.as_str())
            .set_item(Some(game_item))
            .send()
            .await
            .map_err(|e| format!("ゲーム情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    /// ゲーム情報を更新する。
    async fn update(&self, game: &Game) -> Result<(), String> {
        let update_expression =
            "SET current_turn_number = :current_turn_number, game_state = :game_state";

        self.client
            .update_item()
            .table_name(self.games_table.as_str())
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
                ":game_state",
                AttributeValue::S(game.game_state().value().to_string()),
            )
            .send()
            .await
            .map_err(|e| {
                println!("Failed to update game: {}", e);
                if let Some(service_error) = e.as_service_error() {
                    eprintln!("Service Error: {:?}", service_error);
                }
                format!("ゲーム情報の更新に失敗しました: {}", e)
            })?;

        Ok(())
    }

    /// マッチング待機中の最新情報を取得
    async fn get_game_by_id(&self, game_id: &GameId) -> Result<Game, String> {
        println!("ゲーム {} を取得中...", game_id.value());
        // game_idを指定して1件取得（プライマリキー検索）
        let result = self
            .client
            .get_item()
            .table_name(self.games_table.as_str())
            .key("game_id", AttributeValue::S(game_id.value().to_string()))
            .send()
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))?;

        // println!("GetItem result: {:?}", result);

        let game_item = result
            .item()
            .ok_or("ゲームが見つかりませんでした。".to_string())?;

        self.item_to_game(game_item)
    }

    /// 指定したプレイヤーIDの進行中のゲームを取得
    async fn get_inprogress_games_by_player_id(
        &self,
        player_id: &str,
    ) -> Result<Vec<Game>, String> {
        // InProgress のみを GSI で絞り、プレイヤー一致は FilterExpression で判定する。
        let query_result = self
            .client
            .query()
            .table_name(self.games_table.as_str())
            .index_name("GameStateIndex")
            .key_condition_expression("game_state = :in_progress")
            .filter_expression("player1_id = :player_id OR player2_id = :player_id")
            .expression_attribute_values(
                ":in_progress",
                AttributeValue::S(GameStateValue::InProgress.to_string()),
            )
            .expression_attribute_values(":player_id", AttributeValue::S(player_id.to_string()))
            .send()
            .await
            .map_err(|e| format!("対象ゲームの検索に失敗しました: {}", e))?;

        // クエリ結果からゲームを構築して返す
        query_result
            .items()
            .iter()
            .map(|item| self.item_to_game(item))
            .collect::<Result<Vec<Game>, String>>()
    }
}
