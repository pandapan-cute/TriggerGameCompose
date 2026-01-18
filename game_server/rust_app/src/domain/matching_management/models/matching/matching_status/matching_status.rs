#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum MatchingStatusValue {
    InProgress,  // マッチング中
    Interrupted, // マッチング中断済み
    Completed,   // マッチング完了
}

#[derive(Debug, Clone)]
pub struct MatchingStatus {
    value: MatchingStatusValue,
}

impl MatchingStatus {
    pub fn new(value: MatchingStatusValue) -> Self {
        Self { value }
    }

    /// 文字列から新しいインスタンスを生成
    /// データベースから取得した値からの変換に使用
    pub fn new_string(value: &str) -> Self {
        let status_value = match value {
            "InProgress" => MatchingStatusValue::InProgress,
            "Interrupted" => MatchingStatusValue::Interrupted,
            "Completed" => MatchingStatusValue::Completed,
            _ => panic!("Invalid MatchingStatusValue string"),
        };
        Self {
            value: status_value,
        }
    }

    pub fn fmt_value(&self) -> String {
        match self.value {
            MatchingStatusValue::InProgress => "InProgress".to_string(),
            MatchingStatusValue::Interrupted => "Interrupted".to_string(),
            MatchingStatusValue::Completed => "Completed".to_string(),
        }
    }

    pub fn value(&self) -> &MatchingStatusValue {
        &self.value
    }

    pub fn is_in_progress(&self) -> bool {
        matches!(self.value, MatchingStatusValue::InProgress)
    }

    pub fn is_interrupted(&self) -> bool {
        matches!(self.value, MatchingStatusValue::Interrupted)
    }

    pub fn is_completed(&self) -> bool {
        matches!(self.value, MatchingStatusValue::Completed)
    }

    pub fn is_finished(&self) -> bool {
        self.is_interrupted() || self.is_completed()
    }
}

// 等価性の比較を実装
impl PartialEq for MatchingStatus {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MatchingStatus {}

use std::fmt;

impl fmt::Display for MatchingStatusValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            MatchingStatusValue::InProgress => write!(f, "InProgress"),
            MatchingStatusValue::Interrupted => write!(f, "Interrupted"),
            MatchingStatusValue::Completed => write!(f, "Completed"),
        }
    }
}
