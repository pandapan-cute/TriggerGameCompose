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

    /// RFC3339形式の文字列から新しいインスタンスを生成
    /// データベースから取得した値からの変換に使用
    pub fn new_string(value: &str) -> Self {
        let value = value
            .parse::<DateTime<Utc>>()
            .expect("Invalid datetime format");
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }

    // バリデーションの実装
    fn validate(_value: &DateTime<Utc>) {}

    /// DynamoDB保存用のRFC3339形式の文字列に変換
    pub fn to_rfc3339(&self) -> String {
        self.value.to_rfc3339()
    }
}

// 等価性の比較を実装
impl PartialEq for MatchingStartDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MatchingStartDatetime {}
