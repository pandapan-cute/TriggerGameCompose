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
pub struct FriendUnitDto {
    pub unit_id: String,
    pub unit_type_id: String,
    pub position: Position,
    pub using_main_trigger_id: String,
    pub using_sub_trigger_id: String,
    pub main_trigger_hp: i32,
    pub sub_trigger_hp: i32,
    pub sight_range: i32,
    pub is_bailout: bool,
}

impl FriendUnitDto {
    /// DTOをドメインエンティティに変換（ファクトリーメソッド）
    fn to_friend_unit_data(unit: &Unit) -> Self {
        FriendUnitDto {
            unit_id: unit.unit_id().value().to_string(),
            unit_type_id: unit.unit_type_id().value().to_string(),
            position: unit.position().clone(),
            using_main_trigger_id: unit.using_main_trigger_id().value().to_string(),
            using_sub_trigger_id: unit.using_sub_trigger_id().value().to_string(),
            main_trigger_hp: unit.main_trigger_hp().value(),
            sub_trigger_hp: unit.sub_trigger_hp().value(),
            sight_range: unit.sight_range().value(),
            is_bailout: unit.is_bailout_value().value(),
        }
    }

    /// 複数ユニットを DTO 配列に変換
    pub fn from_units(units: &[Unit]) -> Vec<FriendUnitDto> {
        units
            .iter()
            .map(FriendUnitDto::to_friend_unit_data)
            .collect()
    }
}
