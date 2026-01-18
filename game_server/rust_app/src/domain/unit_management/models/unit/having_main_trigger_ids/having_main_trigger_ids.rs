#[derive(Debug, Clone)]
pub struct HavingMainTriggerIds {
    value: Vec<String>,
}

impl HavingMainTriggerIds {
    pub fn new(value: Vec<String>) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &Vec<String> {
        &self.value
    }

    pub fn is_empty(&self) -> bool {
        self.value.is_empty()
    }

    pub fn len(&self) -> usize {
        self.value.len()
    }
}

// 等価性の比較を実装
impl PartialEq for HavingMainTriggerIds {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for HavingMainTriggerIds {}
