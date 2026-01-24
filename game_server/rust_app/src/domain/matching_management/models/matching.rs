pub mod matching_end_datetime;
pub mod matching_id;
pub mod matching_start_datetime;
pub mod matching_status;

use chrono::Utc;
use uuid::Uuid;

use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
pub use matching_end_datetime::matching_end_datetime::MatchingEndDatetime;
pub use matching_id::matching_id::MatchingId;
pub use matching_start_datetime::matching_start_datetime::MatchingStartDatetime;
pub use matching_status::matching_status::{MatchingStatus, MatchingStatusValue};
/// Matching 集約ルート
///
/// マッチングは2人のプレイヤーをマッチングさせるプロセスを管理する集約です。
/// マッチングの開始、完了、中断などのライフサイクルを管理します。
#[derive(Debug, Clone)]
pub struct Matching {
    matching_id: MatchingId,
    player1_id: PlayerId,
    player2_id: Option<PlayerId>,
    matching_start_datetime: MatchingStartDatetime,
    matching_end_datetime: MatchingEndDatetime,
    matching_status: MatchingStatus,
}

impl Matching {
    /// コンストラクタ
    pub fn new(
        matching_id: MatchingId,
        player1_id: PlayerId,
        player2_id: Option<PlayerId>,
        matching_start_datetime: MatchingStartDatetime,
        matching_end_datetime: MatchingEndDatetime,
        matching_status: MatchingStatus,
    ) -> Self {
        Self {
            matching_id,
            player1_id,
            player2_id,
            matching_start_datetime,
            matching_end_datetime,
            matching_status,
        }
    }

    /// 新規マッチングの生成
    ///
    /// # Arguments
    /// * `player1_id` - プレイヤー1のID
    ///
    /// # Returns
    /// 新しいMatchingインスタンス
    ///
    /// # Panics
    /// 同じプレイヤーIDが指定された場合にパニックします
    pub fn create(player1_id: PlayerId) -> Self {
        let matching_id = MatchingId::new(Uuid::new_v4().to_string());
        let player2_id = None;
        let matching_start_datetime = MatchingStartDatetime::new(Utc::now());
        let matching_end_datetime = MatchingEndDatetime::new(None);
        let matching_status = MatchingStatus::new(MatchingStatusValue::InProgress);

        Self::new(
            matching_id,
            player1_id,
            player2_id,
            matching_start_datetime,
            matching_end_datetime,
            matching_status,
        )
    }

    /// # マッチングの実行
    ///
    /// ## Arguments
    /// * `player2_id` - プレイヤー2のID
    ///
    /// ## Returns
    /// 成功時はOk、失敗時はErrを返す
    ///
    /// ## Panics
    /// ビジネスルールに違反した場合にエラーを返す
    pub fn matchmaking(&mut self, player2_id: PlayerId) -> Result<(), String> {
        // ビジネスルール: 同じプレイヤー同士のマッチングはできない
        if self.player1_id == player2_id {
            return Err("同じプレイヤー同士のマッチングはできません".to_string());
        }

        // ビジネスルール: 既にマッチング相手がいる場合は追加できない
        if self.player2_id.is_some() {
            return Err("既にマッチング相手が存在します".to_string());
        }

        self.player2_id = Some(player2_id);
        self.matching_status = MatchingStatus::new(MatchingStatusValue::Completed);
        Ok(())
    }

    /// マッチングが進行中かどうかを確認する
    pub fn is_in_progress(&self) -> bool {
        self.matching_status.is_in_progress()
    }

    /// マッチングが終了しているかどうかを確認する
    pub fn is_finished(&self) -> bool {
        self.matching_status.is_finished()
    }

    // ゲッター
    pub fn matching_id(&self) -> &MatchingId {
        &self.matching_id
    }

    pub fn player1_id(&self) -> &PlayerId {
        &self.player1_id
    }

    pub fn player2_id(&self) -> &Option<PlayerId> {
        &self.player2_id
    }

    pub fn matching_start_datetime(&self) -> &MatchingStartDatetime {
        &self.matching_start_datetime
    }

    pub fn matching_end_datetime(&self) -> &MatchingEndDatetime {
        &self.matching_end_datetime
    }

    pub fn matching_status(&self) -> &MatchingStatus {
        &self.matching_status
    }
}
