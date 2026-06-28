#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum GameTypeValue {
    PvP, // プレイヤー対プレイヤー
    PvE, // プレイヤー対環境
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GameType {
    value: GameTypeValue,
}

impl GameType {
    pub fn new(value: GameTypeValue) -> Self {
        Self { value }
    }

    pub fn initial() -> Self {
        Self {
            value: GameTypeValue::PvP,
        }
    }

    pub fn initial_pve() -> Self {
        Self {
            value: GameTypeValue::PvE,
        }
    }

    /// 文字列から新しいインスタンスを生成
    /// データベースから取得した値からの変換に使用
    pub fn new_string(value: String) -> Self {
        let status_value = match value.as_str() {
            "PvP" => GameTypeValue::PvP,
            "PvE" => GameTypeValue::PvE,
            _ => panic!("Invalid GameTypeValue string"),
        };
        Self {
            value: status_value,
        }
    }

    pub fn fmt_value(&self) -> String {
        match self.value {
            GameTypeValue::PvP => "PvP".to_string(),
            GameTypeValue::PvE => "PvE".to_string(),
        }
    }

    pub fn value(&self) -> &GameTypeValue {
        &self.value
    }

    pub fn is_pvp(&self) -> bool {
        matches!(self.value, GameTypeValue::PvP)
    }

    pub fn is_pve(&self) -> bool {
        matches!(self.value, GameTypeValue::PvE)
    }

    /// ゲッター
    pub fn get_value(&self) -> &GameTypeValue {
        &self.value
    }

    pub fn set_pve(&mut self) {
        self.value = GameTypeValue::PvE;
    }
}

// 等価性の比較を実装
impl PartialEq for GameType {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for GameType {}

use std::fmt;

impl fmt::Display for GameTypeValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            GameTypeValue::PvP => write!(f, "PvP"),
            GameTypeValue::PvE => write!(f, "PvE"),
        }
    }
}
