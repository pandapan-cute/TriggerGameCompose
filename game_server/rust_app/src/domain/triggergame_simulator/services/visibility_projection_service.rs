use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::{
    game::visibility::Visibility, step::step::Step,
};
use crate::domain::unit_management::models::unit::Unit;

/// 可視情報投影のドメインサービス。
///
/// `src/domain/triggergame_simulator/models/step/step.rs` の
/// `Step::to_player_step` にあるプレイヤー別投影処理を抽出する移管先。
pub struct VisibilityProjectionService;

impl VisibilityProjectionService {
    /// `VisibilityProjectionService` を生成する。
    pub fn new() -> Self {
        Self
    }

    /// マージ済みStepを特定プレイヤー向けに投影する。
    ///
    /// # 引数
    /// - `step`: 投影元のマージ済みStep。
    /// - `player_id`: 投影結果を受け取るプレイヤーID。
    /// - `units`: フィルタリングと可視セル計算に使うゲーム内ユニット一覧。
    /// - `visibility`: 可視セル計算に使う視界モデル。
    ///
    /// # 戻り値
    /// - 指定プレイヤー向けに投影済みの `Step`。
    pub fn project_step_for_player(
        &self,
        step: &mut Step,
        player_id: &PlayerId,
        units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Step {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::to_player_step の全体処理

        // 1) アクションをプレイヤー視点でフィルタリングする。
        self.project_actions_for_player(step, player_id, units, visibility);

        // 2) プレイヤー向け可視セルを再計算する。
        let visibility_cells = self.calculate_player_visibility_cells(player_id, units, visibility);
        step.set_visibility_cells(visibility_cells);

        // 3) 投影済みStepクローンを返す。
        step.clone()
    }

    /// プレイヤー別のアクションフィルタリング/マスキングを適用する。
    ///
    /// # 引数
    /// - `step`: プレイヤー向けに投影するアクションを保持したStep（可変）。
    /// - `player_id`: 閲覧プレイヤーID。
    /// - `units`: `to_player_action` 判定に使用するユニット一覧。
    /// - `visibility`: アクション投影に使用する視界モデル。
    pub fn project_actions_for_player(
        &self,
        step: &mut Step,
        player_id: &PlayerId,
        units: &Vec<Unit>,
        visibility: &Visibility,
    ) {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::to_player_step の `self.actions.iter_mut().for_each(...)` 周辺

        // アクションを走査し、プレイヤー視点のフィルタリングを適用する。
        step.actions_mut().iter_mut().for_each(|action| {
            action.to_player_action(player_id, units, visibility);
        });
    }

    /// 所有ユニットからプレイヤー向け可視セルを計算する。
    ///
    /// # 引数
    /// - `player_id`: 閲覧プレイヤーID。
    /// - `units`: ゲーム内の全ユニット一覧。
    /// - `visibility`: 投影計算に使用する視界モデル。
    ///
    /// # 戻り値
    /// - 指定プレイヤー向けの2次元可視セルマップ。
    pub fn calculate_player_visibility_cells(
        &self,
        player_id: &PlayerId,
        units: &Vec<Unit>,
        visibility: &Visibility,
    ) -> Vec<Vec<bool>> {
        // 移動元:
        // - src/domain/triggergame_simulator/models/step/step.rs
        // - Step::to_player_step の
        //   `let player_units ... visibility.calculate_visibility(&player_units)` 周辺

        // 所有ユニットを抽出し、プレイヤー向け可視セルを計算する。
        let player_units: Vec<Unit> = units
            .iter()
            .filter(|u| u.owner_player_id() == player_id)
            .cloned()
            .collect();
        visibility.calculate_visibility(&player_units)
    }
}

#[cfg(test)]
mod tests {
    use super::VisibilityProjectionService;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::{
        game_id::game_id::GameId, visibility::Visibility,
    };
    use crate::domain::unit_management::models::unit::{
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_type_id::unit_type_id::UnitTypeId, Unit,
    };

    fn create_unit(owner: &PlayerId, position: Position) -> Unit {
        Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            GameId::new("550e8400-e29b-41d4-a716-446655440400".to_string()),
            owner.clone(),
            position,
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![TriggerId::new("KOGETSU".to_string())]),
            HavingTriggerIds::new(vec![TriggerId::new("SHIELD".to_string())]),
            100,
            100,
            8,
            10,
        )
    }

    #[test]
    fn test_visibility_boundary_initial_placement() {
        // 仕様: 初期配置時は、少なくとも自ユニット座標は可視である。
        let player_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440401".to_string());
        let units = vec![create_unit(&player_id, Position::new(5, 5))];
        let visibility = Visibility::create();

        let map = VisibilityProjectionService::new().calculate_player_visibility_cells(
            &player_id,
            &units,
            &visibility,
        );

        assert!(map[5][5]);
    }

    #[test]
    fn test_visibility_boundary_immediately_after_move() {
        // 仕様: 移動直後の座標を起点に可視セルが再計算される。
        let player_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440402".to_string());
        let mut moved_unit = create_unit(&player_id, Position::new(5, 5));
        moved_unit.set_position(Position::new(8, 5));
        let units = vec![moved_unit];
        let visibility = Visibility::create();

        let map = VisibilityProjectionService::new().calculate_player_visibility_cells(
            &player_id,
            &units,
            &visibility,
        );

        assert!(map[5][8]);
    }

    #[test]
    fn test_visibility_boundary_across_turns_changes_with_position() {
        // 仕様: ターンを跨いで位置が変われば、可視マップも変化する。
        let player_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440403".to_string());
        let visibility = Visibility::create();
        let service = VisibilityProjectionService::new();

        let turn1_units = vec![create_unit(&player_id, Position::new(2, 2))];
        let turn1_map =
            service.calculate_player_visibility_cells(&player_id, &turn1_units, &visibility);

        let turn2_units = vec![create_unit(&player_id, Position::new(12, 12))];
        let turn2_map =
            service.calculate_player_visibility_cells(&player_id, &turn2_units, &visibility);

        assert_ne!(turn1_map, turn2_map);
    }
}
