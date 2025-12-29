use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MatchingId {
    value: String,
}

impl MatchingId {
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
            panic!("MatchingIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("MatchingIdがUUID形式ではありません");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for MatchingId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MatchingId {}
