#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TurnStatusValue {
    StepSetting,  // 行動設定中
    UnitStepping, // ユニット行動中
    Completed,    // ターン完了
}

#[derive(Debug, Clone)]
pub struct TurnStatus {
    value: TurnStatusValue,
}

impl TurnStatus {
    pub fn new(value: TurnStatusValue) -> Self {
        Self { value }
    }
    /// 文字列から新しいインスタンスを生成
    /// データベースから取得した値からの変換に使用
    pub fn new_string(value: &str) -> Self {
        let status_value = match value {
            "StepSetting" => TurnStatusValue::StepSetting,
            "UnitStepping" => TurnStatusValue::UnitStepping,
            "Completed" => TurnStatusValue::Completed,
            _ => panic!("Invalid TurnStatusValue string"),
        };
        Self {
            value: status_value,
        }
    }

    pub fn fmt_value(&self) -> String {
        match self.value {
            TurnStatusValue::StepSetting => "StepSetting".to_string(),
            TurnStatusValue::UnitStepping => "UnitStepping".to_string(),
            TurnStatusValue::Completed => "Completed".to_string(),
        }
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
