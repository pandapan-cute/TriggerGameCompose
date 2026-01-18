use super::turn_end_datetime::turn_end_datetime::TurnEndDatetime;
use super::turn_id::turn_id::TurnId;
use super::turn_number::turn_number::TurnNumber;
use super::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
use super::turn_status::turn_status::{TurnStatus, TurnStatusValue};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Turn集約
/// ゲームの1ターンを表すエンティティ
#[derive(Debug, Clone)]
pub struct Turn {
    turn_id: TurnId,
    turn_number: TurnNumber,
    turn_start_datetime: TurnStartDatetime,
    turn_end_datetime: Option<TurnEndDatetime>,
    turn_status: TurnStatus,
}

impl Turn {
    // privateなコンストラクタ
    fn new(
        turn_id: TurnId,
        turn_number: TurnNumber,
        turn_start_datetime: TurnStartDatetime,
        turn_end_datetime: Option<TurnEndDatetime>,
        turn_status: TurnStatus,
    ) -> Self {
        Self {
            turn_id,
            turn_number,
            turn_start_datetime,
            turn_end_datetime,
            turn_status,
        }
    }

    /// 新規ターンの生成
    pub fn create(turn_number: TurnNumber, start_datetime: DateTime<Utc>) -> Self {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_status = TurnStatus::new(TurnStatusValue::StepSetting);

        Self::new(
            turn_id,
            turn_number,
            turn_start_datetime,
            None,
            turn_status,
        )
    }

    /// ターンの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        turn_id: TurnId,
        turn_number: TurnNumber,
        turn_start_datetime: TurnStartDatetime,
        turn_end_datetime: Option<TurnEndDatetime>,
        turn_status: TurnStatus,
    ) -> Self {
        Self::new(
            turn_id,
            turn_number,
            turn_start_datetime,
            turn_end_datetime,
            turn_status,
        )
    }

    /// ターンをユニット行動中ステータスに変更
    pub fn start_unit_stepping(&mut self) -> Result<(), String> {
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
        self.turn_end_datetime = Some(TurnEndDatetime::new(end_datetime));
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

    pub fn turn_number(&self) -> &TurnNumber {
        &self.turn_number
    }

    pub fn turn_start_datetime(&self) -> &TurnStartDatetime {
        &self.turn_start_datetime
    }

    pub fn turn_end_datetime(&self) -> Option<&TurnEndDatetime> {
        self.turn_end_datetime.as_ref()
    }

    pub fn turn_status(&self) -> &TurnStatus {
        &self.turn_status
    }
}

impl PartialEq for Turn {
    fn eq(&self, other: &Self) -> bool {
        self.turn_id == other.turn_id
    }
}

impl Eq for Turn {}
