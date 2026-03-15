use crate::domain::triggergame_simulator::models::{
    game::visibility::Visibility, step::step::Step,
};
use crate::domain::unit_management::models::unit::Unit;

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
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の全体オーケストレーション

        // 1) アクションと対象ユニットの整合性を検証する。
        self.validate_action_targets(step, units)?;

        // 2) 移動とトリガー状態更新を適用する。
        self.apply_action_movements(step, units, visibility)?;

        // 3) 有効射程に基づいてcombatを生成する。
        self.generate_combats(step, units, visibility)?;

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
    pub fn validate_action_targets(&self, step: &Step, units: &Vec<Unit>) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「1. アクションとユニットの整合性チェック」

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
        step: &Step,
        units: &mut Vec<Unit>,
        visibility: &mut Visibility,
    ) -> Result<(), String> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::step_start の「2. アクションに従ってユニットの移動と使用トリガーの設定」

        const ACTION_POINT_CAN_UPDATE_TRIGGER: i32 = 1;

        // 各アクションごとに:
        // - 離脱済みユニットはスキップ
        // - ユニットを移動
        // - 行動ポイント条件を満たす場合にトリガーID/方位角を更新
        for action in step.actions() {
            let Some(unit) = units.iter_mut().find(|u| u.unit_id() == action.unit_id()) else {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            };

            // 目的: 離脱済みユニットには移動・トリガー更新を適用しない。
            if unit.is_bailed_out() {
                // この分岐に入る条件: 対象ユニットが離脱済みの場合。
                println!("ユニットID {:?} の移動をスキップ", unit.unit_id());
                continue;
            }

            unit.move_to(action.position().clone(), visibility);

            // 目的: トリガー更新に必要な行動ポイントを満たしているか判定する。
            if unit.current_action_points().value() >= ACTION_POINT_CAN_UPDATE_TRIGGER {
                // この分岐に入る条件: 行動ポイントが必要値以上でトリガー更新可能な場合。
                let _ = unit.set_using_triggers(
                    &action.using_main_trigger_id(),
                    &action.using_sub_trigger_id(),
                );
                unit.set_main_trigger_azimuth(action.main_trigger_azimuth().clone());
                unit.set_sub_trigger_azimuth(action.sub_trigger_azimuth().clone());
            } else {
                // この分岐に入る条件: 行動ポイント不足でトリガー更新不可な場合。
                print!(
                    "トリガーの更新に必要な行動ポイントが不足しています。unit_id={:?}, current_action_points={}, required_action_points={}",
                    unit.unit_id(),
                    unit.current_action_points().value(),
                    ACTION_POINT_CAN_UPDATE_TRIGGER
                );
            }
        }

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

        // 攻撃側の検索を安定させるため、探索用にユニットをクローンする。
        let attack_units = units.clone();
        let mut generated_combats = Vec::new();

        // 各攻撃側アクションごとに:
        // - 行動ポイントと離脱状態を判定
        // - 敵ユニットを走査
        // - combatを生成してpush
        for action in step.actions() {
            let Some(attack_unit) = attack_units
                .iter()
                .find(|u| u.unit_id() == action.unit_id())
            else {
                return Err(format!(
                    "ユニットID {:?} がアクション {:?} に見つかりません",
                    action.unit_id(),
                    action.action_id()
                ));
            };

            // 目的: 攻撃可能条件(行動ポイント)を満たすか判定する。
            if attack_unit.current_action_points().value() < ACTION_POINT_CAN_ATTACK {
                // この分岐に入る条件: 行動ポイント不足で攻撃不可な場合。
                continue;
            }
            // 目的: 離脱済みユニットの攻撃処理を除外する。
            if attack_unit.is_bailed_out() {
                // この分岐に入る条件: 攻撃側ユニットが離脱済みの場合。
                println!("ユニットID {:?} の攻撃をスキップ", attack_unit.unit_id());
                continue;
            }

            for defence_unit in units.iter_mut() {
                // 目的: 同一プレイヤー間の戦闘判定を除外する。
                if attack_unit.owner_player_id() == defence_unit.owner_player_id() {
                    // この分岐に入る条件: 攻撃側と防御側が同一プレイヤー所属の場合。
                    continue;
                }
                // 目的: 離脱済みの防御側ユニットは戦闘対象外にする。
                if defence_unit.is_bailed_out() {
                    // この分岐に入る条件: 防御側ユニットが離脱済みの場合。
                    println!("ユニットID {:?} の戦闘をスキップ", defence_unit.unit_id());
                    continue;
                }

                // 目的: 射程・視界などの条件を満たす場合のみcombatを生成する。
                if let Some(combat) = action.generate_combats(defence_unit, visibility) {
                    // この分岐に入る条件: combat生成条件を満たし、Some(combat)が返る場合。
                    generated_combats.push(combat);
                }
            }
        }

        for combat in generated_combats {
            step.push_combat(combat);
        }

        Ok(())
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
        having_trigger_ids::having_trigger_ids::HavingTriggerIds,
        position::position::Position,
        trigger_id::trigger_id::TriggerId,
        unit_type_id::unit_type_id::UnitTypeId,
        Unit,
    };
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
        );

        Step::create(
            StepId::new(Uuid::new_v4().to_string()),
            vec![action],
            Vec::new(),
            Vec::new(),
        )
    }

    #[test]
    fn test_apply_action_movements_updates_trigger_at_ap_boundary() {
        // 仕様: APがちょうど1ならトリガー更新は許可される。
        let unit = create_unit_with_ap(1);
        let step = create_step_for(&unit);
        let mut units = vec![unit.clone()];
        let mut visibility = Visibility::create();

        StepExecutionService::new()
            .apply_action_movements(&step, &mut units, &mut visibility)
            .unwrap();

        assert_eq!(units[0].using_main_trigger_id(), &TriggerId::new("ASTEROID".to_string()));
        assert_eq!(units[0].using_sub_trigger_id(), &TriggerId::new("BAGWORM".to_string()));
    }

    #[test]
    fn test_apply_action_movements_does_not_update_trigger_when_ap_is_less_than_boundary() {
        // 仕様: APが1未満ならトリガー更新は拒否される。
        let mut units = vec![create_unit_with_ap(0)];
        let step = create_step_for(&units[0]);
        let mut visibility = Visibility::create();

        StepExecutionService::new()
            .apply_action_movements(&step, &mut units, &mut visibility)
            .unwrap();

        assert_eq!(units[0].using_main_trigger_id(), &TriggerId::new("KOGETSU".to_string()));
        assert_eq!(units[0].using_sub_trigger_id(), &TriggerId::new("SHIELD".to_string()));
    }
}
