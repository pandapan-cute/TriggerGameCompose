#[derive(Debug, Clone)]
pub struct TurnNumber {
    value: i32,
}

impl TurnNumber {
    const MAX: i32 = 6;
    const MIN: i32 = 1;

    pub fn new(value: i32) -> Self {
        Self::validate(value);
        Self { value }
    }

    pub fn value(&self) -> i32 {
        self.value
    }

    fn validate(value: i32) {
        if value < Self::MIN {
            panic!("TurnNumberは{}以上である必要があります", Self::MIN);
        }
        if value > Self::MAX {
            panic!("TurnNumberは{}以下である必要があります", Self::MAX);
        }
    }
}

impl PartialEq for TurnNumber {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TurnNumber {}
