use std::collections::HashMap;

/// ユニットタイプのマスターデータ（値オブジェクト）
#[derive(Debug, Clone, PartialEq)]
pub struct UnitTypeSpec {
    /// ユニットタイプID
    unit_type_id: String,
    base_attack: i32,
    base_defense: i32,
    base_avoid: i32,
    action_points: i32,
}

impl UnitTypeSpec {
    /// マスターデータの定義
    pub fn get_spec(unit_type_id: &str) -> Option<Self> {
        let specs: HashMap<&str, UnitTypeSpec> = [
            (
                "MIKUMO_OSAMU",
                UnitTypeSpec {
                    unit_type_id: "MIKUMO_OSAMU".to_string(),
                    base_attack: 30,
                    base_defense: 10,
                    base_avoid: 5,
                    action_points: 2,
                },
            ),
            (
                "KUGA_YUMA",
                UnitTypeSpec {
                    unit_type_id: "KUGA_YUMA".to_string(),
                    base_attack: 50,
                    base_defense: 5,
                    base_avoid: 10,
                    action_points: 2,
                },
            ),
            (
                "AMATORI_CHIKA",
                UnitTypeSpec {
                    unit_type_id: "AMATORI_CHIKA".to_string(),
                    base_attack: 25,
                    base_defense: 15,
                    base_avoid: 5,
                    action_points: 2,
                },
            ),
            (
                "HYUSE_KURONIN",
                UnitTypeSpec {
                    unit_type_id: "HYUSE_KURONIN".to_string(),
                    base_attack: 25,
                    base_defense: 15,
                    base_avoid: 5,
                    action_points: 2,
                },
            ),
        ]
        .iter()
        .cloned()
        .collect();

        specs.get(unit_type_id).cloned()
    }

    // ゲッター
    pub fn base_attack(&self) -> i32 {
        self.base_attack
    }

    pub fn base_defense(&self) -> i32 {
        self.base_defense
    }

    pub fn base_avoid(&self) -> i32 {
        self.base_avoid
    }
}
