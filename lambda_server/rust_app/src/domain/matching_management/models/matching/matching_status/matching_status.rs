#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MatchingStatusValue {
    InProgress,    // マッチング中
    Interrupted,   // マッチング中断済み
    Completed,     // マッチング完了
}

#[derive(Debug, Clone)]
pub struct MatchingStatus {
    value: MatchingStatusValue,
}

impl MatchingStatus {
    pub fn new(value: MatchingStatusValue) -> Self {
        Self { value }
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
