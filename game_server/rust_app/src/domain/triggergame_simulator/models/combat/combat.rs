use super::attacking_unit_id::attacking_unit_id::AttackingUnitId;
use super::combat_id::combat_id::CombatId;
use super::defending_unit_id::defending_unit_id::DefendingUnitId;
use super::is_avoided::is_avoided::IsAvoided;
use uuid::Uuid;

/// Combat集約
/// 戦闘を表すエンティティ
#[derive(Debug, Clone)]
pub struct Combat {
    combat_id: CombatId,
    attacking_unit_id: AttackingUnitId,
    defending_unit_id: DefendingUnitId,
    is_avoided: IsAvoided,
}

impl Combat {
    // privateなコンストラクタ
    fn new(
        combat_id: CombatId,
        attacking_unit_id: AttackingUnitId,
        defending_unit_id: DefendingUnitId,
        is_avoided: IsAvoided,
    ) -> Self {
        Self {
            combat_id,
            attacking_unit_id,
            defending_unit_id,
            is_avoided,
        }
    }

    /// 新規戦闘の生成
    pub fn create(
        attacking_unit_id: AttackingUnitId,
        defending_unit_id: DefendingUnitId,
    ) -> Self {
        let combat_id = CombatId::new(Uuid::new_v4().to_string());
        let is_avoided = IsAvoided::new(false); // デフォルトは回避なし

        Self::new(combat_id, attacking_unit_id, defending_unit_id, is_avoided)
    }

    /// 戦闘の再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        combat_id: CombatId,
        attacking_unit_id: AttackingUnitId,
        defending_unit_id: DefendingUnitId,
        is_avoided: IsAvoided,
    ) -> Self {
        Self::new(combat_id, attacking_unit_id, defending_unit_id, is_avoided)
    }

    /// 攻撃が回避されたことを記録
    pub fn mark_as_avoided(&mut self) {
        self.is_avoided = IsAvoided::new(true);
    }

    /// 攻撃が命中したことを記録
    pub fn mark_as_hit(&mut self) {
        self.is_avoided = IsAvoided::new(false);
    }

    /// 戦闘結果を判定（回避されたかどうか）
    pub fn was_avoided(&self) -> bool {
        self.is_avoided.value()
    }

    // ゲッター
    pub fn combat_id(&self) -> &CombatId {
        &self.combat_id
    }

    pub fn attacking_unit_id(&self) -> &AttackingUnitId {
        &self.attacking_unit_id
    }

    pub fn defending_unit_id(&self) -> &DefendingUnitId {
        &self.defending_unit_id
    }

    pub fn is_avoided(&self) -> &IsAvoided {
        &self.is_avoided
    }
}

impl PartialEq for Combat {
    fn eq(&self, other: &Self) -> bool {
        self.combat_id == other.combat_id
    }
}

impl Eq for Combat {}
