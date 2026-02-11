use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UnitId {
    value: String,
}

impl UnitId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    // バリデーションの実装
    fn validate(value: &str) {
        if value.is_empty() {
            panic!("UnitIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("UnitIdがUUID形式ではありません");
        }
    }
}

