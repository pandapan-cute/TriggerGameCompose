use pyo3::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[pyclass]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TurnId {
    #[pyo3(get)]
    value: String,
}

impl TurnId {
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
            panic!("TurnIdが空文字です");
        }
    }
}

impl PartialEq for TurnId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TurnId {}
