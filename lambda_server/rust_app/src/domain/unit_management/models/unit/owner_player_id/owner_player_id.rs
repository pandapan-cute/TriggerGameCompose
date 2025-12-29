use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct OwnerPlayerId {
    value: String,
}

impl OwnerPlayerId {
    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    // バリデーションの実装
    fn validate(value: &str) {
        if value.is_empty() {
            panic!("OwnerPlayerIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("OwnerPlayerIdがUUID形式ではありません");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for OwnerPlayerId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for OwnerPlayerId {}
