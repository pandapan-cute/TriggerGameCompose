use pyo3::prelude::*;
use serde::{Deserialize, Serialize};

#[pyclass]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct WaitTime {
    #[pyo3(get)]
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

    /// 待機時間を増加
    pub fn increase(&mut self, amount: i32) {
        let new_value = self.value + amount;
        Self::validate(new_value);
        self.value = new_value;
    }

    /// 待機時間を1減少
    pub fn decrease(&mut self) {
        // 待機時間が1以上の場合のみ減少させる
        if self.value >= 1 {
            let new_value: i32 = self.value - 1;
            Self::validate(new_value);
            self.value = new_value;
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
