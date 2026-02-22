use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct IsAvoided {
    value: bool,
}

impl IsAvoided {
    pub fn new(value: bool) -> Self {
        Self { value }
    }

    pub fn value(&self) -> bool {
        self.value
    }

    pub fn is_avoided(&self) -> bool {
        self.value
    }

    pub fn is_hit(&self) -> bool {
        !self.value
    }
}

impl PartialEq for IsAvoided {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for IsAvoided {}
