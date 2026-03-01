use serde::{Deserialize, Serialize};

use crate::domain::{
    triggergame_simulator::models::{
        action::trigger_azimuth::trigger_azimuth::TriggerAzimuth,
        game::visibility::{self, Visibility},
    },
    unit_management::models::unit::{
        position::position::Position, trigger_id::trigger_id::TriggerId, Unit,
    },
};

/// マッチメイキングリクエストで受け取るユニット情報
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase", // unitTypeId -> unit_type_id
)]
pub struct EnemyUnitDto {
    pub unit_id: String,
    pub unit_type_id: String,
    pub position: Position,
    pub using_main_trigger_id: String,
    pub using_sub_trigger_id: String,
    pub is_bailout: bool,
}

impl EnemyUnitDto {
    /// DTOをドメインエンティティに変換（ファクトリーメソッド）
    pub fn to_enemy_unit_data(
        enemy_unit: &Unit,
        friend_units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Self {
        let visibility_data = visibility.calculate_visibility(friend_units);
        let action_visible = visibility_data[enemy_unit.position().row() as usize]
            [enemy_unit.position().col() as usize];
        if action_visible {}
        if action_visible == false
            && (enemy_unit.using_main_trigger_id().is_bagworm()
                || enemy_unit.using_sub_trigger_id().is_bagworm())
        {
            // 見えない場合 かつ バグワーム装備中の場合は、位置とトリガーの向きも見えないようにする
            return Self {
                unit_id: enemy_unit.unit_id().value().to_string(),
                unit_type_id: "UNKNOWN".to_string(), // ユニットタイプも不明にする
                position: Position::new(-1, -1),     // 見えない位置を(-1, -1)で表す
                using_main_trigger_id: TriggerId::new("UNKNOWN".to_string()).value().to_string(), // トリガーIDも不明にする
                using_sub_trigger_id: TriggerId::new("UNKNOWN".to_string()).value().to_string(), // トリガーのIDも不明にする
                is_bailout: enemy_unit.is_bailout_value().value(),
            };
        }
        if action_visible == false {
            // 見えない場合は、ユニットタイプを不明にする
            return Self {
                unit_id: enemy_unit.unit_id().value().to_string(),
                unit_type_id: "UNKNOWN".to_string(), // ユニットタイプも不明にする
                position: enemy_unit.position().clone(),
                using_main_trigger_id: TriggerId::new("UNKNOWN".to_string()).value().to_string(), // トリガーIDも不明にする
                using_sub_trigger_id: TriggerId::new("UNKNOWN".to_string()).value().to_string(), // トリガーのIDも不明にする
                is_bailout: enemy_unit.is_bailout_value().value(),
            };
        }

        // 見える場合は位置とトリガーの向きは見えるようにする
        return Self {
            unit_id: enemy_unit.unit_id().value().to_string(),
            unit_type_id: enemy_unit.unit_type_id().value().to_string(),
            position: enemy_unit.position().clone(),
            using_main_trigger_id: enemy_unit.using_main_trigger_id().value().to_string(),
            using_sub_trigger_id: enemy_unit.using_sub_trigger_id().value().to_string(),
            is_bailout: enemy_unit.is_bailout_value().value(),
        };
    }

    /// 複数ユニットを DTO 配列に変換
    pub fn from_units(
        enemy_units: &[Unit],
        friend_units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Vec<EnemyUnitDto> {
        enemy_units
            .iter()
            .map(|enemy_unit| {
                EnemyUnitDto::to_enemy_unit_data(enemy_unit, friend_units, visibility)
            })
            .collect()
    }
}
