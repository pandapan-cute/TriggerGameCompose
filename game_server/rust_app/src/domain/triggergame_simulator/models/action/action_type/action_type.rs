use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionTypeValue {
    Move,          // 移動
    Wait,          // 待機
    Guard,         // 護衛
    UniqueCommand, // ユニークコマンド
    PursuitMove,   // 追撃移動
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionType {
    value: ActionTypeValue,
}

impl ActionType {
    pub fn new(value: ActionTypeValue) -> Self {
        Self { value }
    }

    pub fn new_string(value: String) -> Self {
        let value = match value.as_str() {
            "MOVE" => ActionTypeValue::Move,
            "WAIT" => ActionTypeValue::Wait,
            "GUARD" => ActionTypeValue::Guard,
            "UNIQUECOMMAND" => ActionTypeValue::UniqueCommand,
            "PURSUITMOVE" => ActionTypeValue::PursuitMove,
            _ => panic!("Invalid ActionType string"),
        };
        Self { value }
    }

    pub fn fmt_value(&self) -> String {
        match self.value {
            ActionTypeValue::Move => "MOVE".to_string(),
            ActionTypeValue::Wait => "WAIT".to_string(),
            ActionTypeValue::Guard => "GUARD".to_string(),
            ActionTypeValue::UniqueCommand => "UNIQUECOMMAND".to_string(),
            ActionTypeValue::PursuitMove => "PURSUITMOVE".to_string(),
        }
    }
    pub fn value(&self) -> &ActionTypeValue {
        &self.value
    }

    pub fn is_move(&self) -> bool {
        matches!(self.value, ActionTypeValue::Move)
    }

    pub fn is_wait(&self) -> bool {
        matches!(self.value, ActionTypeValue::Wait)
    }

    pub fn is_guard(&self) -> bool {
        matches!(self.value, ActionTypeValue::Guard)
    }

    pub fn is_unique_command(&self) -> bool {
        matches!(self.value, ActionTypeValue::UniqueCommand)
    }

    pub fn is_pursuit_move(&self) -> bool {
        matches!(self.value, ActionTypeValue::PursuitMove)
    }
}

impl PartialEq for ActionType {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for ActionType {}
