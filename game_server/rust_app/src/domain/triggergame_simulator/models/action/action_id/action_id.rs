use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionId {
    value: String,
}

impl ActionId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("ActionIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("ActionIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for ActionId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for ActionId {}
