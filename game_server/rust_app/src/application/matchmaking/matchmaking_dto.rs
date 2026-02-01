use serde::{Deserialize, Serialize};

use crate::domain::unit_management::models::unit::{
    using_main_trigger_id::using_main_trigger_id::UsingMainTriggerId,
    using_sub_trigger_id::using_sub_trigger_id::UsingSubTriggerId,
};

/// マッチメイキングリクエストで受け取るユニット情報
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase", // unitTypeId -> unit_type_id
)]
pub struct CreateUnitDto {
    pub unit_type_id: String,
    pub initial_x: i32,
    pub initial_y: i32,
    pub using_main_trigger_id: String,
    pub using_sub_trigger_id: String,
    pub main_trigger_ids: Vec<String>,
    pub sub_trigger_ids: Vec<String>,
}

impl CreateUnitDto {
    /// DTOをドメインエンティティに変換（ファクトリーメソッド）
    pub fn to_unit(
        &self,
        game_id: crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId,
        owner_player_id: crate::domain::player_management::models::player::player_id::player_id::PlayerId,
    ) -> crate::domain::unit_management::models::unit::Unit {
        use crate::domain::unit_management::models::unit::{
            having_main_trigger_ids::having_main_trigger_ids::HavingMainTriggerIds,
            having_sub_trigger_ids::having_sub_trigger_ids::HavingSubTriggerIds,
            position::position::Position, unit_type_id::unit_type_id::UnitTypeId, Unit,
        };

        Unit::create(
            UnitTypeId::new(self.unit_type_id.clone()),
            game_id,
            owner_player_id,
            Position::new(self.initial_x, self.initial_y),
            UsingMainTriggerId::new(self.using_main_trigger_id.clone()),
            UsingSubTriggerId::new(self.using_sub_trigger_id.clone()),
            HavingMainTriggerIds::new(self.main_trigger_ids.clone()),
            HavingSubTriggerIds::new(self.sub_trigger_ids.clone()),
            100, // TODO: マスターデータから取得予定
            100, // TODO: マスターデータから取得予定
            8,   // TODO: 開始地点の高さから取得予定
            13,  // TODO: マスターデータから取得予定
        )
    }
}
