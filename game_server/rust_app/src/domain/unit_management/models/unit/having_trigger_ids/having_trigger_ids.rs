use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
use pyo3::prelude::*;

#[pyclass]
#[derive(Debug, Clone)]
pub struct HavingTriggerIds {
    #[pyo3(get)]
    value: Vec<TriggerId>,
}

impl HavingTriggerIds {
    pub fn new(value: Vec<TriggerId>) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &Vec<TriggerId> {
        &self.value
    }

    pub fn is_empty(&self) -> bool {
        self.value.is_empty()
    }

    pub fn len(&self) -> usize {
        self.value.len()
    }

    /// 指定したトリガーIDが含まれているかを確認
    pub fn contains(&self, trigger_id: &TriggerId) -> bool {
        self.value.contains(trigger_id)
    }
}

// 等価性の比較を実装
impl PartialEq for HavingTriggerIds {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for HavingTriggerIds {}
