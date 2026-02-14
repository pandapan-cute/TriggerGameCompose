use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct GameId {
    value: String,
}

impl GameId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("GameIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("GameIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for GameId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for GameId {}
