use std::sync::Arc;

use crate::domain::{
    player_management::models::player::player_id::player_id::PlayerId,
    triggergame_simulator::{
        models::{
            game::{game::Game, game_id::game_id::GameId},
            step::step::Step,
            turn::{
                turn_id::turn_id::TurnId,
                turn_number::turn_number::TurnNumber,
                turn_start_datetime::turn_start_datetime::TurnStartDatetime,
                turn_status::turn_status::{TurnStatus, TurnStatusValue},
                Turn,
            },
        },
        repositories::{game_repository::GameRepository, turn_repository::TurnRepository},
    },
};

/// 提出受付結果を表す。
pub enum SubmissionResult {
    /// 相手の提出を待っている状態。
    WaitingForOpponent,
    /// 両者分が揃ったので解決処理へ進める状態。
    ReadyToResolve {
        game: Game,
        player_turn: Turn,
        opponent_turn: Turn,
        player_id: PlayerId,
        game_id: GameId,
    },
}

/// ターン提出受付（重複チェック・保存・相手提出確認）を担当するサービス。
pub struct TurnSubmissionService {
    game_repository: Arc<dyn GameRepository>,
    turn_repository: Arc<dyn TurnRepository>,
}

impl TurnSubmissionService {
    /// `TurnSubmissionService` を生成する。
    ///
    /// # Arguments
    /// - `game_repository`: ゲーム情報の取得に利用するリポジトリ。
    /// - `turn_repository`: ターン情報の取得/保存に利用するリポジトリ。
    pub fn new(
        game_repository: Arc<dyn GameRepository>,
        turn_repository: Arc<dyn TurnRepository>,
    ) -> Self {
        Self {
            game_repository,
            turn_repository,
        }
    }

    /// ターン提出を受け付け、解決可能状態かどうかを判定する。
    ///
    /// # Arguments
    /// - `game_id`: 提出対象のゲームID文字列。
    /// - `player_id`: 提出したプレイヤーID文字列。
    /// - `steps`: クライアントが提出したステップ配列。
    ///
    /// # Returns
    /// - `SubmissionResult`: 相手待ちか、解決処理へ進めるかの状態。
    /// - `Err(String)`: 提出受付に失敗した場合のエラーメッセージ。
    pub async fn accept_submission(
        &self,
        game_id: String,
        player_id: String,
        steps: Vec<Step>,
    ) -> Result<SubmissionResult, String> {
        let game_id = GameId::new(game_id);
        let player_id = PlayerId::new(player_id);

        let game = self.load_game(&game_id).await?;
        self.ensure_not_submitted_yet(&game, &game_id, &player_id)
            .await?;

        let player_turn = self.build_turn(&game, &game_id, &player_id, steps);
        self.save_turn(&player_turn).await?;

        let opponent_turn = self.load_opponent_turn(&game, &game_id, &player_id).await?;

        if let Some(opponent_turn) = opponent_turn {
            println!(
                "対戦相手のターン情報が登録されていることを確認しました ゲームID: {}, プレイヤーID: {}, ターン番号: {:?}",
                game_id.value(),
                game.get_opponent_player_id(&player_id)?.value(),
                TurnNumber::new(game.current_turn_number().value()).value()
            );

            Ok(SubmissionResult::ReadyToResolve {
                game,
                player_turn,
                opponent_turn,
                player_id,
                game_id,
            })
        } else {
            Ok(SubmissionResult::WaitingForOpponent)
        }
    }

    /// ゲーム情報を取得する。
    ///
    /// # Arguments
    /// - `game_id`: 取得対象のゲームID。
    ///
    /// # Returns
    /// - `Game`: 取得したゲーム情報。
    /// - `Err(String)`: 取得失敗時のエラーメッセージ。
    async fn load_game(&self, game_id: &GameId) -> Result<Game, String> {
        self.game_repository
            .get_game_by_id(game_id)
            .await
            .map_err(|e| format!("ゲーム情報の取得に失敗しました: {}", e))
    }

    /// 同一ターンの重複提出がないことを検証する。
    ///
    /// # Arguments
    /// - `game`: 現在のゲーム情報。
    /// - `game_id`: ゲームID。
    /// - `player_id`: 提出プレイヤーID。
    ///
    /// # Returns
    /// - `Ok(())`: 重複なし。
    /// - `Err(String)`: 重複提出または検証失敗。
    async fn ensure_not_submitted_yet(
        &self,
        game: &Game,
        game_id: &GameId,
        player_id: &PlayerId,
    ) -> Result<(), String> {
        let turn_data = self
            .turn_repository
            .get_turn_data(
                game_id,
                player_id,
                &TurnNumber::new(game.current_turn_number().value()),
            )
            .await?;

        if turn_data.is_some() {
            return Err("このターンの情報はすでに登録されています。".to_string());
        }

        Ok(())
    }

    /// 提出内容からターンエンティティを生成する。
    ///
    /// # Arguments
    /// - `game`: 現在のゲーム情報。
    /// - `game_id`: ゲームID。
    /// - `player_id`: 提出プレイヤーID。
    /// - `steps`: 提出されたステップ配列。
    ///
    /// # Returns
    /// - `Turn`: 生成したターンエンティティ。
    fn build_turn(
        &self,
        game: &Game,
        game_id: &GameId,
        player_id: &PlayerId,
        steps: Vec<Step>,
    ) -> Turn {
        Turn::new(
            TurnId::new(
                game_id.clone().value().to_string()
                    + "_"
                    + &player_id.value().to_string()
                    + "_"
                    + &game.current_turn_number().value().to_string(),
            ),
            game_id.clone(),
            player_id.clone(),
            TurnNumber::new(game.current_turn_number().value()),
            TurnStartDatetime::new(chrono::Utc::now()),
            TurnStatus::new(TurnStatusValue::StepSetting),
            steps,
        )
    }

    /// 提出ターンを永続化する。
    ///
    /// # Arguments
    /// - `turn`: 保存対象のターン。
    ///
    /// # Returns
    /// - `Ok(())`: 保存成功。
    /// - `Err(String)`: 保存失敗。
    async fn save_turn(&self, turn: &Turn) -> Result<(), String> {
        self.turn_repository
            .save(turn)
            .await
            .map_err(|e| format!("ターン情報の登録に失敗しました: {}", e))
    }

    /// 対戦相手の提出済みターンを取得する。
    ///
    /// # Arguments
    /// - `game`: 現在のゲーム情報。
    /// - `game_id`: ゲームID。
    /// - `player_id`: 提出プレイヤーID。
    ///
    /// # Returns
    /// - `Option<Turn>`: 相手提出があれば `Some(Turn)`、未提出なら `None`。
    /// - `Err(String)`: 取得失敗。
    async fn load_opponent_turn(
        &self,
        game: &Game,
        game_id: &GameId,
        player_id: &PlayerId,
    ) -> Result<Option<Turn>, String> {
        let opponent_player_id = game.get_opponent_player_id(player_id)?;

        self.turn_repository
            .get_turn_data(
                game_id,
                &opponent_player_id,
                &TurnNumber::new(game.current_turn_number().value()),
            )
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::TurnSubmissionService;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::{
        game::Game, game_id::game_id::GameId,
    };
    use crate::domain::triggergame_simulator::models::turn::{
        turn_number::turn_number::TurnNumber, Turn,
    };
    use crate::domain::triggergame_simulator::repositories::{
        game_repository::GameRepository, turn_repository::TurnRepository,
    };

    struct InMemoryGameRepository {
        game: Game,
    }

    #[async_trait]
    impl GameRepository for InMemoryGameRepository {
        async fn save(&self, _game: &Game) -> Result<(), String> {
            Ok(())
        }

        async fn update(&self, _game: &Game) -> Result<(), String> {
            Ok(())
        }

        async fn get_game_by_id(&self, _game_id: &GameId) -> Result<Game, String> {
            Ok(self.game.clone())
        }
    }

    struct InMemoryTurnRepository {
        turns: Mutex<HashMap<(String, String, i32), Turn>>,
    }

    impl InMemoryTurnRepository {
        fn new() -> Self {
            Self {
                turns: Mutex::new(HashMap::new()),
            }
        }

        fn insert(&self, turn: Turn) {
            let key = (
                turn.game_id().value().to_string(),
                turn.player_id().value().to_string(),
                turn.turn_number().value(),
            );
            self.turns.lock().unwrap().insert(key, turn);
        }
    }

    #[async_trait]
    impl TurnRepository for InMemoryTurnRepository {
        async fn save(&self, turn: &Turn) -> Result<(), String> {
            let key = (
                turn.game_id().value().to_string(),
                turn.player_id().value().to_string(),
                turn.turn_number().value(),
            );
            self.turns.lock().unwrap().insert(key, turn.clone());
            Ok(())
        }

        async fn update(&self, turn: &Turn) -> Result<(), String> {
            self.save(turn).await
        }

        async fn get_turn_data(
            &self,
            game_id: &GameId,
            player_id: &PlayerId,
            turn_number: &TurnNumber,
        ) -> Result<Option<Turn>, String> {
            let key = (
                game_id.value().to_string(),
                player_id.value().to_string(),
                turn_number.value(),
            );
            Ok(self.turns.lock().unwrap().get(&key).cloned())
        }
    }

    #[tokio::test]
    async fn test_accept_submission_rejects_resubmission_for_same_turn() {
        // 仕様: 同一プレイヤーによる同一ターンの再提出は拒否する。
        let game_id = GameId::new("550e8400-e29b-41d4-a716-446655440100".to_string());
        let player1_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440101".to_string());
        let player2_id = PlayerId::new("550e8400-e29b-41d4-a716-446655440102".to_string());
        let game = Game::create(game_id.clone(), &player1_id, &player2_id);

        let game_repo = Arc::new(InMemoryGameRepository { game: game.clone() });
        let turn_repo = Arc::new(InMemoryTurnRepository::new());

        let existing_turn = Turn::create(
            game_id.clone(),
            player1_id.clone(),
            TurnNumber::new(game.current_turn_number().value()),
            chrono::Utc::now(),
        );
        turn_repo.insert(existing_turn);

        let service = TurnSubmissionService::new(game_repo, turn_repo);
        let result = service
            .accept_submission(
                game_id.value().to_string(),
                player1_id.value().to_string(),
                Vec::new(),
            )
            .await;

        assert!(result.is_err());
        let err = result.err().unwrap();
        assert_eq!(err, "このターンの情報はすでに登録されています。");
    }
}
