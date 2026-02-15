use std::collections::HashMap;
use std::hash::Hash;

use crate::domain::triggergame_simulator::models::action::Action;
use crate::domain::triggergame_simulator::models::combat::Combat;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::unit_management::models::unit::{
    position::position::Position, trigger_id::trigger_id::TriggerId, unit_id::unit_id::UnitId, Unit,
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;
/// Step集約
/// ユニットの1つの行動を表すエンティティ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    step_id: StepId,
    actions: Vec<Action>,
}

impl Step {
    // privateなコンストラクタ
    pub fn new(step_id: StepId, actions: Vec<Action>) -> Self {
        Self { step_id, actions }
    }

    /// 新規ステップの生成
    pub fn create(step_id: StepId, actions: Vec<Action>) -> Self {
        Self::new(step_id, actions)
    }

    /// 戦闘演算の開始
    pub fn step_start(&mut self, units: &mut HashMap<UnitId, Unit>) -> Result<(), String> {
        // 1. アクションとユニットの整合性チェック
        for action in &self.actions {
            // 対応するユニットが存在しなければエラー
            if let None = units.get_mut(action.unit_id()) {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            }
        }

        // 2. アクションに従ってユニットの移動と使用トリガーの設定、を行う
        for action in &self.actions {
            let unit = units.get_mut(action.unit_id()).unwrap();
            // ユニットの位置を更新
            unit.move_to(action.position().clone());
            // 使用中のメイントリガーを更新
            let _ = unit.set_using_triggers(
                &action.using_main_trigger_id(),
                &action.using_sub_trigger_id(),
            );
            // トリガーの向きを更新
            unit.set_main_trigger_azimuth(action.main_trigger_azimuth().clone());
            unit.set_sub_trigger_azimuth(action.sub_trigger_azimuth().clone());
        }

        // 3. トリガー範囲内に敵キャラクターがいるか確認し、combatの初期化までを行う
        let mut combats = Vec::<Combat>::new();
        for action in &self.actions {
            let attack_unit = units.get(&action.unit_id()).unwrap();

            for defence_unit in units.values() {
                // 自ユニットはスキップ
                if attack_unit.owner_player_id() == defence_unit.owner_player_id() {
                    continue;
                }
                // 防御側ユニットに対してcombatを生成していく
                // 防御側ユニットのアクションから、防御型ユニットのトリガーの向きを取得
                let defender_action = self
                    .actions
                    .iter()
                    .find(|a| a.unit_id().value() == defence_unit.unit_id().value());

                if defender_action.is_none() {
                    println!(
                        "防御側ユニットID {:?} に対応するアクションが見つかりません, アクション一覧: {:?}",
                        defence_unit.unit_id(),
                        self.actions.iter().map(|a| a.unit_id()).collect::<Vec<&UnitId>>()
                    );
                }
                // 射程やトリガーの有効範囲の判定は、Actionのcreate内で行う
                if let Some(combat) = action.generate_combats(defence_unit) {
                    combats.push(combat);
                }
            }
        }
        Ok(())
    }

    /// 他のステップのアクションを結合
    pub fn merge_actions(&mut self, other: &Step) -> Result<(), String> {
        // 他のステップのアクションを自分のアクションリストに追加
        self.actions.extend(other.actions.clone());
        Ok(())
    }

    // ゲッター
    pub fn step_id(&self) -> &StepId {
        &self.step_id
    }

    pub fn actions(&self) -> &Vec<Action> {
        &self.actions
    }
}

impl PartialEq for Step {
    fn eq(&self, other: &Self) -> bool {
        self.step_id == other.step_id
    }
}

impl Eq for Step {}
