use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct PlayerId {
    value: String,
}

impl PlayerId {
    pub fn new(value: &str) -> Self {
        Self::validate(&value);
        Self {
            value: value.to_string(),
        }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    // バリデーションの実装
    fn validate(value: &str) {
        if value.is_empty() {
            panic!("PlayerIdが空文字です");
        }
        if Uuid::parse_str(value).is_err() {
            panic!("PlayerIdがUUID形式ではありません");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for PlayerId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for PlayerId {}
