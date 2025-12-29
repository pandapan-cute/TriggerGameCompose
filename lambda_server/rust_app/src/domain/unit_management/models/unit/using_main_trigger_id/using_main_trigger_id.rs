#[derive(Debug, Clone)]
pub struct UsingMainTriggerId {
    value: String,
}

impl UsingMainTriggerId {
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
            panic!("UsingMainTriggerIdは1文字以上である必要があります");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for UsingMainTriggerId {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for UsingMainTriggerId {}
