use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerId {
    value: String,
}

impl PlayerId {
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
            panic!("PlayerIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("PlayerIdがUUID形式ではありません");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for PlayerId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for PlayerId {}
