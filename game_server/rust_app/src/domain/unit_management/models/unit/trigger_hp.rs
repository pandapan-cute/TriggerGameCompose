use pyo3::prelude::*;
use serde::{Deserialize, Serialize};

#[pyclass]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TriggerHP {
    #[pyo3(get)]
    value: i32,
}

impl TriggerHP {
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
            panic!("TriggerHPは0以上である必要があります");
        }
    }

    /// TriggerHPを全回復させる。
    pub fn restore(&mut self) {
        // ここでは仮に最大HPを100とする。
        self.value = 100;
    }

    /// TriggerHPを減少させる。減少後の値が0未満になる場合は0にする。
    pub fn decrease(&mut self, amount: i32) {
        if amount < 0 {
            panic!("減少量は0以上である必要があります");
        }
        self.value = (self.value - amount).max(0);
    }

    /// TriggerHPが0以下かどうかを判定する。
    pub fn is_depleted(&self) -> bool {
        self.value <= 0
    }
}

// 等価性の比較を実装
impl PartialEq for TriggerHP {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TriggerHP {}

#[cfg(test)]
mod tests {

    use super::TriggerHP;

    #[test]
    fn test_valid_value() {
        let hp = TriggerHP::new(100);
        assert_eq!(hp.value(), 100);
    }

    #[test]
    fn test_zero_value() {
        let hp = TriggerHP::new(0);
        assert_eq!(hp.value(), 0);
    }

    #[test]
    #[should_panic(expected = "TriggerHPは0以上である必要があります")]
    fn test_negative_value_panic() {
        TriggerHP::new(-1);
    }

    #[test]
    fn test_equality() {
        let hp1 = TriggerHP::new(75);
        let hp2 = TriggerHP::new(75);
        assert_eq!(hp1, hp2);
    }
}
