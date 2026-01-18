#[cfg(test)]
mod tests {
    use super::super::attacking_unit_id::attacking_unit_id::AttackingUnitId;
    use super::super::combat::Combat;
    use super::super::combat_id::combat_id::CombatId;
    use super::super::defending_unit_id::defending_unit_id::DefendingUnitId;
    use super::super::is_avoided::is_avoided::IsAvoided;
    use uuid::Uuid;

    #[test]
    fn test_create_combat() {
        let attacking_unit_id = AttackingUnitId::new(Uuid::new_v4().to_string());
        let defending_unit_id = DefendingUnitId::new(Uuid::new_v4().to_string());

        let combat = Combat::create(attacking_unit_id.clone(), defending_unit_id.clone());

        assert_eq!(combat.attacking_unit_id(), &attacking_unit_id);
        assert_eq!(combat.defending_unit_id(), &defending_unit_id);
        assert!(!combat.was_avoided()); // デフォルトは回避なし
    }

    #[test]
    fn test_mark_as_avoided() {
        let attacking_unit_id = AttackingUnitId::new(Uuid::new_v4().to_string());
        let defending_unit_id = DefendingUnitId::new(Uuid::new_v4().to_string());

        let mut combat = Combat::create(attacking_unit_id, defending_unit_id);
        combat.mark_as_avoided();

        assert!(combat.was_avoided());
    }

    #[test]
    fn test_mark_as_hit() {
        let attacking_unit_id = AttackingUnitId::new(Uuid::new_v4().to_string());
        let defending_unit_id = DefendingUnitId::new(Uuid::new_v4().to_string());
        let combat_id = CombatId::new(Uuid::new_v4().to_string());
        let is_avoided = IsAvoided::new(true);

        let mut combat = Combat::reconstruct(
            combat_id,
            attacking_unit_id,
            defending_unit_id,
            is_avoided,
        );

        assert!(combat.was_avoided());

        combat.mark_as_hit();
        assert!(!combat.was_avoided());
    }

    #[test]
    fn test_reconstruct_combat() {
        let combat_id = CombatId::new(Uuid::new_v4().to_string());
        let attacking_unit_id = AttackingUnitId::new(Uuid::new_v4().to_string());
        let defending_unit_id = DefendingUnitId::new(Uuid::new_v4().to_string());
        let is_avoided = IsAvoided::new(true);

        let combat = Combat::reconstruct(
            combat_id.clone(),
            attacking_unit_id.clone(),
            defending_unit_id.clone(),
            is_avoided.clone(),
        );

        assert_eq!(combat.combat_id(), &combat_id);
        assert_eq!(combat.attacking_unit_id(), &attacking_unit_id);
        assert_eq!(combat.defending_unit_id(), &defending_unit_id);
        assert_eq!(combat.is_avoided(), &is_avoided);
        assert!(combat.was_avoided());
    }

    #[test]
    fn test_combat_equality() {
        let combat_id = CombatId::new(Uuid::new_v4().to_string());
        let attacking_unit_id = AttackingUnitId::new(Uuid::new_v4().to_string());
        let defending_unit_id = DefendingUnitId::new(Uuid::new_v4().to_string());
        let is_avoided = IsAvoided::new(false);

        let combat1 = Combat::reconstruct(
            combat_id.clone(),
            attacking_unit_id.clone(),
            defending_unit_id.clone(),
            is_avoided.clone(),
        );
        let combat2 = Combat::reconstruct(
            combat_id.clone(),
            attacking_unit_id.clone(),
            defending_unit_id.clone(),
            is_avoided.clone(),
        );

        assert_eq!(combat1, combat2);
    }
}
