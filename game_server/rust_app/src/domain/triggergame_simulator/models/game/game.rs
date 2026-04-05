use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::triggergame_simulator::models::turn::Turn;
use crate::domain::unit_management::models::unit::Unit;

use super::current_turn_number::current_turn_number::CurrentTurnNumber;
use super::game_id::game_id::GameId;
use itertools::Itertools;
use uuid::Uuid;

/// Game集約
/// ゲーム全体を管理するルートエンティティ
#[derive(Debug, Clone)]
pub struct Game {
    game_id: GameId,
    current_turn_number: CurrentTurnNumber,
    player1_id: PlayerId,
    player2_id: PlayerId,
    visibility: Visibility,
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
        let visibility = Visibility::create();
        Self {
            game_id,
            current_turn_number,
            player1_id,
            player2_id,
            visibility,
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
        visibility: Visibility,
    ) -> Self {
        Self {
            game_id,
            current_turn_number,
            player1_id,
            player2_id,
            visibility,
        }
    }

    /// ターンの戦闘処理を開始
    pub fn turn_start(
        &mut self,
        player1_turn: &mut Turn,
        player2_turn: &mut Turn,
        units: &mut Vec<Unit>,
    ) -> Result<(), String> {
        print!(
            "ターン開始: プレイヤー1[{:?}],  プレイヤー2[{:?}], {:?}ターン目が開始されました",
            self.player1_id, self.player2_id, self.current_turn_number
        );
        // ユニット行動モードに移行
        player1_turn.start_unit_stepping()?;
        player2_turn.start_unit_stepping()?;

        // ターン開始時にユニットの行動ポイントをリセット
        units.iter_mut().for_each(|u| u.reset_action_points());

        let mut player1_result_steps = Vec::new();
        let mut player2_result_steps = Vec::new();

        // 各ステップの戦闘演算を開始
        for step in player1_turn
            .steps()
            .iter()
            .zip_longest(player2_turn.steps().iter())
        {
            // stepをマージして、両プレイヤーの行動を反映させたステップを作成
            let mut merge_step = Step::new(
                StepId::new(Uuid::new_v4().to_string()),
                Vec::new(),
                Vec::new(),
                Vec::new(),
            );
            match step {
                itertools::EitherOrBoth::Both(step1, step2) => {
                    merge_step.push_actions(step1.actions());
                    merge_step.push_actions(step2.actions());
                }
                itertools::EitherOrBoth::Left(step1) => merge_step.push_actions(step1.actions()),
                itertools::EitherOrBoth::Right(step2) => merge_step.push_actions(step2.actions()),
            }
            // merge_stepの戦闘演算を開始
            merge_step.step_start(units, &mut self.visibility)?;

            // プレイヤーごとに見せるべき情報をフィルタリングして、player1_result_stepsとplayer2_result_stepsに追加する
            let mut p1_step = merge_step.clone();
            let mut p2_step = merge_step;

            let player1_step =
                p1_step.to_player_step(player1_turn.player_id(), units, &self.visibility);
            let player2_step =
                p2_step.to_player_step(player2_turn.player_id(), units, &self.visibility);

            player1_result_steps.push(player1_step);
            player2_result_steps.push(player2_step);
        }

        player1_turn.set_steps(player1_result_steps);
        player2_turn.set_steps(player2_result_steps);

        Ok(())
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
        self.current_turn_number.value() > Self::MAX_TURNS
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

    pub fn visibility(&self) -> &Visibility {
        &self.visibility
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
