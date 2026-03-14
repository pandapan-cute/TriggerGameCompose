use std::collections::HashMap;
use std::hash::Hash;

use crate::domain::player_management::models::player;
use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action::Action;
use crate::domain::triggergame_simulator::models::combat::Combat;
use crate::domain::triggergame_simulator::models::game::visibility::{self, Visibility};
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
    combats: Vec<Combat>,
    visibility_cells: Vec<Vec<bool>>,
}

impl Step {
    // privateなコンストラクタ
    pub fn new(
        step_id: StepId,
        actions: Vec<Action>,
        combats: Vec<Combat>,
        visibility_cells: Vec<Vec<bool>>,
    ) -> Self {
        Self {
            step_id,
            actions,
            combats,
            visibility_cells,
        }
    }

    /// 新規ステップの生成
    pub fn create(
        step_id: StepId,
        actions: Vec<Action>,
        combats: Vec<Combat>,
        visibility_cells: Vec<Vec<bool>>,
    ) -> Self {
        Self::new(step_id, actions, combats, visibility_cells)
    }

    /// 戦闘演算の開始
    pub fn step_start(
        &mut self,
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 1. アクションとユニットの整合性チェック
        for action in &self.actions {
            // 対応するユニットが存在しなければエラー
            if let None = units.iter_mut().find(|u| u.unit_id() == action.unit_id()) {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            }
        }

        // 2. アクションに従ってユニットの移動と使用トリガーの設定、を行う
        for action in &self.actions {
            let unit = units
                .iter_mut()
                .find(|u| u.unit_id() == action.unit_id())
                .unwrap();
            if unit.is_bailed_out() {
                println!("ユニットID {:?} の移動をスキップ", unit.unit_id());
                continue;
            }
            // ユニットの位置を更新
            unit.move_to(action.position().clone(), visibility);

            const ACTION_POINT_CAN_UPDATE_TRIGGER: i32 = 1; // 消費はしないが、トリガーの更新が可能な行動ポイントの閾値
            if unit.current_action_points().value() >= ACTION_POINT_CAN_UPDATE_TRIGGER {
                // 使用中のメイントリガーを更新
                let _ = unit.set_using_triggers(
                    &action.using_main_trigger_id(),
                    &action.using_sub_trigger_id(),
                );
                // トリガーの向きを更新
                unit.set_main_trigger_azimuth(action.main_trigger_azimuth().clone());
                unit.set_sub_trigger_azimuth(action.sub_trigger_azimuth().clone());
            } else {
                print!("トリガーの更新に必要な行動ポイントが不足しています。unit_id={:?}, current_action_points={}, required_action_points={}", unit.unit_id(), unit.current_action_points().value(), ACTION_POINT_CAN_UPDATE_TRIGGER);
            }
        }

        // 3. トリガー範囲内に敵キャラクターがいるか確認し、combatの初期化までを行う
        // attacker_unit検索用にクローンしておく
        let attack_units = units.clone();
        for action in &self.actions {
            const ACTION_POINT_CAN_ATTACK: i32 = 1; // 攻撃で消費する行動ポイントの閾値
            let attack_unit = attack_units
                .iter()
                .find(|u| u.unit_id() == action.unit_id())
                .unwrap();
            if attack_unit.current_action_points().value() < ACTION_POINT_CAN_ATTACK {
                // 行動ポイントが1未満のユニットは攻撃できない
                continue;
            }
            if attack_unit.is_bailed_out() {
                println!("ユニットID {:?} の攻撃をスキップ", attack_unit.unit_id());
                continue;
            }
            for defence_unit in units.iter_mut() {
                // 自ユニットはスキップ
                if attack_unit.owner_player_id() == defence_unit.owner_player_id() {
                    continue;
                }
                if defence_unit.is_bailed_out() {
                    println!("ユニットID {:?} の戦闘をスキップ", defence_unit.unit_id());
                    continue;
                }
                // 射程やトリガーの有効範囲の判定は、Actionのcreate内で行う
                if let Some(combat) = action.generate_combats(defence_unit, visibility) {
                    self.combats.push(combat);
                }
            }
        }
        Ok(())
    }

    /// プレイヤーごとに見せるべき情報をフィルタリングする処理
    pub fn to_player_step(
        &mut self,
        player_id: &PlayerId,
        units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Step {
        self.actions.iter_mut().for_each(|action| {
            action.to_player_action(player_id, units, visibility);
        });
        // プレイヤーから見た視界を計算して、visibility_cellsを更新する
        let player_units: Vec<Unit> = units
            .iter()
            .filter(|u| u.owner_player_id() == player_id)
            .cloned()
            .collect();
        self.visibility_cells = visibility.calculate_visibility(&player_units);
        self.clone()
    }

    // ゲッター
    pub fn step_id(&self) -> &StepId {
        &self.step_id
    }

    pub fn actions(&self) -> &Vec<Action> {
        &self.actions
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
