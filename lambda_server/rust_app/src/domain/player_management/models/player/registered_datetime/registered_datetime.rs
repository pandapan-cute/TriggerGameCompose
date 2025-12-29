use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct RegisteredDatetime {
    value: DateTime<Utc>,
}

impl RegisteredDatetime {
    pub fn new(value: DateTime<Utc>) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }

    // バリデーションの実装
    fn validate(_value: &DateTime<Utc>) {
        // 登録日時の妥当性チェックは必要に応じて実装
        // 例: 未来の日時は不可など
    }
}

// 等価性の比較を実装
impl PartialEq for RegisteredDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for RegisteredDatetime {}
