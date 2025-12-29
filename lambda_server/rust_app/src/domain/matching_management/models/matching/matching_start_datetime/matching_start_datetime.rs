use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct MatchingStartDatetime {
    value: DateTime<Utc>,
}

impl MatchingStartDatetime {
    pub fn new(value: DateTime<Utc>) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }

    // バリデーションの実装
    fn validate(_value: &DateTime<Utc>) {

    }
}

// 等価性の比較を実装
impl PartialEq for MatchingStartDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MatchingStartDatetime {}
