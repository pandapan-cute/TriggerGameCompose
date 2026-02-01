use super::current_turn_number::current_turn_number::CurrentTurnNumber;
use super::game_id::game_id::GameId;
use super::unit_id::unit_id::UnitId;
use uuid::Uuid;

/// Game集約
/// ゲーム全体を管理するルートエンティティ
#[derive(Debug, Clone)]
pub struct Game {
    game_id: GameId,
    unit_ids: Vec<UnitId>,
    current_turn_number: CurrentTurnNumber,
}

impl Game {
    const MAX_TURNS: i32 = 6;

    // privateなコンストラクタ
    fn new(game_id: GameId, unit_ids: Vec<UnitId>, current_turn_number: CurrentTurnNumber) -> Self {
        Self {
            game_id,
            unit_ids,
            current_turn_number,
        }
    }

    /// 新規ゲームの生成
    pub fn create(game_id: GameId, unit_ids: Vec<UnitId>) -> Self {
        let current_turn_number = CurrentTurnNumber::initial();

        Self::new(game_id, unit_ids, current_turn_number)
    }

    /// ゲームの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        game_id: GameId,
        unit_ids: Vec<UnitId>,
        current_turn_number: CurrentTurnNumber,
    ) -> Self {
        Self::new(game_id, unit_ids, current_turn_number)
    }

    /// 次のターンへ進める
    pub fn advance_to_next_turn(&mut self) -> Result<(), String> {
        if self.is_game_finished() {
            return Err("ゲームは既に最終ターンに達しています".to_string());
        }

        let next_turn_value = self.current_turn_number.value() + 1;
        self.current_turn_number = CurrentTurnNumber::new(next_turn_value);
        Ok(())
    }

    /// ゲームが終了しているかどうか（最終ターンに達しているか）
    pub fn is_game_finished(&self) -> bool {
        self.current_turn_number.value() >= Self::MAX_TURNS
    }

    /// ユニットをゲームに追加
    pub fn add_unit(&mut self, unit_id: &str) {
        self.unit_ids.push(UnitId::new(unit_id.to_string()));
    }

    /// 指定したユニットがゲームに含まれているか確認
    pub fn contains_unit(&self, unit_id: &str) -> bool {
        self.unit_ids.contains(&UnitId::new(unit_id.to_string()))
    }

    /// ゲーム内のユニット数を取得
    pub fn unit_count(&self) -> usize {
        self.unit_ids.len()
    }

    // ゲッター
    pub fn game_id(&self) -> &GameId {
        &self.game_id
    }

    pub fn unit_ids(&self) -> &Vec<UnitId> {
        &self.unit_ids
    }

    pub fn current_turn_number(&self) -> &CurrentTurnNumber {
        &self.current_turn_number
    }
}

impl PartialEq for Game {
    fn eq(&self, other: &Self) -> bool {
        self.game_id == other.game_id
    }
}

impl Eq for Game {}
