use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AttackingUnitId {
    value: String,
}

impl AttackingUnitId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    fn validate(value: &str) {
        if value.is_empty() {
            panic!("AttackingUnitIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("AttackingUnitIdがUUID形式ではありません");
        }
    }
}

impl PartialEq for AttackingUnitId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for AttackingUnitId {}
