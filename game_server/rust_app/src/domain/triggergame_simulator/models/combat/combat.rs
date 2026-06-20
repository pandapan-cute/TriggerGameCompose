use crate::domain::triggergame_simulator::configs::trigger_status::TriggerStatus;
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use crate::domain::triggergame_simulator::models::combat::is_avoided;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
use crate::domain::triggergame_simulator::{
    configs::game_config::GameConfig, models::game::visibility,
};
use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::unit_management::models::unit::trigger_hp::TriggerHP;
use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::{current_action_points, Unit};

use super::combat_id::combat_id::CombatId;
use super::is_avoided::is_avoided::IsAvoided;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Combat集約
/// 戦闘を表すエンティティ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Combat {
    combat_id: CombatId,
    attacking_unit_id: UnitId,
    attacker_position: Position,
    attacker_main_trigger_id: TriggerId,
    attacker_sub_trigger_id: TriggerId,
    attacker_main_trigger_azimuth: TriggerAzimuth,
    attacker_sub_trigger_azimuth: TriggerAzimuth,
    attacker_base_attack: i32,
    defending_unit_id: UnitId,
    defender_position: Position,
    defender_main_trigger_id: TriggerId,
    defender_sub_trigger_id: TriggerId,
    defender_main_trigger_azimuth: TriggerAzimuth,
    defender_sub_trigger_azimuth: TriggerAzimuth,
    main_trigger_hp: TriggerHP,
    sub_trigger_hp: TriggerHP,
    defender_base_defense: i32,
    defender_base_avoid: i32,
    is_avoided: IsAvoided,
    is_defeated: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum AttackPattern {
    /// 両攻撃
    Full,
    /// メイントリガー攻撃
    MainOnly,
    /// サブトリガー攻撃
    SubOnly,
    /// 攻撃なし
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum GuardPattern {
    /// 両防御
    Full,
    /// メイントリガー防御
    MainOnly,
    /// サブトリガー防御
    SubOnly,
    /// 防御なし
    None,
}

impl Combat {
    // privateなコンストラクタ
    fn new(
        combat_id: CombatId,
        attacking_unit_id: UnitId,
        attacker_position: Position,
        attacker_main_trigger_id: TriggerId,
        attacker_sub_trigger_id: TriggerId,
        attacker_main_trigger_azimuth: TriggerAzimuth,
        attacker_sub_trigger_azimuth: TriggerAzimuth,
        attacker_base_attack: i32,
        defending_unit_id: UnitId,
        defender_position: Position,
        defender_main_trigger_id: TriggerId,
        defender_sub_trigger_id: TriggerId,
        defender_main_trigger_azimuth: TriggerAzimuth,
        defender_sub_trigger_azimuth: TriggerAzimuth,
        defender_base_defense: i32,
        defender_base_avoid: i32,
        main_trigger_hp: TriggerHP,
        sub_trigger_hp: TriggerHP,
        is_avoided: IsAvoided,
        is_defeated: bool,
    ) -> Self {
        Self {
            combat_id,
            attacking_unit_id,
            attacker_position,
            attacker_main_trigger_id,
            attacker_sub_trigger_id,
            attacker_main_trigger_azimuth,
            attacker_sub_trigger_azimuth,
            attacker_base_attack,
            defending_unit_id,
            defender_position,
            defender_main_trigger_id,
            defender_sub_trigger_id,
            defender_main_trigger_azimuth,
            defender_sub_trigger_azimuth,
            main_trigger_hp,
            sub_trigger_hp,
            defender_base_defense,
            defender_base_avoid,
            is_avoided,
            is_defeated,
        }
    }

    /// 新規戦闘の生成
    pub fn create(
        attacker_unit: &mut Unit,
        attacker_base_attack: i32,
        defender_unit: &mut Unit,
        defender_base_defense: i32,
        defender_base_avoid: i32,
        visibility: &mut Visibility,
    ) -> Option<Self> {
        // 攻撃側のメイントリガーが防御側に当たる可能性があるか確認
        let in_main_trigger_area = Self::check_trigger_in_range_and_angle(
            &attacker_unit.position(),
            &attacker_unit.using_main_trigger_id(),
            &attacker_unit.main_trigger_azimuth(),
            &defender_unit.position(),
        );
        // 攻撃側のサブトリガーが防御側に当たる可能性があるか確認
        let in_sub_trigger_area = Self::check_trigger_in_range_and_angle(
            &attacker_unit.position(),
            &attacker_unit.using_sub_trigger_id(),
            &attacker_unit.sub_trigger_azimuth(),
            &defender_unit.position(),
        );

        // 攻撃者側のメイントリガーの必要行動力
        let attacker_main_trigger_action_point =
            TriggerStatus::get_trigger_status(attacker_unit.using_main_trigger_id().value())
                .action_points();
        // 攻撃者側のサブトリガーの必要行動力
        let attacker_sub_trigger_action_point =
            TriggerStatus::get_trigger_status(attacker_unit.using_sub_trigger_id().value())
                .action_points();

        // 攻撃パターンの判定
        let attack_pattern = Self::determine_attack_pattern(
            in_main_trigger_area,
            TriggerStatus::get_trigger_status(attacker_unit.using_main_trigger_id().value())
                .attack(),
            in_sub_trigger_area,
            TriggerStatus::get_trigger_status(attacker_unit.using_sub_trigger_id().value())
                .attack(),
            attacker_unit.current_action_points().value(),
            attacker_main_trigger_action_point,
            attacker_sub_trigger_action_point,
        );

        // 攻撃側側から見て防御側が見えているか確認
        let is_defender_visible = visibility
            .check_combat_visibility(&attacker_unit.position(), &defender_unit.position());
        if attack_pattern == AttackPattern::None || !is_defender_visible {
            // 攻撃できない　または 視界外の場合はNoneを返す
            return None;
        }

        match attack_pattern {
            AttackPattern::Full => {
                let _ = attacker_unit.consume_action_points(
                    attacker_main_trigger_action_point + attacker_sub_trigger_action_point,
                );
            }
            AttackPattern::MainOnly => {
                let _ = attacker_unit.consume_action_points(attacker_main_trigger_action_point);
            }
            AttackPattern::SubOnly => {
                let _ = attacker_unit.consume_action_points(attacker_sub_trigger_action_point);
            }
            AttackPattern::None => {}
        }

        let defender_main_trigger_status =
            TriggerStatus::get_trigger_status(defender_unit.using_main_trigger_id().value());
        let defender_sub_trigger_status =
            TriggerStatus::get_trigger_status(defender_unit.using_sub_trigger_id().value());

        // 防御側のメイントリガーが攻撃者に向いているか確認
        let is_defender_facing_attacker_main = Self::check_trigger_in_angle(
            &defender_unit.position(),
            &attacker_unit.position(),
            defender_unit.main_trigger_azimuth().value(),
            defender_main_trigger_status.angle(),
        );
        // 防御側のサブトリガーが攻撃者に向いているか確認
        let is_defender_facing_attacker_sub = Self::check_trigger_in_angle(
            &defender_unit.position(),
            &attacker_unit.position(),
            defender_unit.sub_trigger_azimuth().value(),
            defender_sub_trigger_status.angle(),
        );

        let mut is_defeated = false;
        if !is_defender_facing_attacker_main && !is_defender_facing_attacker_sub {
            // トリガーが向いていない場合は即撃墜
            is_defeated = true;
        }

        // 回避計算の実行
        let trigger_avoid = if is_defender_facing_attacker_main {
            defender_main_trigger_status.avoid()
        } else {
            0
        } + if is_defender_facing_attacker_sub {
            defender_sub_trigger_status.avoid()
        } else {
            0
        };
        let is_avoided = Self::calculate_avoidance(defender_base_avoid, trigger_avoid);

        if !is_avoided.value() {
            // まず攻撃パターンに基づき、実際に発動した攻撃の攻撃値をトリガー毎に計算する
            let attacker_main_attack = match attack_pattern {
                AttackPattern::Full | AttackPattern::MainOnly => {
                    TriggerStatus::get_trigger_status(attacker_unit.using_main_trigger_id().value())
                        .attack()
                }
                _ => 0,
            };
            let attacker_sub_attack = match attack_pattern {
                AttackPattern::Full | AttackPattern::SubOnly => {
                    TriggerStatus::get_trigger_status(attacker_unit.using_sub_trigger_id().value())
                        .attack()
                }
                _ => 0,
            };
            // 攻撃値の合計
            let total_trigger_attack = attacker_main_attack + attacker_sub_attack;

            // 防御側のトリガーの向きと防御力からガードパターンを判定する
            let guard_pattern = Self::determine_guard_pattern(
                is_defender_facing_attacker_main,
                defender_main_trigger_status.defense(),
                is_defender_facing_attacker_sub,
                defender_sub_trigger_status.defense(),
            );

            // ガードパターンに基づきダメージ計算を行い、防御側のHPを減少させる
            match guard_pattern {
                GuardPattern::Full => {
                    // 行動力があれば２つのシールドを貼り直し(トリガーHPを全回復)
                    if defender_unit.current_action_points().value()
                        >= defender_main_trigger_status.action_points()
                            + defender_sub_trigger_status.action_points()
                    {
                        defender_unit.restore_main_trigger_hp();
                        defender_unit.restore_sub_trigger_hp();
                        let _ = defender_unit.consume_action_points(
                            defender_main_trigger_status.action_points()
                                + defender_sub_trigger_status.action_points(),
                        );
                    }

                    // 両防御の場合
                    Self::calculate_full_guard_damage(
                        attacker_base_attack,
                        defender_base_defense,
                        total_trigger_attack,
                        defender_main_trigger_status.defense(),
                        defender_sub_trigger_status.defense(),
                        defender_unit,
                    );

                    if defender_unit.main_trigger_hp().is_depleted()
                        || defender_unit.sub_trigger_hp().is_depleted()
                    {
                        is_defeated = true;
                    }
                }
                GuardPattern::MainOnly => {
                    // 行動力があればメイントリガーのシールドを貼り直し(トリガーHPを全回復)
                    if defender_unit.current_action_points().value()
                        >= defender_main_trigger_status.action_points()
                    {
                        defender_unit.restore_main_trigger_hp();
                        let _ = defender_unit
                            .consume_action_points(defender_main_trigger_status.action_points());
                    }
                    // 片方防御の場合（メイントリガーのみ防御）
                    let damage = Self::calculate_partial_guard_damage(
                        attacker_base_attack,
                        defender_base_defense,
                        total_trigger_attack,
                        defender_main_trigger_status.defense(),
                    );
                    defender_unit.decrease_main_trigger_hp(damage);
                }
                GuardPattern::SubOnly => {
                    // 行動力があればサブトリガーのシールドを貼り直し(トリガーHPを全回復)
                    if defender_unit.current_action_points().value()
                        >= defender_sub_trigger_status.action_points()
                    {
                        defender_unit.restore_sub_trigger_hp();
                        let _ = defender_unit
                            .consume_action_points(defender_sub_trigger_status.action_points());
                    }
                    // 片方防御の場合（サブトリガーのみ防御）
                    let damage = Self::calculate_partial_guard_damage(
                        attacker_base_attack,
                        defender_base_defense,
                        total_trigger_attack,
                        defender_sub_trigger_status.defense(),
                    );
                    defender_unit.decrease_sub_trigger_hp(damage);
                }
                GuardPattern::None => {
                    // 両トリガーが防御トリガーでないときは即撃墜
                    is_defeated = true;
                }
            }
        }

        Some(Self::new(
            CombatId::new(Uuid::new_v4().to_string()),
            attacker_unit.unit_id().clone(),
            attacker_unit.position().clone(),
            attacker_unit.using_main_trigger_id().clone(),
            attacker_unit.using_sub_trigger_id().clone(),
            attacker_unit.main_trigger_azimuth().clone(),
            attacker_unit.sub_trigger_azimuth().clone(),
            attacker_base_attack,
            defender_unit.unit_id().clone(),
            defender_unit.position().clone(),
            defender_unit.using_main_trigger_id().clone(),
            defender_unit.using_sub_trigger_id().clone(),
            defender_unit.main_trigger_azimuth().clone(),
            defender_unit.sub_trigger_azimuth().clone(),
            defender_base_defense,
            defender_base_avoid,
            defender_unit.main_trigger_hp().clone(),
            defender_unit.sub_trigger_hp().clone(),
            is_avoided,
            is_defeated,
        ))
    }

    /// トリガーの射程と方向内に敵がいるか確認する
    fn check_trigger_in_range_and_angle(
        attacker_position: &Position,
        attacker_trigger_id: &TriggerId,
        attacker_trigger_azimuth: &TriggerAzimuth,
        defender_position: &Position,
    ) -> bool {
        // トリガーの射程内に敵がいるか確認
        let in_range =
            Self::check_trigger_in_range(attacker_position, attacker_trigger_id, defender_position);
        if !in_range {
            return false;
        }

        // トリガーの方向内に敵がいるか確認
        let in_angle = Self::check_trigger_in_angle(
            attacker_position,
            defender_position,
            attacker_trigger_azimuth.value(),
            TriggerStatus::get_trigger_status(attacker_trigger_id.value()).angle(),
        );
        if !in_angle {
            return false;
        }
        true
    }

    /// トリガーの射程内に敵がいるか確認する
    fn check_trigger_in_range(
        attacker_position: &Position,
        attacker_trigger_id: &TriggerId,
        defender_position: &Position,
    ) -> bool {
        // ピクセル長での距離を取得する
        let (attacker_x, attacker_y) = attacker_position.get_pixel_position();
        let (defender_x, defender_y) = defender_position.get_enemy_pixel_position();
        let pixel_length =
            (((attacker_x - defender_x).pow(2) + (attacker_y - defender_y).pow(2)) as f64).sqrt();

        // トリガーの射程をピクセル長に変換する
        let game_config = GameConfig::get_game_config();
        let hex_height = game_config.hex_height();
        let attacker_trigger_status =
            TriggerStatus::get_trigger_status(attacker_trigger_id.value());

        // 0.5は、ユニット中心からセルの端までの距離の補正
        if pixel_length > hex_height * (attacker_trigger_status.range() as f64 + 0.5) {
            // 射程内にいない場合はfalseを返す
            println!("射程外です, アタッカー座標({:?},{:?}), ディフェンダー座標({:?},{:?}), トリガーID={:?}, 射程={:?}", attacker_x, attacker_y, defender_x, defender_y, attacker_trigger_id.value(), TriggerStatus::get_trigger_status(attacker_trigger_id.value()).range());
            return false;
        } else {
            // 射程内にいる場合はtrueを返す
            return true;
        }
    }

    /// 方向チェックのヘルパー関数
    fn check_trigger_in_angle(
        attacker_position: &Position,
        defender_position: &Position,
        direction: i32,
        trigger_angle: i32,
    ) -> bool {
        // 攻撃者から防御者への角度を計算する
        let dx = (defender_position.get_enemy_pixel_position().0
            - attacker_position.get_pixel_position().0) as f64;
        let dy = (defender_position.get_enemy_pixel_position().1
            - attacker_position.get_pixel_position().1) as f64;
        let angle_to_target = dy.atan2(dx).to_degrees();

        let normalized_angle = ((angle_to_target % 360.0) + 360.0) % 360.0;
        // 表示と同じように-90度補正を適用
        let trigger_direction = (((direction - 90) % 360 + 360) % 360) as f64;

        let half_angle = (trigger_angle as f64) / 2.0; // 扇形の半分
        let start_angle = ((trigger_direction - half_angle) + 360.0) % 360.0;
        let end_angle = ((trigger_direction + half_angle) + 360.0) % 360.0;

        if start_angle <= end_angle {
            normalized_angle >= start_angle && normalized_angle <= end_angle
        } else {
            normalized_angle >= start_angle || normalized_angle <= end_angle
        }
    }

    /// 回避計算の実行
    fn calculate_avoidance(defender_base_avoid: i32, trigger_avoid: i32) -> IsAvoided {
        // 仮の実装、ランダムで回避成功・失敗を決定
        let random_value = rand::random::<f64>();
        let avoid_chance = (defender_base_avoid as f64) * (trigger_avoid as f64)
            / (GameConfig::get_game_config().avoid_weight() as f64);
        if random_value < avoid_chance {
            IsAvoided::new(true)
        } else {
            IsAvoided::new(false)
        }
    }

    /// 攻撃パターンの判定
    /// * 両攻撃：
    ///     * 攻撃者の両トリガーの範囲内に防御者がいる
    ///     * 両トリガーの攻撃力が0より大きい
    ///     * 両トリガーの必要行動力を足し合わせた値が、攻撃者の現在の行動力以下である
    /// * メイントリガー攻撃：
    ///     * 攻撃者のメイントリガーの範囲内に防御者がいる
    ///     * メイントリガーの攻撃力が0より大きい
    ///     * メイントリガーの必要行動力が、攻撃者の現在の行動力以下である
    ///     * 以下のいずれかの条件を満たす：
    ///         * サブトリガーの範囲内に防御者がいない、またはサブトリガーの攻撃力が0である、またはサブトリガーの必要行動力が攻撃者の現在の行動力を超えている（サブで攻撃不可能）
    ///         * サブトリガー単体は発動可能だが、メインとサブの必要行動力を足し合わせた値が攻撃者の現在の行動力を超えている（両方は撃てないためメインを優先）
    /// * サブトリガー攻撃：
    ///     * 攻撃者のサブトリガーの範囲内に防御者がいる
    ///     * サブトリガーの攻撃力が0より大きい
    ///     * サブトリガーの必要行動力が、攻撃者の現在の行動力以下である
    ///     * メイントリガーの範囲内に防御者がいない、またはメイントリガーの攻撃力が0である、またはメイントリガーの必要行動力が、攻撃者の現在の行動力を超えている
    ///      （メインが攻撃不可能な場合のみ、サブ単独攻撃が発生する）
    /// * 攻撃なし：
    ///     * 攻撃者の両トリガーの範囲内に防御者がいない、または両トリガーの攻撃力が0である、または攻撃者の現在の行動力が、有効なトリガーの最低必要行動力を下回っている
    ///
    /// # Arguments
    /// * `in_main_trigger_area` - 攻撃者のメイントリガーの範囲内にが防御者がいるか
    /// * `attacker_main_trigger_attack` - 攻撃者のメイントリガーの攻撃力
    /// * `in_sub_trigger_area` - 攻撃者のサブトリガーの範囲内に防御者がいるか
    /// * `attacker_sub_trigger_attack` - 攻撃者のサブトリガーの攻撃力
    /// * `attacker_current_action_points` - 攻撃者の現在の行動力
    /// * `attacker_main_trigger_action_points` - 攻撃者のメイントリガーの必要行動力
    /// * `attacker_sub_trigger_action_points` - 攻撃者のサブトリガーの必要行動力
    pub(super) fn determine_attack_pattern(
        in_main_trigger_area: bool,
        attacker_main_trigger_attack: i32,
        in_sub_trigger_area: bool,
        attacker_sub_trigger_attack: i32,
        attacker_current_action_points: i32,
        attacker_main_trigger_action_points: i32,
        attacker_sub_trigger_action_points: i32,
    ) -> AttackPattern {
        // 両攻撃: 両方のトリガーが有効かつ合計行動力以内
        if in_main_trigger_area
            && attacker_main_trigger_attack > 0
            && in_sub_trigger_area
            && attacker_sub_trigger_attack > 0
            && attacker_current_action_points
                >= (attacker_main_trigger_action_points + attacker_sub_trigger_action_points)
        {
            AttackPattern::Full
        // メイントリガー攻撃:
        // メインが発動可能で、かつ以下のいずれかを満たす場合
        // - サブが範囲外、またはサブの攻撃力が0、またはサブが行動不能
        // - サブ単体は発動可能だが、メイン+サブの合計が現在の行動力を超える（両方撃てないためメインを優先）
        } else if in_main_trigger_area
            && attacker_main_trigger_attack > 0
            && attacker_current_action_points >= attacker_main_trigger_action_points
            && (!in_sub_trigger_area
                || attacker_sub_trigger_attack == 0
                || attacker_current_action_points < attacker_sub_trigger_action_points
                || (in_sub_trigger_area
                    && attacker_sub_trigger_attack > 0
                    && attacker_current_action_points >= attacker_sub_trigger_action_points
                    && attacker_current_action_points
                        < (attacker_main_trigger_action_points
                            + attacker_sub_trigger_action_points)))
        {
            AttackPattern::MainOnly
        // サブトリガー攻撃: サブが発動可能で、かつメインが発動不能な場合のみ
        } else if in_sub_trigger_area
            && attacker_sub_trigger_attack > 0
            && attacker_current_action_points >= attacker_sub_trigger_action_points
            && (!in_main_trigger_area
                || attacker_main_trigger_attack == 0
                || attacker_current_action_points < attacker_main_trigger_action_points)
        {
            AttackPattern::SubOnly
        } else {
            AttackPattern::None
        }
    }

    /// ガードパターンの判定
    /// * 両防御：攻撃者に向いているトリガーが両方とも防御トリガーで、防御力が0より大きい
    /// * メイントリガー防御：攻撃者に向いているトリガーがメイントリガーで、防御力が0より大きい、かつサブトリガーが攻撃者に向いていないか、防御力が0のとき
    /// * サブトリガー防御：攻撃者に向いているトリガーがサブトリガーで、防御力が0より大きい、かつメイントリガーが攻撃者に向いていないか、防御力が0のとき
    /// * 防御なし：攻撃者に向いているトリガーがない、または攻撃者に向いているトリガーの防御力が0のとき
    pub(super) fn determine_guard_pattern(
        is_defender_facing_attacker_main: bool,
        defender_main_trigger_defense: i32,
        is_defender_facing_attacker_sub: bool,
        defender_sub_trigger_defense: i32,
    ) -> GuardPattern {
        if is_defender_facing_attacker_main
            && defender_main_trigger_defense > 0
            && is_defender_facing_attacker_sub
            && defender_sub_trigger_defense > 0
        {
            GuardPattern::Full
        } else if is_defender_facing_attacker_main
            && defender_main_trigger_defense > 0
            && (!is_defender_facing_attacker_sub || defender_sub_trigger_defense == 0)
        {
            GuardPattern::MainOnly
        } else if is_defender_facing_attacker_sub
            && defender_sub_trigger_defense > 0
            && (!is_defender_facing_attacker_main || defender_main_trigger_defense == 0)
        {
            GuardPattern::SubOnly
        } else {
            GuardPattern::None
        }
    }

    /// 両防御の場合のダメージを計算
    /// 例：9 × 8 × 2 - 4 × (10 + 5) = 144 - 60
    fn calculate_full_guard_damage(
        attack: i32,
        defend: i32,
        trigger_attack: i32,
        main_trigger_defense: i32,
        sub_trigger_defense: i32,
        defender_unit: &mut Unit,
    ) {
        let game_config = GameConfig::get_game_config();

        let mut damage = ((attack * trigger_attack) as f64) * game_config.damage_weight()
            - (defend as f64)
                * ((main_trigger_defense + sub_trigger_defense) as f64)
                * game_config.defend_weight();

        let min_damage = game_config.min_damage() as f64;
        if damage <= min_damage {
            damage = min_damage;
        }

        // ダメージを HP の比率で分散
        let total_hp = (defender_unit.main_trigger_hp().value()
            + defender_unit.sub_trigger_hp().value()) as f64;
        let main_trigger_damage =
            damage * (defender_unit.main_trigger_hp().value() as f64) / total_hp;
        let sub_trigger_damage =
            damage * (defender_unit.sub_trigger_hp().value() as f64) / total_hp;

        defender_unit.decrease_main_trigger_hp(main_trigger_damage.floor() as i32);
        defender_unit.decrease_sub_trigger_hp(sub_trigger_damage.floor() as i32);
    }

    /// 片方トリガーでの防御の場合のダメージを計算
    /// 例：9 × 8 × 2 - 4 × 10 = 144 - 40
    fn calculate_partial_guard_damage(
        attack: i32,
        defend: i32,
        trigger_attack: i32,
        trigger_defense: i32,
    ) -> i32 {
        let game_config = GameConfig::get_game_config();

        let mut damage = ((attack * trigger_attack) as f64) * game_config.damage_weight()
            - (defend as f64) * (trigger_defense as f64) * game_config.defend_weight();

        let min_damage = game_config.min_damage() as f64;
        if damage <= min_damage {
            damage = min_damage;
        }

        damage.floor() as i32
    }

    // ゲッター
    pub fn main_trigger_hp(&self) -> &TriggerHP {
        &self.main_trigger_hp
    }

    pub fn sub_trigger_hp(&self) -> &TriggerHP {
        &self.sub_trigger_hp
    }

    pub fn is_avoided(&self) -> bool {
        self.is_avoided.value()
    }

    pub fn is_defeated(&self) -> bool {
        self.is_defeated
    }
}

impl PartialEq for Combat {
    fn eq(&self, other: &Self) -> bool {
        self.combat_id == other.combat_id
    }
}

impl Eq for Combat {}
