use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StepId {
    value: String,
}

impl StepId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("StepIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("StepIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for StepId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for StepId {}
