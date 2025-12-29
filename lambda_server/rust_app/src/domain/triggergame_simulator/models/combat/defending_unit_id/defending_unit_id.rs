use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct DefendingUnitId {
    value: String,
}

impl DefendingUnitId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("DefendingUnitIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("DefendingUnitIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for DefendingUnitId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for DefendingUnitId {}
