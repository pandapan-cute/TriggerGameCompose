use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::combat::Combat;
use crate::domain::unit_management::models::unit;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;
use crate::domain::unit_management::models::unit::{
    position::position::Position, trigger_id::trigger_id::TriggerId, Unit,
};
use crate::domain::unit_management::models::unit_type::unit_type_spec::UnitTypeSpec;

use super::action_id::action_id::ActionId;
use super::action_type::action_type::{ActionType, ActionTypeValue};
use super::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Action集約
/// ユニットの1つの行動を表すエンティティ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    action_id: ActionId,
    action_type: ActionType,
    unit_id: UnitId,
    unit_type_id: UnitTypeId,
    position: Position,
    using_main_trigger_id: TriggerId,
    using_sub_trigger_id: TriggerId,
    main_trigger_azimuth: TriggerAzimuth,
    sub_trigger_azimuth: TriggerAzimuth,
}

impl Action {
    // privateなコンストラクタ
    pub fn new(
        action_id: ActionId,
        action_type: ActionType,
        unit_id: UnitId,
        unit_type_id: UnitTypeId,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        main_trigger_azimuth: TriggerAzimuth,
        sub_trigger_azimuth: TriggerAzimuth,
    ) -> Self {
        Self {
            action_id,
            action_type,
            unit_id,
            unit_type_id,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            main_trigger_azimuth,
            sub_trigger_azimuth,
        }
    }

    /// 新規ステップの生成
    pub fn create(
        action_type: ActionType,
        unit_id: UnitId,
        unit_type_id: UnitTypeId,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        main_trigger_azimuth: TriggerAzimuth,
        sub_trigger_azimuth: TriggerAzimuth,
    ) -> Self {
        let action_id = ActionId::new(Uuid::new_v4().to_string());
        Self::new(
            action_id,
            action_type,
            unit_id,
            unit_type_id,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            main_trigger_azimuth,
            sub_trigger_azimuth,
        )
    }

    /// ステップの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        action_id: ActionId,
        action_type: ActionType,
        unit_id: UnitId,
        unit_type_id: UnitTypeId,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        main_trigger_azimuth: TriggerAzimuth,
        sub_trigger_azimuth: TriggerAzimuth,
    ) -> Self {
        Self::new(
            action_id,
            action_type,
            unit_id,
            unit_type_id,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            main_trigger_azimuth,
            sub_trigger_azimuth,
        )
    }

    /// ユニット情報をもとに発生したcombatを返す
    /// ただし、combatが発生しなかった場合はNoneを返す
    /// action_player_id: actionを実行したプレイヤーID(攻撃側)
    /// unit: 防御側ユニット情報
    pub fn generate_combats(&self, defence_unit: &mut Unit) -> Option<Combat> {
        // ユニットのステータス取得
        let unit_status = UnitTypeSpec::get_spec(&self.unit_type_id.value()).unwrap();
        // アクションタイプに応じてcombatを生成
        if self.is_attack() {
            // action主を攻撃者、引数の防御側ユニットを防御者とするcombatを生成
            let combat = Combat::create(
                self.unit_id.clone(),
                self.position.clone(),
                self.using_main_trigger_id.clone(),
                self.using_sub_trigger_id.clone(),
                self.main_trigger_azimuth.clone(),
                self.sub_trigger_azimuth.clone(),
                unit_status.base_attack(),
                defence_unit.unit_id().clone(),
                defence_unit.position().clone(),
                defence_unit.using_main_trigger_id().clone(),
                defence_unit.using_sub_trigger_id().clone(),
                defence_unit.main_trigger_hp().value(),
                defence_unit.sub_trigger_hp().value(),
                defence_unit.main_trigger_azimuth().clone(),
                defence_unit.sub_trigger_azimuth().clone(),
                unit_status.base_defense(),
                unit_status.base_avoid(),
            );

            if combat.is_some() {
                // combatでis_defeatedがtrueのときはunitも更新する
                let combat_unwrapped = combat.as_ref().unwrap();
                if combat_unwrapped.is_defeated() {
                    defence_unit.bailout();
                }
            }
            combat
        } else {
            // 攻撃アクションでない場合、Noneを返す
            None
        }
    }

    /// 攻撃を行うアクションかどうか
    fn is_attack(&self) -> bool {
        // 仮の実装、まだ特殊なアクションはないからね
        // 移動・待機は自動攻撃できるイメージ
        true
    }

    // ゲッター
    pub fn action_id(&self) -> &ActionId {
        &self.action_id
    }

    pub fn action_type(&self) -> &ActionType {
        &self.action_type
    }

    pub fn unit_id(&self) -> &UnitId {
        &self.unit_id
    }

    pub fn unit_type_id(&self) -> &UnitTypeId {
        &self.unit_type_id
    }

    pub fn position(&self) -> &Position {
        &self.position
    }

    pub fn using_main_trigger_id(&self) -> &TriggerId {
        &self.using_main_trigger_id
    }
    pub fn using_sub_trigger_id(&self) -> &TriggerId {
        &self.using_sub_trigger_id
    }

    pub fn main_trigger_azimuth(&self) -> &TriggerAzimuth {
        &self.main_trigger_azimuth
    }
    pub fn sub_trigger_azimuth(&self) -> &TriggerAzimuth {
        &self.sub_trigger_azimuth
    }
}

impl PartialEq for Action {
    fn eq(&self, other: &Self) -> bool {
        self.action_id == other.action_id
    }
}

impl Eq for Action {}
