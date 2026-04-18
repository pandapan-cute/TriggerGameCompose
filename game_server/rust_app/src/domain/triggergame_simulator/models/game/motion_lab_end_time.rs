use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::triggergame_simulator::configs::game_config::GameConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MotionLabEndTime {
    value: DateTime<Utc>,
}

impl MotionLabEndTime {
    pub fn new(value: DateTime<Utc>) -> Self {
        Self { value }
    }
    /// 動きの設定の提出時間を生成する。
    pub fn initial() -> Self {
        // 次の動きの設定の提出時間を作成
        let game_config = GameConfig::get_game_config();
        let motion_lab_limit_time = Utc::now()
            + chrono::Duration::seconds(
                game_config.motion_lab_seconds()
                    + game_config.motion_execute_seconds()
                    + game_config.communication_wait_seconds(),
            );
        Self {
            value: motion_lab_limit_time,
        }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }
}

impl PartialEq for MotionLabEndTime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MotionLabEndTime {}
