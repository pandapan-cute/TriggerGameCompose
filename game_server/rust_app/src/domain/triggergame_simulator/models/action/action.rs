use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action;
use crate::domain::triggergame_simulator::models::combat::Combat;
use crate::domain::triggergame_simulator::models::game::visibility::{self, Visibility};
use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::unit_type_id::unit_type_id::UnitTypeId;
use crate::domain::unit_management::models::unit::{self, current_action_points};
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
    #[serde(default)]
    current_action_points: CurrentActionPoints, // リクエストはない。デフォルト値0が入る
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
        current_action_points: CurrentActionPoints,
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
            current_action_points,
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
        current_action_points: CurrentActionPoints,
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
            current_action_points,
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
        current_action_points: CurrentActionPoints,
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
            current_action_points,
        )
    }

    /// ユニット情報をもとに発生したcombatを返す
    /// ただし、combatが発生しなかった場合はNoneを返す
    /// action_player_id: actionを実行したプレイヤーID(攻撃側)
    /// unit: 防御側ユニット情報
    pub fn generate_combats(
        &self,
        attacker_unit: &mut Unit,
        defence_unit: &mut Unit,
        visibility: &mut Visibility,
    ) -> Option<Combat> {
        // ユニットのステータス取得
        let attacker_unit_status =
            UnitTypeSpec::get_spec(&attacker_unit.unit_type_id().value()).unwrap();
        let defence_unit_status =
            UnitTypeSpec::get_spec(&defence_unit.unit_type_id().value()).unwrap();
        // アクションタイプに応じてcombatを生成
        if self.is_attack() {
            // action主を攻撃者、引数の防御側ユニットを防御者とするcombatを生成
            let combat = Combat::create(
                attacker_unit,
                attacker_unit_status.base_attack(),
                defence_unit,
                defence_unit_status.base_defense(),
                defence_unit_status.base_avoid(),
                visibility,
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

    /// プレイヤーごとに見せるべき情報をフィルタリングする処理
    /// ただし、combatが発生しなかった場合はNoneを返す
    ///
    /// * player_id: 閲覧プレイヤーID
    /// * all_units: 行動者特定に使う全ユニット情報
    /// * viewer_units: 可視性計算に使う、閲覧プレイヤーのアクティブなユニット情報
    /// * visibility: 視界情報
    ///
    /// ユニット表示パターン
    /// 1. 視界内に入っている
    ///     -> 位置とトリガーの向きは見えるようにする
    /// 2. 視界外にいる かつ バグワーム装備中
    ///     -> 位置とトリガーの向きも見えないようにする
    ///        ユニットのタイプを不明にする
    /// 3. 視界外にいる
    ///     -> ユニットタイプも不明にする
    pub fn to_player_action(
        &mut self,
        player_id: &PlayerId,
        all_units: &Vec<Unit>,
        viewer_units: &Vec<Unit>,
        visibility: &Visibility,
    ) {
        // プレイヤーから見て敵のユニットの行動は、位置とトリガーの向き以外は見えないようにする
        let attack_unit = all_units
            .iter()
            .find(|u| u.unit_id() == &self.unit_id)
            .unwrap();
        if attack_unit.owner_player_id() == player_id {
            // 自分のユニットの行動はそのまま返す
            return;
        }

        let visibility_data = visibility.calculate_visibility(viewer_units);
        let action_visible = visibility_data[self.position.get_enemy_position().row() as usize]
            [self.position.get_enemy_position().col() as usize];
        if action_visible {
            // 見える場合は位置とトリガーの向きは見えるようにする
            return;
        }
        if action_visible == false
            && (self.using_main_trigger_id.is_bagworm() || self.using_sub_trigger_id.is_bagworm())
        {
            // 見えない場合 かつ バグワーム装備中の場合は、位置とトリガーの向きも見えないようにする
            self.position = Position::new(-1, -1); // 見えない位置を(-1, -1)で表す
            self.main_trigger_azimuth = TriggerAzimuth::new(-1);
            self.sub_trigger_azimuth = TriggerAzimuth::new(-1);
        }
        if action_visible == false {
            // 見えない場合は、ユニットタイプを不明にする
            self.unit_type_id = UnitTypeId::new("UNKNOWN".to_string());
        }
    }

    /// 攻撃を行うアクションかどうか
    fn is_attack(&self) -> bool {
        // 仮の実装、まだ特殊なアクションはないからね
        // 移動・待機は自動攻撃できるイメージ
        true
    }

    /// セッター
    pub fn set_current_action_points(&mut self, current_action_points: CurrentActionPoints) {
        self.current_action_points = current_action_points;
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
    pub fn current_action_points(&self) -> &CurrentActionPoints {
        &self.current_action_points
    }
}

impl PartialEq for Action {
    fn eq(&self, other: &Self) -> bool {
        self.action_id == other.action_id
    }
}

impl Eq for Action {}
