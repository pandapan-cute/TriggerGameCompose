use std::collections::HashMap;

/// トリガーステータス情報
pub struct TriggerStatus {
    /// トリガーステータスID
    trigger_id: String,
    /// トリガー有効角度
    angle: i32,
    /// 射程
    range: i32,
    /// 攻撃力
    attack: i32,
    /// 回避力
    avoid: i32,
    /// 防御力
    defense: i32,
}

impl TriggerStatus {
    /// トリガーステータスの取得
    pub fn get_trigger_status(trigger_id: &str) -> TriggerStatus {
        let trigger_statuses: HashMap<&str, TriggerStatus> = HashMap::from([
            (
                "KOGETSU",
                TriggerStatus {
                    trigger_id: "KOGETSU".to_string(),
                    angle: 120,
                    range: 2,
                    attack: 8,
                    avoid: 5,
                    defense: 0,
                },
            ),
            (
                "RAYGUST",
                TriggerStatus {
                    trigger_id: "RAYGUST".to_string(),
                    angle: 120,
                    range: 2,
                    attack: 6,
                    avoid: 3,
                    defense: 10,
                },
            ),
            (
                "SCOPEON",
                TriggerStatus {
                    trigger_id: "SCOPEON".to_string(),
                    angle: 120,
                    range: 1,
                    attack: 8,
                    avoid: 10,
                    defense: 0,
                },
            ),
            (
                "ASTEROID",
                TriggerStatus {
                    trigger_id: "ASTEROID".to_string(),
                    angle: 60,
                    range: 5,
                    attack: 4,
                    avoid: 10,
                    defense: 0,
                },
            ),
            (
                "IBIS",
                TriggerStatus {
                    trigger_id: "IBIS".to_string(),
                    angle: 30,
                    range: 10,
                    attack: 10,
                    avoid: 3,
                    defense: 0,
                },
            ),
            (
                "SHIELD",
                TriggerStatus {
                    trigger_id: "SHIELD".to_string(),
                    angle: 120,
                    range: 1,
                    attack: 0,
                    avoid: 10,
                    defense: 5,
                },
            ),
            (
                "BAGWORM",
                TriggerStatus {
                    trigger_id: "BAGWORM".to_string(),
                    angle: 60,
                    range: 1,
                    attack: 0,
                    avoid: 10,
                    defense: 0,
                },
            ),
        ]);
        if let Some(trigger_info) = trigger_statuses.get(trigger_id).cloned() {
            trigger_info
        } else {
            panic!(
                "指定されたトリガーステータスIDが存在しません: {}",
                trigger_id
            );
        }
    }

    // 各種ステータス取得メソッド
    pub fn angle(&self) -> i32 {
        self.angle
    }

    pub fn range(&self) -> i32 {
        self.range
    }

    pub fn attack(&self) -> i32 {
        self.attack
    }

    pub fn defense(&self) -> i32 {
        self.defense
    }

    pub fn avoid(&self) -> i32 {
        self.avoid
    }
}

impl Clone for TriggerStatus {
    fn clone(&self) -> Self {
        TriggerStatus {
            trigger_id: self.trigger_id.clone(),
            angle: self.angle,
            range: self.range,
            attack: self.attack,
            avoid: self.avoid,
            defense: self.defense,
        }
    }
}
