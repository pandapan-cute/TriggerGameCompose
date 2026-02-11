use crate::domain::triggergame_simulator::configs::game_config::GameConfig;
use crate::domain::triggergame_simulator::configs::trigger_status::TriggerStatus;
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use crate::domain::triggergame_simulator::models::combat::is_avoided;
use crate::domain::unit_management::models::unit::position::position::Position;
use crate::domain::unit_management::models::unit::trigger_id::trigger_id::TriggerId;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;

use super::combat_id::combat_id::CombatId;
use super::is_avoided::is_avoided::IsAvoided;
use uuid::Uuid;

/// Combat集約
/// 戦闘を表すエンティティ
#[derive(Debug, Clone)]
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
    main_trigger_hp: i32,
    sub_trigger_hp: i32,
    defender_base_defense: i32,
    defender_base_avoid: i32,
    is_avoided: IsAvoided,
    is_defeated: bool,
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
        main_trigger_hp: i32,
        sub_trigger_hp: i32,
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
        main_trigger_hp: i32,
        sub_trigger_hp: i32,
        defender_main_trigger_azimuth: TriggerAzimuth,
        defender_sub_trigger_azimuth: TriggerAzimuth,
        defender_base_defense: i32,
        defender_base_avoid: i32,
    ) -> Option<Self> {
        // 攻撃側のメイントリガーが防御側に当たる可能性があるか確認
        let is_main_trigger_hit = Self::check_trigger_in_range_and_angle(
            &attacker_position,
            &attacker_main_trigger_id,
            &attacker_main_trigger_azimuth,
            &defender_position,
        );
        // 攻撃側のサブトリガーが防御側に当たる可能性があるか確認
        let is_sub_trigger_hit = Self::check_trigger_in_range_and_angle(
            &attacker_position,
            &attacker_sub_trigger_id,
            &attacker_sub_trigger_azimuth,
            &defender_position,
        );
        if !is_main_trigger_hit && !is_sub_trigger_hit {
            // 射程外、角度の範囲外の場合はNoneを返す
            return None;
        }

        let defender_main_trigger_status =
            TriggerStatus::get_trigger_status(defender_main_trigger_id.value());
        let defender_sub_trigger_status =
            TriggerStatus::get_trigger_status(defender_sub_trigger_id.value());

        // 防御側のメイントリガーが攻撃者に向いているか確認
        let is_defender_facing_attacker_main = Self::check_trigger_in_angle(
            &defender_position,
            &attacker_position,
            defender_main_trigger_azimuth.value(),
            defender_main_trigger_status.angle(),
        );
        // 防御側のサブトリガーが攻撃者に向いているか確認
        let is_defender_facing_attacker_sub = Self::check_trigger_in_angle(
            &defender_position,
            &attacker_position,
            defender_sub_trigger_azimuth.value(),
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

        // メイントリガーの残HP
        let mut main_trigger_hp = main_trigger_hp;
        // サブトリガーの残HP
        let mut sub_trigger_hp = sub_trigger_hp;

        if !is_avoided.value() {
            // ダメージ量の計算
            if is_defender_facing_attacker_main && is_defender_facing_attacker_sub {
                // 両防御の場合
                let (main_trigger_damage, sub_trigger_damage) = Self::calculate_full_guard_damage(
                    attacker_base_attack,
                    defender_base_defense,
                    TriggerStatus::get_trigger_status(attacker_main_trigger_id.value()).attack()
                        + TriggerStatus::get_trigger_status(attacker_sub_trigger_id.value())
                            .attack(),
                    defender_main_trigger_status.defense(),
                    defender_sub_trigger_status.defense(),
                    main_trigger_hp,
                    sub_trigger_hp,
                );

                main_trigger_hp -= main_trigger_damage;
                sub_trigger_hp -= sub_trigger_damage;

                if main_trigger_hp <= 0 || sub_trigger_hp <= 0 {
                    is_defeated = true;
                }
            } else if is_defender_facing_attacker_main && !is_defender_facing_attacker_sub {
                // 片方防御の場合（メイントリガーのみ防御）
                let damage = Self::calculate_partial_guard_damage(
                    attacker_base_attack,
                    defender_base_defense,
                    TriggerStatus::get_trigger_status(attacker_main_trigger_id.value()).attack()
                        + TriggerStatus::get_trigger_status(attacker_sub_trigger_id.value())
                            .attack(),
                    defender_main_trigger_status.defense(),
                );
                main_trigger_hp -= damage;
            } else if !is_defender_facing_attacker_main && is_defender_facing_attacker_sub {
                // 片方防御の場合（サブトリガーのみ防御）
                let damage = Self::calculate_partial_guard_damage(
                    attacker_base_attack,
                    defender_base_defense,
                    TriggerStatus::get_trigger_status(attacker_main_trigger_id.value()).attack()
                        + TriggerStatus::get_trigger_status(attacker_sub_trigger_id.value())
                            .attack(),
                    defender_sub_trigger_status.defense(),
                );
                sub_trigger_hp -= damage;
            }
        }

        Some(Self::new(
            CombatId::new(Uuid::new_v4().to_string()),
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
            defender_base_defense,
            defender_base_avoid,
            main_trigger_hp,
            sub_trigger_hp,
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
        let (defender_x, defender_y) = defender_position.get_pixel_position();
        let pixel_length =
            (((attacker_x - defender_x).pow(2) + (attacker_y - defender_y).pow(2)) as f64).sqrt();

        // トリガーの射程をピクセル長に変換する
        let game_config = GameConfig::get_game_config();
        let hex_width = game_config.hex_width();
        let hex_height = game_config.hex_height();
        let attacker_trigger_status =
            TriggerStatus::get_trigger_status(attacker_trigger_id.value());
        let trigger_range_in_pixels = (attacker_trigger_status.range() as f64)
            * ((hex_width * 3 / 4) as f64).hypot(hex_height as f64);

        if pixel_length >= trigger_range_in_pixels {
            // 射程内にいない場合はfalseを返す
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
        let dx = (defender_position.get_pixel_position().0
            - attacker_position.get_pixel_position().0) as f64;
        let dy = (defender_position.get_pixel_position().1
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

    /// 両防御の場合のダメージを計算
    /// 例：9 × 8 × 2 - 4 × (10 + 5) = 144 - 60
    fn calculate_full_guard_damage(
        attack: i32,
        defend: i32,
        trigger_attack: i32,
        main_trigger_defense: i32,
        sub_trigger_defense: i32,
        main_trigger_hp: i32,
        sub_trigger_hp: i32,
    ) -> (i32, i32) {
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
        let total_hp = (main_trigger_hp + sub_trigger_hp) as f64;
        let main_trigger_damage = damage * (main_trigger_hp as f64) / total_hp;
        let sub_trigger_damage = damage * (sub_trigger_hp as f64) / total_hp;

        (
            main_trigger_damage.floor() as i32,
            sub_trigger_damage.floor() as i32,
        )
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
}

impl PartialEq for Combat {
    fn eq(&self, other: &Self) -> bool {
        self.combat_id == other.combat_id
    }
}

impl Eq for Combat {}
