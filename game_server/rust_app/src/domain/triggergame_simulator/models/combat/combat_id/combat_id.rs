use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CombatId {
    value: String,
}

impl CombatId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("CombatIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("CombatIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for CombatId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for CombatId {}
