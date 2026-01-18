#[derive(Debug, Clone)]
pub struct WaitTime {
    value: i32,
}

impl WaitTime {
    pub fn new(value: i32) -> Self {
        Self::validate(value);
        Self { value }
    }

    pub fn value(&self) -> i32 {
        self.value
    }

    // バリデーションの実装
    fn validate(value: i32) {
        if value < 0 {
            panic!("WaitTimeは0以上である必要があります");
        }
    }
}

// 等価性の比較を実装
impl PartialEq for WaitTime {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for WaitTime {}
