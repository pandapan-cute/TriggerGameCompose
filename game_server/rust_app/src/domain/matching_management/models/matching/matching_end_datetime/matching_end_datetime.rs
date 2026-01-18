use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct MatchingEndDatetime {
    value: Option<DateTime<Utc>>,
}

impl MatchingEndDatetime {
    pub fn new(value: Option<DateTime<Utc>>) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &Option<DateTime<Utc>> {
        &self.value
    }

    // バリデーションの実装
    fn validate(_value: &Option<DateTime<Utc>>) {
        // MatchingStartDatetimeより後であることの検証は、
        // Matchingエンティティ側で行う
    }

    /// DynamoDB保存用のRFC3339形式の文字列に変換
    pub fn to_rfc3339(&self) -> Option<String> {
        self.value.map(|dt| dt.to_rfc3339())
    }
}

// 等価性の比較を実装
impl PartialEq for MatchingEndDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MatchingEndDatetime {}
