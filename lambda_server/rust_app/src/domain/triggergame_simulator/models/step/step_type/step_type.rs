#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StepTypeValue {
    Move,          // 移動
    Attack,        // 攻撃
    Wait,          // 待機
    Guard,         // ガード
    UniqueCommand, // ユニークコマンド
    PursuitMove,   // 追撃移動
}

#[derive(Debug, Clone)]
pub struct StepType {
    value: StepTypeValue,
}

impl StepType {
    pub fn new(value: StepTypeValue) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &StepTypeValue {
        &self.value
    }

    pub fn is_move(&self) -> bool {
        matches!(self.value, StepTypeValue::Move)
    }

    pub fn is_attack(&self) -> bool {
        matches!(self.value, StepTypeValue::Attack)
    }

    pub fn is_wait(&self) -> bool {
        matches!(self.value, StepTypeValue::Wait)
    }

    pub fn is_guard(&self) -> bool {
        matches!(self.value, StepTypeValue::Guard)
    }

    pub fn is_unique_command(&self) -> bool {
        matches!(self.value, StepTypeValue::UniqueCommand)
    }

    pub fn is_pursuit_move(&self) -> bool {
        matches!(self.value, StepTypeValue::PursuitMove)
    }
}

impl PartialEq for StepType {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for StepType {}
