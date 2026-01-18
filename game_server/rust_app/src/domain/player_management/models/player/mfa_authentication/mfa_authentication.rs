#[derive(Debug, Clone)]
pub struct MFAAuthentication {
    value: bool,
}

impl MFAAuthentication {
    pub fn new(value: bool) -> Self {
        Self { value }
    }

    pub fn value(&self) -> bool {
        self.value
    }

    pub fn is_enabled(&self) -> bool {
        self.value
    }

    pub fn is_disabled(&self) -> bool {
        !self.value
    }
}

// 等価性の比較を実装
impl PartialEq for MFAAuthentication {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for MFAAuthentication {}
