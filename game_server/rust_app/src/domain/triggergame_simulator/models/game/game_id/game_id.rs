use pyo3::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[pyclass]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct GameId {
    #[pyo3(get)]
    value: String,
}

impl GameId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn initial() -> Self {
        let uuid = Uuid::new_v4();
        Self {
            value: uuid.to_string(),
        }
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
