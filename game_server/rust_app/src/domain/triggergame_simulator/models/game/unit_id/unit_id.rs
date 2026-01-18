use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct UnitId {
    value: String,
}

impl UnitId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &String {
        &self.value
    }

    fn validate(value: &String) {
        if value.is_empty() {
            panic!("UnitIdに空文字が含まれています");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("UnitIdがUUID形式ではありません: {}", value);
        }
    }
}

impl PartialEq for UnitId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for UnitId {}
