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
    /// 防御力
    defense: i32,
    /// 回避力
    avoid: i32,
    /// 消費行動力
    action_points: i32,
    /// 待機時間
    wait_time: i32,
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
                    defense: 0,
                    avoid: 1,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
            (
                "RAYGUST",
                TriggerStatus {
                    trigger_id: "RAYGUST".to_string(),
                    angle: 120,
                    range: 2,
                    attack: 6,
                    defense: 10,
                    avoid: 1,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
            (
                "SCORPION",
                TriggerStatus {
                    trigger_id: "SCORPION".to_string(),
                    angle: 120,
                    range: 1,
                    attack: 6,
                    defense: 0,
                    avoid: 4,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
            (
                "ASTEROID",
                TriggerStatus {
                    trigger_id: "ASTEROID".to_string(),
                    angle: 60,
                    range: 5,
                    attack: 4,
                    defense: 0,
                    avoid: 4,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
            (
                "IBIS",
                TriggerStatus {
                    trigger_id: "IBIS".to_string(),
                    angle: 30,
                    range: 10,
                    attack: 12,
                    defense: 0,
                    avoid: 1,
                    action_points: 2,
                    wait_time: 1,
                },
            ),
            (
                "SHIELD",
                TriggerStatus {
                    trigger_id: "SHIELD".to_string(),
                    angle: 120,
                    range: 1,
                    attack: 0,
                    defense: 5,
                    avoid: 4,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
            (
                "BAGWORM",
                TriggerStatus {
                    trigger_id: "BAGWORM".to_string(),
                    angle: 60,
                    range: 1,
                    attack: 0,
                    defense: 0,
                    avoid: 5,
                    action_points: 1,
                    wait_time: 1,
                },
            ),
        ]);
        trigger_statuses.get(trigger_id).cloned().unwrap()
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

    pub fn action_points(&self) -> i32 {
        self.action_points
    }

    pub fn wait_time(&self) -> i32 {
        self.wait_time
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
            action_points: self.action_points,
            wait_time: self.wait_time,
        }
    }
}
