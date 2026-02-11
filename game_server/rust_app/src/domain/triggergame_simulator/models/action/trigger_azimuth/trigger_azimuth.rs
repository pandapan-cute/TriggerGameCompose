use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerAzimuth {
    value: i32,
}

impl TriggerAzimuth {
    const MAX: i32 = 359;
    const MIN: i32 = 0;

    pub fn new(value: i32) -> Self {
        Self::validate(value);
        Self { value }
    }

    pub fn value(&self) -> i32 {
        self.value
    }

    fn validate(value: i32) {
        if value < Self::MIN {
            panic!("TriggerAzimuthは{}以上である必要があります", Self::MIN);
        }
        if value > Self::MAX {
            panic!("TriggerAzimuthは{}以下である必要があります", Self::MAX);
        }
    }
}

impl PartialEq for TriggerAzimuth {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TriggerAzimuth {}
