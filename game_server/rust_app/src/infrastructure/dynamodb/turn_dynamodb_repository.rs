// infrastructure/dynamodb/player_dynamodb_repository.rs

use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action::action_id::action_id::ActionId;
use crate::domain::triggergame_simulator::models::action::action_type::action_type::ActionType;
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use crate::domain::triggergame_simulator::models::action::Action;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::triggergame_simulator::models::turn::turn_id::turn_id::TurnId;
use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
use crate::domain::triggergame_simulator::models::turn::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
use crate::domain::triggergame_simulator::models::turn::turn_status::turn_status::TurnStatus;
use crate::domain::triggergame_simulator::models::turn::Turn;
use crate::domain::triggergame_simulator::repositories::turn_repository::TurnRepository;

use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;

pub struct DynamoDbTurnRepository {
    client: DynamoDbClient,
    turns_table: &'static str,
}

impl DynamoDbTurnRepository {
    pub fn new(client: DynamoDbClient) -> Self {
        // テーブル名
        const TURNS_TABLE_NAME: &str = "Turns";
        Self {
            client: client,
            turns_table: TURNS_TABLE_NAME,
        }
    }

    // ヘルパーメソッド：Turnを属性値マップに変換
    fn turn_to_item(&self, turn: &Turn) -> HashMap<String, AttributeValue> {
        let mut item = HashMap::new();
        item.insert(
            "turn_id".to_string(),
            AttributeValue::S(turn.turn_id().value().to_string()),
        );
        item.insert(
            "game_id".to_string(),
            AttributeValue::S(turn.game_id().value().to_string()),
        );
        item.insert(
            "player_id".to_string(),
            AttributeValue::S(turn.player_id().value().to_string()),
        );
        item.insert(
            "turn_number".to_string(),
            AttributeValue::N(turn.turn_number().value().to_string()),
        );
        item.insert(
            "turn_start_datetime".to_string(),
            AttributeValue::S(turn.turn_start_datetime().value().to_string()),
        );
        item.insert(
            "turn_status".to_string(),
            AttributeValue::S(turn.turn_status().fmt_value()),
        );

        item.insert(
            "steps".to_string(),
            AttributeValue::L(
                turn.steps()
                    .iter()
                    .map(|step| {
                        AttributeValue::M({
                            let mut step_map = HashMap::new();
                            step_map.insert(
                                "step_id".to_string(),
                                AttributeValue::S(step.step_id().value().to_string()),
                            );
                            step_map.insert(
                                "actions".to_string(),
                                AttributeValue::L(
                                    step.actions()
                                        .iter()
                                        .map(|action| {
                                            AttributeValue::M({
                                                let mut action_map = HashMap::new();
                                                action_map.insert(
                                                    "action_id".to_string(),
                                                    AttributeValue::S(
                                                        action.action_id().value().to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "action_type".to_string(),
                                                    AttributeValue::S(
                                                        action.action_type().fmt_value(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "unit_id".to_string(),
                                                    AttributeValue::S(
                                                        action.unit_id().value().to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "unit_type_id".to_string(),
                                                    AttributeValue::S(
                                                        action.unit_type_id().value().to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "position_col".to_string(),
                                                    AttributeValue::N(
                                                        action.position().col().to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "position_row".to_string(),
                                                    AttributeValue::N(
                                                        action.position().row().to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "using_main_trigger_id".to_string(),
                                                    AttributeValue::S(
                                                        action
                                                            .using_main_trigger_id()
                                                            .value()
                                                            .to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "using_sub_trigger_id".to_string(),
                                                    AttributeValue::S(
                                                        action
                                                            .using_sub_trigger_id()
                                                            .value()
                                                            .to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "main_trigger_azimuth".to_string(),
                                                    AttributeValue::N(
                                                        action
                                                            .main_trigger_azimuth()
                                                            .value()
                                                            .to_string(),
                                                    ),
                                                );
                                                action_map.insert(
                                                    "sub_trigger_azimuth".to_string(),
                                                    AttributeValue::N(
                                                        action
                                                            .sub_trigger_azimuth()
                                                            .value()
                                                            .to_string(),
                                                    ),
                                                );
                                                action_map
                                            })
                                        })
                                        .collect(),
                                ),
                            );
                            step_map
                        })
                    })
                    .collect(),
            ),
        );
        item
    }
}

#[async_trait]
impl TurnRepository for DynamoDbTurnRepository {
    async fn save(&self, turn: &Turn) -> Result<(), String> {
        // Turnアイテムを保存
        let turn_item = self.turn_to_item(turn);
        self.client
            .put_item()
            .table_name(self.turns_table)
            .set_item(Some(turn_item))
            .send()
            .await
            .map_err(|e| format!("ゲーム情報の保存に失敗しました: {}", e))?;
        Ok(())
    }

    async fn update(&self, turn: &Turn) -> Result<(), String> {
        // turn_to_itemを使って属性値を取得
        let item = self.turn_to_item(turn);

        let update_parts = vec!["turn_status = :turn_status", "steps = :steps"];
        let update_expression = format!("SET {}", update_parts.join(", "));

        let steps_value = item.get("steps").unwrap().clone();
        let turn_status_value = item.get("turn_status").unwrap().clone();

        let request = self
            .client
            .update_item()
            .table_name(self.turns_table)
            .key(
                "turn_id",
                AttributeValue::S(turn.turn_id().value().to_string()),
            )
            .update_expression(update_expression)
            .expression_attribute_values(":turn_status", turn_status_value)
            .expression_attribute_values(":steps", steps_value);

        let _ = request.send().await.map_err(|e| {
            println!("Failed to update turn: {}", e);

            // SDK のエラー詳細も出力
            if let Some(service_error) = e.as_service_error() {
                eprintln!("Service Error: {:?}", service_error);
            }
        });

        Ok(())
    }

    /// マッチング待機中の最新情報を取得
    async fn get_turn_data(
        &self,
        game_id: &GameId,
        player_id: &PlayerId,
        turn_number: &TurnNumber,
    ) -> Result<Option<Turn>, String> {
        println!(
            "Querying for the turn {} {} {}...",
            game_id.value(),
            player_id.value(),
            turn_number.value()
        );
        // game_idでクエリ
        let result = self
            .client
            .get_item()
            .table_name(self.turns_table)
            .key(
                "turn_id",
                AttributeValue::S(
                    game_id.value().to_string()
                        + "_"
                        + &player_id.value().to_string()
                        + "_"
                        + &turn_number.value().to_string(),
                ),
            )
            .send()
            .await
            .map_err(|e| format!("Failed to query turn: {}", e))?;

        println!("Query result: {:?}", result);

        let item = result.item();
        if item.is_none() {
            return Ok(None);
        }

        let turn_item = item.unwrap();
        // Turnの属性を抽出
        let turn_id_str = turn_item
            .get("turn_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("turn_id not found")?;
        let game_id_str = turn_item
            .get("game_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("game_id not found")?;
        let player_id_str = turn_item
            .get("player_id")
            .and_then(|v| v.as_s().ok())
            .ok_or("player_id not found")?;
        let turn_number_str = turn_item
            .get("turn_number")
            .and_then(|v| v.as_n().ok())
            .ok_or("turn_number not found")?;
        let turn_start_datetime_str = turn_item
            .get("turn_start_datetime")
            .and_then(|v| v.as_s().ok())
            .ok_or("turn_start_datetime not found")?;
        let turn_status_str = turn_item
            .get("turn_status")
            .and_then(|v| v.as_s().ok())
            .ok_or("turn_status not found")?;
        // stepsはリスト型
        let steps_attr = turn_item
            .get("steps")
            .and_then(|v| v.as_l().ok())
            .ok_or("steps not found")?;
        let mut steps: Vec<Step> = Vec::new();
        for step_attr in steps_attr {
            if let Some(step_map) = step_attr.as_m().ok() {
                let step_id_str = step_map
                    .get("step_id")
                    .and_then(|v| v.as_s().ok())
                    .ok_or("step_id not found")?;
                let actions_attr = step_map
                    .get("actions")
                    .and_then(|v| v.as_l().ok())
                    .ok_or("actions not found")?;

                let mut actions: Vec<Action> = Vec::new();
                for action_attr in actions_attr {
                    if let Some(action_map) = action_attr.as_m().ok() {
                        let action_id_str = action_map
                            .get("action_id")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("action_id not found")?;
                        let action_type_str = action_map
                            .get("action_type")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("action_type not found")?;
                        let unit_id_str = action_map
                            .get("unit_id")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("unit_id not found")?;
                        let unit_type_id_str = action_map
                            .get("unit_type_id")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("unit_type_id not found")?;
                        let position_col_str = action_map
                            .get("position_col")
                            .and_then(|v| v.as_n().ok())
                            .ok_or("position_col not found")?;
                        let position_row_str = action_map
                            .get("position_row")
                            .and_then(|v| v.as_n().ok())
                            .ok_or("position_row not found")?;
                        let using_main_trigger_id_str = action_map
                            .get("using_main_trigger_id")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("using_main_trigger_id not found")?;
                        let using_sub_trigger_id_str = action_map
                            .get("using_sub_trigger_id")
                            .and_then(|v| v.as_s().ok())
                            .ok_or("using_sub_trigger_id not found")?;
                        let main_trigger_azimuth_str = action_map
                            .get("main_trigger_azimuth")
                            .and_then(|v| v.as_n().ok())
                            .ok_or("main_trigger_azimuth not found")?;
                        let sub_trigger_azimuth_str = action_map
                            .get("sub_trigger_azimuth")
                            .and_then(|v| v.as_n().ok())
                            .ok_or("sub_trigger_azimuth not found")?;

                        let action = Action::reconstruct(
                            ActionId::new(action_id_str.to_string()),
                            ActionType::new_string(action_type_str.to_string()),
                            UnitId::new(unit_id_str.to_string()),
                            UnitTypeId::new(unit_type_id_str.to_string()),
                            Position::new(
                                position_col_str
                                    .parse::<i32>()
                                    .map_err(|e| format!("Failed to parse position_col: {}", e))?,
                                position_row_str
                                    .parse::<i32>()
                                    .map_err(|e| format!("Failed to parse position_row: {}", e))?,
                            ),
                            TriggerId::new(using_main_trigger_id_str.to_string()),
                            TriggerId::new(using_sub_trigger_id_str.to_string()),
                            TriggerAzimuth::new(main_trigger_azimuth_str.parse::<i32>().map_err(
                                |e| format!("Failed to parse main_trigger_azimuth: {}", e),
                            )?),
                            TriggerAzimuth::new(sub_trigger_azimuth_str.parse::<i32>().map_err(
                                |e| format!("Failed to parse sub_trigger_azimuth: {}", e),
                            )?),
                        );
                        actions.push(action);
                    }
                }

                let step = Step::new(StepId::new(step_id_str.to_string()), actions);
                steps.push(step);
            }
        }

        Ok(Some(Turn::reconstruct(
            TurnId::new(turn_id_str.to_string()),
            GameId::new(game_id_str.to_string()),
            PlayerId::new(player_id_str.to_string()),
            TurnNumber::new(
                turn_number_str
                    .parse::<i32>()
                    .map_err(|e| format!("Failed to parse turn_number: {}", e))?,
            ),
            TurnStartDatetime::new(
                turn_start_datetime_str
                    .parse::<DateTime<Utc>>()
                    .map_err(|e| format!("Failed to parse turn_start_datetime: {}", e))?,
            ),
            TurnStatus::new_string(turn_status_str),
            steps,
        )))
    }
}
