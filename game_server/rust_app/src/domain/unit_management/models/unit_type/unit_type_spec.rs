use std::collections::HashMap;

/// ユニットタイプのマスターデータ（値オブジェクト）
#[derive(Debug, Clone, PartialEq)]
pub struct UnitTypeSpec {
    unit_type_id: String,
    base_hp: i32,
    base_attack: i32,
    base_defense: i32,
    move_range: i32,
    sight_range: i32,
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
                    base_hp: 100,
                    base_attack: 30,
                    base_defense: 10,
                    move_range: 4,
                    sight_range: 8,
                    action_points: 2,
                },
            ),
            (
                "KUGA_YUMA",
                UnitTypeSpec {
                    unit_type_id: "KUGA_YUMA".to_string(),
                    base_hp: 80,
                    base_attack: 50,
                    base_defense: 5,
                    move_range: 3,
                    sight_range: 13,
                    action_points: 2,
                },
            ),
            (
                "AMATORI_CHIKA",
                UnitTypeSpec {
                    unit_type_id: "AMATORI_CHIKA".to_string(),
                    base_hp: 120,
                    base_attack: 25,
                    base_defense: 15,
                    move_range: 2,
                    sight_range: 10,
                    action_points: 2,
                },
            ),
            (
                "HYUSE_KURONIN",
                UnitTypeSpec {
                    unit_type_id: "HYUSE_KURONIN".to_string(),
                    base_hp: 120,
                    base_attack: 25,
                    base_defense: 15,
                    move_range: 2,
                    sight_range: 10,
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
    pub fn base_hp(&self) -> i32 {
        self.base_hp
    }
    pub fn sight_range(&self) -> i32 {
        self.sight_range
    }
    pub fn action_points(&self) -> i32 {
        self.action_points
    }
}
