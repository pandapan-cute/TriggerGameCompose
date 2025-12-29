use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct TurnEndDatetime {
    value: DateTime<Utc>,
}

impl TurnEndDatetime {
    pub fn new(value: DateTime<Utc>) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &DateTime<Utc> {
        &self.value
    }
}

impl PartialEq for TurnEndDatetime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TurnEndDatetime {}
