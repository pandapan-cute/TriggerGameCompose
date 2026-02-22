use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;
use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::unit_management::models::unit::Unit;

use super::turn_end_datetime::turn_end_datetime::TurnEndDatetime;
use super::turn_id::turn_id::TurnId;
use super::turn_number::turn_number::TurnNumber;
use super::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
use super::turn_status::turn_status::{TurnStatus, TurnStatusValue};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Turn集約
/// ゲームの1ターンを表すエンティティ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Turn {
    turn_id: TurnId,
    game_id: GameId,
    player_id: PlayerId,
    turn_number: TurnNumber,
    turn_start_datetime: TurnStartDatetime,
    turn_status: TurnStatus,
    steps: Vec<Step>,
}

impl Turn {
    // privateなコンストラクタ
    pub fn new(
        turn_id: TurnId,
        game_id: GameId,
        player_id: PlayerId,
        turn_number: TurnNumber,
        turn_start_datetime: TurnStartDatetime,
        turn_status: TurnStatus,
        steps: Vec<Step>,
    ) -> Self {
        Self {
            turn_id,
            game_id,
            player_id,
            turn_number,
            turn_start_datetime,
            turn_status,
            steps,
        }
    }

    /// 新規ターンの生成
    pub fn create(
        game_id: GameId,
        player_id: PlayerId,
        turn_number: TurnNumber,
        start_datetime: DateTime<Utc>,
    ) -> Self {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_status = TurnStatus::new(TurnStatusValue::StepSetting);

        Self::new(
            turn_id,
            game_id,
            player_id,
            turn_number,
            turn_start_datetime,
            turn_status,
            Vec::new(),
        )
    }

    /// ターンの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        turn_id: TurnId,
        game_id: GameId,
        player_id: PlayerId,
        turn_number: TurnNumber,
        turn_start_datetime: TurnStartDatetime,
        turn_status: TurnStatus,
        steps: Vec<Step>,
    ) -> Self {
        Self::new(
            turn_id,
            game_id,
            player_id,
            turn_number,
            turn_start_datetime,
            turn_status,
            steps,
        )
    }

    /// 別のターンと結合
    pub fn merge(&mut self, other: &Turn) -> Result<(), String> {
        // 各ステップのアクションを結合
        for (i, other_step) in other.steps.iter().enumerate() {
            if self.steps.len() <= i {
                // 自分のステップ数が少ない場合は、相手のステップをそのまま追加
                self.steps.push(other_step.clone());
                continue;
            }
            self.steps[i].merge_actions(other_step)?;
        }

        Ok(())
    }

    /// ターンの戦闘処理を開始
    pub fn turn_start(
        &mut self,
        units: Vec<Unit>,
        opponent_turn: &Turn,
    ) -> Result<Vec<Unit>, String> {
        print!(
            "ターン開始: {:?} のターン{:?}, {:?}が開始されました",
            self.player_id,
            self.turn_number,
            self.turn_status()
        );
        if !self.turn_status.is_step_setting() {
            return Err("行動設定中のステータスでないとターンを開始できません".to_string());
        }
        if !opponent_turn.is_step_setting() {
            return Err(
                "対戦相手のターンが行動設定中のステータスでないとターンを開始できません"
                    .to_string(),
            );
        }
        // プレイヤー1とプレイヤー2のターン情報の結合
        self.merge(opponent_turn)?;
        // ユニット行動モードに移行
        self.start_unit_stepping()?;

        // ユニットIDをキーとしたHashMapに変換
        let mut units_map = units
            .into_iter()
            .map(|mut u| {
                // ターン開始時にユニットの行動ポイントをリセットしてMapに格納
                u.reset_action_points();
                (u.unit_id().clone(), u)
            })
            .collect::<std::collections::HashMap<_, _>>();

        // 各ステップの戦闘演算を開始
        for step in &mut self.steps {
            step.step_start(&mut units_map)?;
        }

        Ok(units_map.into_values().collect())
    }

    /// ターンをユニット行動中ステータスに変更
    fn start_unit_stepping(&mut self) -> Result<(), String> {
        if !self.turn_status.is_step_setting() {
            return Err("行動設定中のステータスでないとユニット行動を開始できません".to_string());
        }
        self.turn_status = TurnStatus::new(TurnStatusValue::UnitStepping);
        Ok(())
    }

    /// ターンを完了
    pub fn complete(&mut self, end_datetime: DateTime<Utc>) -> Result<(), String> {
        if self.turn_status.is_completed() {
            return Err("既にターンは完了しています".to_string());
        }
        self.turn_status = TurnStatus::new(TurnStatusValue::Completed);
        Ok(())
    }

    /// ターンが完了しているかどうか
    pub fn is_completed(&self) -> bool {
        self.turn_status.is_completed()
    }

    /// ターンが行動設定中かどうか
    pub fn is_step_setting(&self) -> bool {
        self.turn_status.is_step_setting()
    }

    /// ターンがユニット行動中かどうか
    pub fn is_unit_stepping(&self) -> bool {
        self.turn_status.is_unit_stepping()
    }

    // ゲッター
    pub fn turn_id(&self) -> &TurnId {
        &self.turn_id
    }

    pub fn game_id(&self) -> &GameId {
        &self.game_id
    }

    pub fn player_id(&self) -> &PlayerId {
        &self.player_id
    }

    pub fn turn_number(&self) -> &TurnNumber {
        &self.turn_number
    }

    pub fn turn_start_datetime(&self) -> &TurnStartDatetime {
        &self.turn_start_datetime
    }

    pub fn turn_status(&self) -> &TurnStatus {
        &self.turn_status
    }

    pub fn steps(&self) -> &Vec<Step> {
        &self.steps
    }
}

impl PartialEq for Turn {
    fn eq(&self, other: &Self) -> bool {
        self.turn_id == other.turn_id
    }
}

impl Eq for Turn {}
