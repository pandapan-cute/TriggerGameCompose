#[derive(Debug, Clone)]
pub struct PlayerName {
    value: String,
}

impl PlayerName {
    const MAX_LENGTH: usize = 20;
    const MIN_LENGTH: usize = 1;

    pub fn new(value: String) -> Self {
        Self::validate(&value);
        Self { value }
    }

    pub fn value(&self) -> &str {
        &self.value
    }

    // バリデーションの実装
    fn validate(value: &str) {
        let length = value.chars().count();
        
        if length < Self::MIN_LENGTH {
            panic!("PlayerNameは{}文字以上である必要があります", Self::MIN_LENGTH);
        }
        
        if length > Self::MAX_LENGTH {
            panic!("PlayerNameは{}文字以下である必要があります", Self::MAX_LENGTH);
        }
    }
}

// 等価性の比較を実装
impl PartialEq for PlayerName {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for PlayerName {}
