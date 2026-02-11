use crate::domain::player_management::models::player::player_id::player_id::PlayerId;

use super::current_turn_number::current_turn_number::CurrentTurnNumber;
use super::game_id::game_id::GameId;
use super::unit_id::unit_id::UnitId;
use uuid::Uuid;

/// Game集約
/// ゲーム全体を管理するルートエンティティ
#[derive(Debug, Clone)]
pub struct Game {
    game_id: GameId,
    current_turn_number: CurrentTurnNumber,
    player1_id: PlayerId,
    player2_id: PlayerId,
}

impl Game {
    const MAX_TURNS: i32 = 6;

    // privateなコンストラクタ
    pub fn new(
        game_id: GameId,
        current_turn_number: CurrentTurnNumber,
        player1_id: PlayerId,
        player2_id: PlayerId,
    ) -> Self {
        Self {
            game_id,
            current_turn_number,
            player1_id,
            player2_id,
        }
    }

    /// 新規ゲームの生成
    pub fn create(game_id: GameId, player1_id: &PlayerId, player2_id: &PlayerId) -> Self {
        let current_turn_number = CurrentTurnNumber::initial();

        Self::new(
            game_id,
            current_turn_number,
            player1_id.clone(),
            player2_id.clone(),
        )
    }

    /// ゲームの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        game_id: GameId,
        current_turn_number: CurrentTurnNumber,
        player1_id: PlayerId,
        player2_id: PlayerId,
    ) -> Self {
        Self::new(game_id, current_turn_number, player1_id, player2_id)
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

    // ゲッター
    pub fn game_id(&self) -> &GameId {
        &self.game_id
    }

    pub fn current_turn_number(&self) -> &CurrentTurnNumber {
        &self.current_turn_number
    }

    pub fn player1_id(&self) -> &PlayerId {
        &self.player1_id
    }

    pub fn player2_id(&self) -> &PlayerId {
        &self.player2_id
    }

    /// 指定されたプレイヤーIDに対応する対戦相手のプレイヤーIDを取得
    pub fn get_opponent_player_id(&self, player_id: &PlayerId) -> Result<PlayerId, String> {
        if player_id == self.player1_id() {
            Ok(self.player2_id().clone())
        } else if player_id == self.player2_id() {
            Ok(self.player1_id().clone())
        } else {
            Err("指定されたプレイヤーIDはこのゲームの参加者ではありません".to_string())
        }
    }
}

impl PartialEq for Game {
    fn eq(&self, other: &Self) -> bool {
        self.game_id == other.game_id
    }
}

impl Eq for Game {}
