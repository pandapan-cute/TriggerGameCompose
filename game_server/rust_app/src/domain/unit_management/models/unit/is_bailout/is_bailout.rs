#[derive(Debug, Clone)]
pub struct IsBailout {
    value: bool,
}

impl IsBailout {
    pub fn new(value: bool) -> Self {
        Self { value }
    }

    pub fn value(&self) -> bool {
        self.value
    }

    pub fn is_bailout(&self) -> bool {
        self.value
    }

    pub fn is_active(&self) -> bool {
        !self.value
    }
}

// 等価性の比較を実装
impl PartialEq for IsBailout {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for IsBailout {}
