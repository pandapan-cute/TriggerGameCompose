#[derive(Debug, Clone)]
pub struct CurrentTurnNumber {
    value: i32,
}

impl CurrentTurnNumber {
    pub fn new(value: i32) -> Self {
        Self::validate(value);
        Self { value }
    }

    pub fn value(&self) -> i32 {
        self.value
    }

    pub fn initial() -> Self {
        Self { value: 1 }
    }

    fn validate(value: i32) {
        if value < 1 {
            panic!("CurrentTurnNumberは1以上である必要があります");
        }
    }
}

impl PartialEq for CurrentTurnNumber {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for CurrentTurnNumber {}
