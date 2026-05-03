use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action::Action;
use crate::domain::triggergame_simulator::models::combat::Combat;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::triggergame_simulator::services::{
    step_execution_service::StepExecutionService,
    visibility_projection_service::VisibilityProjectionService,
};
use crate::domain::unit_management::models::unit::Unit;
use serde::{Deserialize, Serialize};
/// Step集約
/// ユニットの1つの行動を表すエンティティ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    step_id: StepId,
    actions: Vec<Action>,
    combats: Vec<Combat>,
}

impl Step {
    // privateなコンストラクタ
    pub fn new(step_id: StepId, actions: Vec<Action>, combats: Vec<Combat>) -> Self {
        Self {
            step_id,
            actions,
            combats,
        }
    }

    /// 新規ステップの生成
    pub fn create(step_id: StepId, actions: Vec<Action>, combats: Vec<Combat>) -> Self {
        Self::new(step_id, actions, combats)
    }

    /// 戦闘演算の開始
    pub fn step_start(
        &mut self,
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        StepExecutionService::new().execute_step(self, units, visibility)
    }

    /// プレイヤーごとに見せるべき情報をフィルタリングする処理
    pub fn to_player_step(
        &mut self,
        player_id: &PlayerId,
        units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Step {
        VisibilityProjectionService::new()
            .project_step_for_player(self, player_id, units, visibility)
    }

    // ゲッター
    pub fn step_id(&self) -> &StepId {
        &self.step_id
    }

    pub fn actions(&self) -> &Vec<Action> {
        &self.actions
    }

    pub fn actions_mut(&mut self) -> &mut Vec<Action> {
        &mut self.actions
    }

    pub fn push_combat(&mut self, combat: Combat) {
        self.combats.push(combat);
    }

    // セッター的なもの
    pub fn push_actions(&mut self, new_actions: &Vec<Action>) {
        self.actions.extend(new_actions.clone());
    }
}

impl PartialEq for Step {
    fn eq(&self, other: &Self) -> bool {
        self.step_id == other.step_id
    }
}

impl Eq for Step {}
