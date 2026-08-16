use crate::application::game;
use crate::domain::triggergame_simulator::configs::game_config::GameConfig;
use crate::domain::triggergame_simulator::models::action::action::Action;
use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
    ActionType, ActionTypeValue,
};
use crate::domain::triggergame_simulator::models::game::game_state::{GameState, GameStateValue};
use crate::domain::triggergame_simulator::models::game::game_type::{self, GameType};
use crate::domain::triggergame_simulator::models::game::motion_lab_end_time;
use crate::domain::triggergame_simulator::models::game::visibility::Visibility;
use crate::domain::triggergame_simulator::models::step::step::Step;
use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
use crate::domain::triggergame_simulator::models::turn::Turn;
use crate::domain::unit_management::models::unit::unit_id::unit_id::UnitId;
use crate::domain::unit_management::models::unit::Unit;
use crate::domain::{
    player_management::models::player::player_id::player_id::PlayerId,
    triggergame_simulator::models::game::motion_lab_end_time::MotionLabEndTime,
};

use super::game_id::game_id::GameId;
use chrono::{DateTime, Utc};
use pyo3::prelude::*;
use std::collections::{HashMap, HashSet, VecDeque};
use uuid::Uuid;
/// Game集約
/// ゲーム全体を管理するルートエンティティ
#[pyclass]
#[derive(Debug, Clone)]
pub struct Game {
    #[pyo3(get)]
    game_id: GameId,
    #[pyo3(get)]
    game_state: GameState,
    /// ゲームの種類（PvP or PvE）
    game_type: GameType,
    #[pyo3(get)]
    current_turn_number: TurnNumber,
    motion_lab_end_time: MotionLabEndTime,
    #[pyo3(get)]
    player1_id: PlayerId,
    #[pyo3(get)]
    player2_id: PlayerId,
    visibility: Visibility,
}

impl Game {
    const MAX_TURNS: i32 = 6;

    // privateなコンストラクタ
    pub fn new(
        game_id: GameId,
        game_state: GameState,
        game_type: GameType,
        current_turn_number: TurnNumber,
        motion_lab_end_time: MotionLabEndTime,
        player1_id: PlayerId,
        player2_id: PlayerId,
    ) -> Self {
        let visibility = Visibility::create();
        Self {
            game_id,
            game_state,
            game_type,
            current_turn_number,
            player1_id,
            player2_id,
            visibility,
            motion_lab_end_time,
        }
    }

    /// 新規ゲームの生成 (デフォルトはPvP)
    pub fn create(game_id: GameId, player1_id: &PlayerId, player2_id: &PlayerId) -> Self {
        let game_state = GameState::initial();
        let current_turn_number = TurnNumber::initial();
        let motion_lab_end_time = MotionLabEndTime::initial();
        Self::new(
            game_id,
            game_state,
            GameType::initial(), // PvP用の初期化
            current_turn_number,
            motion_lab_end_time,
            player1_id.clone(),
            player2_id.clone(),
        )
    }

    /// 新規ゲームの生成（PvE用）
    pub fn create_pve(game_id: GameId, player1_id: &PlayerId, player2_id: &PlayerId) -> Self {
        let game_state = GameState::initial();
        let current_turn_number = TurnNumber::initial();
        let motion_lab_end_time = MotionLabEndTime::initial();
        Self::new(
            game_id,
            game_state,
            GameType::initial_pve(), // PvE用の初期化
            current_turn_number,
            motion_lab_end_time,
            player1_id.clone(),
            player2_id.clone(),
        )
    }

    /// ゲームの再構築（リポジトリから取得時に使用）
    pub fn reconstruct(
        game_id: GameId,
        game_state: GameState,
        game_type: GameType,
        current_turn_number: TurnNumber,
        motion_lab_end_time: MotionLabEndTime,
        player1_id: PlayerId,
        player2_id: PlayerId,
        visibility: Visibility,
    ) -> Self {
        Self {
            game_id,
            game_state,
            game_type,
            current_turn_number,
            motion_lab_end_time,
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

        // ユニットごとの未消費アクション列を作成する。
        // 以降のステップでは、このキューの先頭を現在状態に対して実行可能か判定し、
        // 移動できたときだけ消費する。
        let mut pending_actions_by_unit =
            self.build_pending_action_queues(player1_turn, player2_turn);

        let mut player1_result_steps = Vec::new();
        let mut player2_result_steps = Vec::new();

        // 各ステップの戦闘演算を開始
        for idx in 0..GameConfig::get_game_config().motion_execute_seconds() as usize {
            let player1_step = player1_turn.steps().get(idx);
            let player2_step = player2_turn.steps().get(idx);

            // stepをマージして、両プレイヤーの行動を反映させたステップを作成
            // stepのactionは、pending_actions_by_unitの先頭を参照して、実行可能なものだけを反映させる。(step_start内で実行)
            let mut merge_step = Step::new(
                StepId::new(Uuid::new_v4().to_string()),
                Vec::new(),
                Vec::new(),
            );

            // merge_stepの戦闘演算を開始
            merge_step.step_start(&mut pending_actions_by_unit, units, &mut self.visibility)?;

            // プレイヤーごとに見せるべき情報をフィルタリングして、player1_result_stepsとplayer2_result_stepsに追加する
            let mut p1_step = merge_step.clone();
            let mut p2_step = merge_step;

            let player1_step =
                p1_step.to_player_step(player1_turn.player_id(), units, &self.visibility);
            let player2_step =
                p2_step.to_player_step(player2_turn.player_id(), units, &self.visibility);

            player1_result_steps.push(player1_step);
            player2_result_steps.push(player2_step);

            if self.is_any_player_units_destroyed(units) {
                // どちらかのプレイヤーのユニットが全滅している場合は、残りのステップはスキップする
                break;
            }
        }

        player1_turn.set_steps(player1_result_steps);
        player2_turn.set_steps(player2_result_steps);

        Ok(())
    }

    /// ターン開始時点の step 群から、ユニットごとの未消費アクション列を作成する。
    fn build_pending_action_queues(
        &self,
        player1_turn: &Turn,
        player2_turn: &Turn,
    ) -> HashMap<UnitId, VecDeque<Action>> {
        let mut pending_actions_by_unit = HashMap::new();

        for step in player1_turn.steps() {
            Self::enqueue_actions_by_unit(&mut pending_actions_by_unit, step.actions());
        }
        for step in player2_turn.steps() {
            Self::enqueue_actions_by_unit(&mut pending_actions_by_unit, step.actions());
        }

        pending_actions_by_unit
    }

    /// action をユニットごとのキューに積む。
    fn enqueue_actions_by_unit(
        pending_actions_by_unit: &mut HashMap<UnitId, VecDeque<Action>>,
        actions: &Vec<Action>,
    ) {
        for action in actions {
            pending_actions_by_unit
                .entry(action.unit_id().clone())
                .or_insert_with(VecDeque::new)
                .push_back(action.clone());
        }
    }

    /// 次のターンへ進める
    pub fn advance_to_next_turn(&mut self) -> Result<(), String> {
        if self.is_game_finished() {
            // ゲーム終了処理
            self.complete_game_state();
            return Ok(());
        }

        let next_turn_value = self.current_turn_number.value() + 1;
        self.current_turn_number = TurnNumber::new(next_turn_value);
        Ok(())
    }

    /// ゲームが終了しているかどうか（最終ターンに達しているか）
    pub fn is_game_finished(&self) -> bool {
        self.current_turn_number.value() >= Self::MAX_TURNS
    }

    /// どちらかのプレイヤーのユニットが全滅しているか
    pub fn is_any_player_units_destroyed(&self, units: &Vec<Unit>) -> bool {
        let player1_units = units
            .iter()
            .filter(|u| u.owner_player_id() == self.player1_id())
            .collect::<Vec<&Unit>>();
        let player2_units = units
            .iter()
            .filter(|u| u.owner_player_id() == self.player2_id())
            .collect::<Vec<&Unit>>();

        player1_units.iter().all(|u| u.is_bailed_out())
            || player2_units.iter().all(|u| u.is_bailed_out())
    }

    // ゲッター
    pub fn game_id(&self) -> &GameId {
        &self.game_id
    }

    pub fn game_state(&self) -> &GameState {
        &self.game_state
    }

    pub fn game_type(&self) -> &GameType {
        &self.game_type
    }

    pub fn current_turn_number(&self) -> &TurnNumber {
        &self.current_turn_number
    }

    pub fn motion_lab_end_time(&self) -> &MotionLabEndTime {
        &self.motion_lab_end_time
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

    pub fn complete_game_state(&mut self) {
        self.game_state.set_completed();
    }
}

impl PartialEq for Game {
    fn eq(&self, other: &Self) -> bool {
        self.game_id == other.game_id
    }
}

impl Eq for Game {}
