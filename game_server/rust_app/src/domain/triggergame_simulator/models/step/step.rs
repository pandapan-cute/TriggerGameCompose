use super::step_id::step_id::StepId;
use super::step_type::step_type::{StepType, StepTypeValue};
use uuid::Uuid;

/// Step集約
/// ユニットの1つの行動を表すエンティティ
#[derive(Debug, Clone)]
pub struct Step {
    step_id: StepId,
    step_type: StepType,
}

impl Step {
    // privateなコンストラクタ
    fn new(step_id: StepId, step_type: StepType) -> Self {
        Self { step_id, step_type }
    }

    /// 新規ステップの生成
    pub fn create(step_type: StepType) -> Self {
        let step_id = StepId::new(Uuid::new_v4().to_string());
        Self::new(step_id, step_type)
    }

    /// ステップの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(step_id: StepId, step_type: StepType) -> Self {
        Self::new(step_id, step_type)
    }

    /// ステップタイプを変更
    pub fn change_step_type(&mut self, new_step_type: StepType) {
        self.step_type = new_step_type;
    }

    /// 移動ステップかどうか
    pub fn is_move(&self) -> bool {
        self.step_type.is_move()
    }

    /// 攻撃ステップかどうか
    pub fn is_attack(&self) -> bool {
        self.step_type.is_attack()
    }

    /// 待機ステップかどうか
    pub fn is_wait(&self) -> bool {
        self.step_type.is_wait()
    }

    /// ガードステップかどうか
    pub fn is_guard(&self) -> bool {
        self.step_type.is_guard()
    }

    /// ユニークコマンドステップかどうか
    pub fn is_unique_command(&self) -> bool {
        self.step_type.is_unique_command()
    }

    /// 追撃移動ステップかどうか
    pub fn is_pursuit_move(&self) -> bool {
        self.step_type.is_pursuit_move()
    }

    // ゲッター
    pub fn step_id(&self) -> &StepId {
        &self.step_id
    }

    pub fn step_type(&self) -> &StepType {
        &self.step_type
    }
}

impl PartialEq for Step {
    fn eq(&self, other: &Self) -> bool {
        self.step_id == other.step_id
    }
}

impl Eq for Step {}
