use serde::{Deserialize, Serialize};

use crate::domain::unit_management::models::unit::{
    position::position::Position, trigger_id::trigger_id::TriggerId, Unit,
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
    pub fn to_enemy_unit_data(unit: &Unit) -> Option<Self> {
        if unit.using_main_trigger_id().is_bagworm()
            || unit.using_sub_trigger_id().is_bagworm()
            || unit.is_bailout_value().value()
        {
            // バグワーム装備中か脱出済みの場合、敵から不可視にするためNoneを返す
            return None;
        }
        Some(EnemyUnitDto {
            unit_id: unit.unit_id().value().to_string(),
            unit_type_id: unit.unit_type_id().value().to_string(),
            position: unit.position().clone(),
            using_main_trigger_id: unit.using_main_trigger_id().value().to_string(),
            using_sub_trigger_id: unit.using_sub_trigger_id().value().to_string(),
            is_bailout: unit.is_bailout_value().value(),
        })
    }

    /// 複数ユニットを DTO 配列に変換
    pub fn from_units(units: &[Unit]) -> Vec<EnemyUnitDto> {
        units
            .iter()
            // filter_map で None を除外
            .filter_map(EnemyUnitDto::to_enemy_unit_data)
            .collect()
    }
}
