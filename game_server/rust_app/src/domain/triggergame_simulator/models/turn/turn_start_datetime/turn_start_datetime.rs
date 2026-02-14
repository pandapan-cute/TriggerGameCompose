use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnStartDatetime {
    value: DateTime<Utc>,
}

impl TurnStartDatetime {
    pub fn new(value: DateTime<Utc>) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }
}

impl PartialEq for TurnStartDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TurnStartDatetime {}
