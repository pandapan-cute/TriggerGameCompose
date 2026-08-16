use crate::domain::triggergame_simulator::models::{
    action::action::Action,
    action::action_type::action_type::{ActionType, ActionTypeValue},
    game::visibility::Visibility,
    step::step::Step,
};
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::Unit;
use std::collections::{HashMap, VecDeque};

/// Step実行のドメインサービス。
///
/// `src/domain/triggergame_simulator/models/step/step.rs` の
/// `Step::step_start` にある処理手順を抽出する移管先。
pub struct StepExecutionService;

impl StepExecutionService {
    /// `StepExecutionService` を生成する。
    pub fn new() -> Self {
        Self
    }

    /// マージ済みStepを1件シミュレーション実行する。
    ///
    /// # 引数
    /// - `step`: actionsを保持し、生成したcombatを書き込む対象のStep集約。
    /// - `units`: 現在ターンのユニット一覧（可変）。
    /// - `visibility`: 移動・戦闘判定で更新される視界モデル（可変）。
    ///
    /// # 戻り値
    /// - `Ok(())`: すべてのサブ処理が完了した場合。
    /// - `Err(String)`: 検証失敗やシミュレーション前提条件の不整合がある場合。
    pub fn execute_step(
        &self,
        step: &mut Step,
        pending_actions_by_unit: &mut HashMap<UnitId, VecDeque<Action>>,
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の全体オーケストレーション

        // 1) アクションと対象ユニットの整合性を検証する。
        self.validate_action_targets(step, units, pending_actions_by_unit)?;

        // 2) 移動とトリガー状態更新を適用する。
        self.apply_action_movements(step, units, pending_actions_by_unit, visibility)?;

        // 3) 有効射程に基づいてcombatを生成する。
        self.generate_combats(step, units, visibility)?;

        // 4) actionの行動力を更新
        self.update_action_points(step, units);

        // 5) ステップ内でガードしたかをリセットする
        self.reset_guard_status(units);
        Ok(())
    }

    /// 各アクションが既存ユニットを参照しているか検証する。
    ///
    /// # 引数
    /// - `step`: 検証対象アクションを持つStep。
    /// - `units`: アクションの参照先ユニットを解決するためのユニット一覧。
    ///
    /// # 戻り値
    /// - `Ok(())`: すべてのアクションが有効な場合。
    /// - `Err(String)`: 存在しないユニット参照が1件以上ある場合。
    pub fn validate_action_targets(
        &self,
        step: &Step,
        units: &Vec<Unit>,
        pending_actions_by_unit: &HashMap<UnitId, VecDeque<Action>>,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「1. アクションとユニットの整合性チェック」

        // pending_actions_by_unit -> unit の対応を検証し、不一致時はドメインエラーを返す。
        for unit_id in pending_actions_by_unit.keys() {
            if units.iter().all(|u| u.unit_id() != unit_id) {
                return Err(format!(
                    "ユニットID {:?} が未消費アクションキューに見つかりますが、units に存在しません",
                    unit_id
                ));
            }
        }

        // action -> unit の対応を検証し、不一致時はドメインエラーを返す。
        for action in step.actions() {
            // 目的: 各アクションが存在するユニットを参照しているかを検証する。
            if units.iter().all(|u| u.unit_id() != action.unit_id()) {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            }
        }

        Ok(())
    }

    /// 各アクションに応じて移動とトリガー向き更新を適用する。
    ///
    /// # 引数
    /// - `step`: 実行対象アクションを提供するStep。
    /// - `units`: 位置・トリガー状態を更新するユニット一覧（可変）。
    /// - `visibility`: ユニット移動時に更新される視界モデル（可変）。
    ///
    /// # 戻り値
    /// - `Ok(())`: 対象ユニット更新が完了した場合。
    /// - `Err(String)`: 必須のドメイン更新に失敗した場合。
    pub fn apply_action_movements(
        &self,
        step: &mut Step,
        units: &mut Vec<Unit>,
        pending_actions_by_unit: &mut HashMap<UnitId, VecDeque<Action>>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「2. アクションに従ってユニットの移動と使用トリガーの設定」

        // 各ユニットの待機時間を1減少させる
        for unit in units.iter_mut() {
            unit.decrease_wait_time();
        }

        // pending_actions_by_unit から各ユニットの先頭アクションを1件ずつ取り出す。
        let mut queued_actions = Vec::new();
        for queue in pending_actions_by_unit.values_mut() {
            if let Some(action) = queue.pop_front() {
                queued_actions.push(action);
            }
        }

        // 各アクションごとに:
        // - 離脱済みユニットはスキップ
        // - ユニットを移動
        // - 行動ポイント条件を満たす場合にトリガーID/方位角を更新
        let mut executed_actions = Vec::new();
        for mut action in queued_actions {
            let Some(unit) = units.iter_mut().find(|u| u.unit_id() == action.unit_id()) else {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            };

            // 目的: 離脱済みユニットには移動・トリガー更新を適用しない。
            if unit.is_bailed_out() || unit.wait_time().value() > 0 {
                // この分岐に入る条件: 対象ユニットが離脱済み または 待機中 の場合。
                println!("ユニットID {:?} の移動をスキップ", unit.unit_id());
                continue;
            }

            unit.move_to(&mut action, visibility);

            let _ = unit.set_using_triggers(
                &action.using_main_trigger_id(),
                &action.using_sub_trigger_id(),
            );
            unit.set_main_trigger_azimuth(action.main_trigger_azimuth().clone());
            unit.set_sub_trigger_azimuth(action.sub_trigger_azimuth().clone());
            executed_actions.push(action);
        }

        step.actions_mut().clear();
        step.actions_mut().extend(executed_actions);

        // actionが未指定のユニットには待機アクションを補完する。
        let acted_unit_ids = step
            .actions()
            .iter()
            .map(|a| a.unit_id().clone())
            .collect::<Vec<_>>();

        let wait_actions = units
            .iter()
            .filter(|unit| {
                acted_unit_ids
                    .iter()
                    .all(|acted_id| acted_id != unit.unit_id())
            })
            .map(|unit| {
                Action::create(
                    ActionType::new(ActionTypeValue::Wait),
                    unit.unit_id().clone(),
                    unit.unit_type_id().clone(),
                    unit.position().clone(),
                    unit.using_main_trigger_id().clone(),
                    unit.using_sub_trigger_id().clone(),
                    unit.main_trigger_azimuth().clone(),
                    unit.sub_trigger_azimuth().clone(),
                    unit.current_action_points().clone(),
                )
            })
            .collect::<Vec<_>>();

        step.actions_mut().extend(wait_actions);

        Ok(())
    }

    /// アクションからcombatを生成し、Stepへ追加する。
    ///
    /// # 引数
    /// - `step`: 生成したcombatの格納先となるStep（可変）。
    /// - `units`: 攻撃・防御判定で利用するユニット一覧（可変）。
    /// - `visibility`: combat生成判定で利用する視界モデル。
    ///
    /// # 戻り値
    /// - `Ok(())`: combat生成処理が完了した場合。
    /// - `Err(String)`: combat生成の前提条件が満たされない場合。
    pub fn generate_combats(
        &self,
        step: &mut Step,
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「3. トリガー範囲内に敵キャラクターがいるか確認し、combatの初期化」

        const ACTION_POINT_CAN_ATTACK: i32 = 1;

        let mut generated_combats = Vec::new();

        // 各攻撃側アクションごとに:
        // - 行動ポイントと離脱状態を判定
        // - 敵ユニットを走査
        // - combatを生成してpush
        for action in step.actions() {
            // `units` 内のインデックスを見つける。クローンせずに直接 `units` を操作する。
            let attack_idx = units
                .iter()
                .position(|u| u.unit_id() == action.unit_id())
                .ok_or(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ))?;

            // 行動ポイントや離脱状態のチェックは一時的に共有参照で行う。
            if units[attack_idx].current_action_points().value() < ACTION_POINT_CAN_ATTACK {
                // 行動ポイント不足で攻撃不可な場合。
                // 各トリガーでの攻撃可能な行動力が残っているかは、combat生成時に個別に判定されるため、ここではスキップする。
                continue;
            }
            if units[attack_idx].is_bailed_out() {
                println!(
                    "ユニットID {:?} の攻撃をスキップ",
                    units[attack_idx].unit_id()
                );
                continue;
            }

            // 防御側は全ユニットを走査する（同一プレイヤーや離脱済みを除外）。
            for defence_idx in 0..units.len() {
                if attack_idx == defence_idx {
                    continue;
                }

                // `split_at_mut` によって同じベクタから同時に2つの可変参照を作る。
                // (指定したインデックスを境界にして「左側」と「右側」の2つの可変スライスに分割する関数)
                let (attack_unit, defence_unit) = if attack_idx < defence_idx {
                    let (left, right) = units.split_at_mut(defence_idx);
                    (&mut left[attack_idx], &mut right[0])
                } else {
                    let (left, right) = units.split_at_mut(attack_idx);
                    (&mut right[0], &mut left[defence_idx])
                };

                // 同一プレイヤー間の戦闘判定を除外する。
                if attack_unit.owner_player_id() == defence_unit.owner_player_id() {
                    continue;
                }
                // 離脱済みの防御側ユニットは戦闘対象外にする。
                if defence_unit.is_bailed_out() {
                    println!("ユニットID {:?} の戦闘をスキップ", defence_unit.unit_id());
                    continue;
                }

                // 射程・視界などの条件を満たす場合のみcombatを生成する。
                if let Some(combat) = action.generate_combats(attack_unit, defence_unit, visibility)
                {
                    generated_combats.push(combat);
                }
            }
        }

        for combat in generated_combats {
            step.push_combat(combat);
        }

        Ok(())
    }

    /// actionの行動力を更新する
    ///
    /// # 引数
    /// - `step`: 更新対象アクションを持つStep。
    /// - `units`: 行動力が保持されているユニット一覧配列
    pub fn update_action_points(&self, step: &mut Step, units: &Vec<Unit>) {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「1. アクションとユニットの整合性チェック」

        // action -> unit の対応を検証し、不一致時はドメインエラーを返す。
        for action in step.actions_mut() {
            // 目的: 各アクションが存在するユニットを参照しているかを検証する。
            if let Some(unit) = units.iter().find(|u| u.unit_id() == action.unit_id()) {
                // actionの行動力を更新
                action.set_current_action_points(unit.current_action_points().clone());
            }
        }
    }

    /// ステップ内でガードしたかをリセットする
    ///
    ///  # Arguments
    /// - `units`: ガード状態をリセットするユニットのリスト
    fn reset_guard_status(&self, units: &mut Vec<Unit>) {
        for unit in units.iter_mut() {
            unit.set_is_main_trigger_guarded(false);
            unit.set_is_sub_trigger_guarded(false);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::StepExecutionService;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::action::action::Action;
    use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
        ActionType, ActionTypeValue,
    };
    use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::triggergame_simulator::models::game::{
        game_id::game_id::GameId, visibility::Visibility,
    };
    use crate::domain::triggergame_simulator::models::step::step::Step;
    use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
    use crate::domain::unit_management::models::unit::{
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_type_id::unit_type_id::UnitTypeId, Unit,
    };
    use std::collections::{HashMap, VecDeque};
    use uuid::Uuid;

    fn create_unit_with_ap(action_points: i32) -> Unit {
        Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            GameId::new("550e8400-e29b-41d4-a716-446655440300".to_string()),
            PlayerId::new("550e8400-e29b-41d4-a716-446655440301".to_string()),
            Position::new(1, 1),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("KOGETSU".to_string()),
                TriggerId::new("ASTEROID".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            100,
            100,
            8,
            action_points,
        )
    }

    fn create_step_for(unit: &Unit) -> Step {
        let action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            unit.unit_id().clone(),
            unit.unit_type_id().clone(),
            unit.position().clone(),
            TriggerId::new("ASTEROID".to_string()),
            TriggerId::new("BAGWORM".to_string()),
            TriggerAzimuth::new(45),
            TriggerAzimuth::new(270),
            unit.current_action_points().clone(),
        );

        Step::create(
            StepId::new(Uuid::new_v4().to_string()),
            vec![action],
            Vec::new(),
        )
    }

    #[test]
    fn test_apply_action_movements_updates_trigger_at_ap_boundary() {
        // 仕様: APがちょうど1ならトリガー更新は許可される。
        let unit = create_unit_with_ap(1);
        let mut step = create_step_for(&unit);
        let mut units = vec![unit.clone()];
        let mut visibility = Visibility::create();
        let mut pending_actions_by_unit = HashMap::from([(
            unit.unit_id().clone(),
            VecDeque::from([step.actions()[0].clone()]),
        )]);

        StepExecutionService::new()
            .apply_action_movements(
                &mut step,
                &mut units,
                &mut pending_actions_by_unit,
                &mut visibility,
            )
            .unwrap();

        assert_eq!(
            units[0].using_main_trigger_id(),
            &TriggerId::new("ASTEROID".to_string())
        );
        assert_eq!(
            units[0].using_sub_trigger_id(),
            &TriggerId::new("BAGWORM".to_string())
        );
    }
}
