use pyo3::prelude::*;

#[pyclass]
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum GameStateValue {
    InProgress, // ゲーム進行中
    Completed,  // ゲーム完了
}

#[pyclass]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GameState {
    #[pyo3(get)]
    value: GameStateValue,
}

impl GameState {
    pub fn new(value: GameStateValue) -> Self {
        Self { value }
    }

    pub fn initial() -> Self {
        Self {
            value: GameStateValue::InProgress,
        }
    }

    /// 文字列から新しいインスタンスを生成
    /// データベースから取得した値からの変換に使用
    pub fn new_string(value: String) -> Self {
        let status_value = match value.as_str() {
            "InProgress" => GameStateValue::InProgress,
            "Completed" => GameStateValue::Completed,
            _ => panic!("Invalid GameStateValue string"),
        };
        Self {
            value: status_value,
        }
    }

    pub fn fmt_value(&self) -> String {
        match self.value {
            GameStateValue::InProgress => "InProgress".to_string(),
            GameStateValue::Completed => "Completed".to_string(),
        }
    }

    pub fn value(&self) -> &GameStateValue {
        &self.value
    }

    pub fn is_in_progress(&self) -> bool {
        matches!(self.value, GameStateValue::InProgress)
    }

    pub fn is_completed(&self) -> bool {
        matches!(self.value, GameStateValue::Completed)
    }

    pub fn set_completed(&mut self) {
        self.value = GameStateValue::Completed;
    }
}

// 等価性の比較を実装
impl PartialEq for GameState {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl Eq for GameState {}

use std::fmt;

impl fmt::Display for GameStateValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            GameStateValue::InProgress => write!(f, "InProgress"),
            GameStateValue::Completed => write!(f, "Completed"),
        }
    }
}
