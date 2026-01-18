#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TurnStatusValue {
    StepSetting,   // 行動設定中
    UnitStepping,  // ユニット行動中
    Completed,     // ターン完了
}

#[derive(Debug, Clone)]
pub struct TurnStatus {
    value: TurnStatusValue,
}

impl TurnStatus {
    pub fn new(value: TurnStatusValue) -> Self {
        Self { value }
    }

    pub fn value(&self) -> &TurnStatusValue {
        &self.value
    }

    pub fn is_step_setting(&self) -> bool {
        matches!(self.value, TurnStatusValue::StepSetting)
    }

    pub fn is_unit_stepping(&self) -> bool {
        matches!(self.value, TurnStatusValue::UnitStepping)
    }

    pub fn is_completed(&self) -> bool {
        matches!(self.value, TurnStatusValue::Completed)
    }
}

impl PartialEq for TurnStatus {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for TurnStatus {}
