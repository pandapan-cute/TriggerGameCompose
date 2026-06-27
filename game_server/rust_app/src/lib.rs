pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;

use std::thread::current;

// Python側に公開したいラッパークラス（構造体）の例
// ※ domain や application にある実際のゲームロジックを呼び出す役目を持たせます
use pyo3::prelude::*;
use uuid::Uuid;

use crate::domain::{
    player_management::models::player::player_id::player_id::PlayerId,
    triggergame_simulator::models::{
        action::{
            self,
            action_type::action_type::{ActionType, ActionTypeValue},
            trigger_azimuth::trigger_azimuth::TriggerAzimuth,
            Action,
        },
        game::{
            game::Game,
            game_id::{self, game_id::GameId},
            game_state::GameState,
            motion_lab_end_time::MotionLabEndTime,
        },
        step::{step::Step, step_id::step_id::StepId},
        turn::{
            turn_id::turn_id::TurnId,
            turn_number::turn_number::TurnNumber,
            turn_start_datetime::turn_start_datetime::TurnStartDatetime,
            turn_status::turn_status::{TurnStatus, TurnStatusValue},
            Turn,
        },
    },
    unit_management::models::unit::{
        current_action_points::current_action_points::CurrentActionPoints,
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_id::unit_id::UnitId,
        unit_type_id::unit_type_id::UnitTypeId, Unit,
    },
};

/// Python側に公開するActionのDTO
#[pyclass]
#[derive(Debug, Clone)]
pub struct ActionDto {
    #[pyo3(get)]
    pub action_type: String,
    #[pyo3(get)]
    pub unit_id: String,
    #[pyo3(get)]
    pub unit_type_id: String,
    #[pyo3(get)]
    pub col: i32,
    #[pyo3(get)]
    pub row: i32,
    #[pyo3(get)]
    pub using_main_trigger_id: String,
    #[pyo3(get)]
    pub using_sub_trigger_id: String,
    #[pyo3(get)]
    pub main_trigger_azimuth: i32,
    #[pyo3(get)]
    pub sub_trigger_azimuth: i32,
}

#[pymethods]
impl ActionDto {
    #[new]
    fn new(
        action_type: String,
        unit_id: String,
        unit_type_id: String,
        col: i32,
        row: i32,
        using_main_trigger_id: String,
        using_sub_trigger_id: String,
        main_trigger_azimuth: i32,
        sub_trigger_azimuth: i32,
    ) -> Self {
        ActionDto {
            action_type,
            unit_id,
            unit_type_id,
            col,
            row,
            using_main_trigger_id,
            using_sub_trigger_id,
            main_trigger_azimuth,
            sub_trigger_azimuth,
        }
    }
}

#[pyclass]
#[derive(Clone)]
pub struct WtEnv {
    #[pyo3(get)]
    pub steps: Vec<Step>, // ステップの予約リスト
    #[pyo3(get)]
    pub action_queue: Vec<Action>, // アクションの予約リスト
    #[pyo3(get)]
    pub units: Vec<Unit>, // 敵味方ユニット情報
    #[pyo3(get)]
    pub current_unit_idx: usize, // 現在のユニットのインデックス
    #[pyo3(get)]
    pub current_step_idx: usize, // 現在のステップのインデックス

    #[pyo3(get)]
    pub game: Game, // ゲームの情報
    #[pyo3(get)]
    pub my_player_id: PlayerId, // 自分のプレイヤーID
    #[pyo3(get)]
    pub enemy_player_id: PlayerId, // 敵プレイヤーのID
    #[pyo3(get)]
    pub turn_id: TurnId, // ターンのID
    #[pyo3(get)]
    pub turn_number: TurnNumber, // ターン番号
}

#[pymethods]
impl WtEnv {
    #[new]
    fn new() -> Self {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let my_player_id = PlayerId::new(Uuid::new_v4().to_string());
        let enemy_player_id = PlayerId::new(Uuid::new_v4().to_string());
        let mut units = create_test_units(&game_id, &my_player_id);
        units.extend(create_test_units(&game_id, &enemy_player_id));
        WtEnv {
            steps: Vec::new(),
            action_queue: Vec::new(),
            units,
            current_unit_idx: 0,
            current_step_idx: 0,
            game: create_test_game(&game_id, &my_player_id, &enemy_player_id),
            my_player_id: my_player_id,
            enemy_player_id: enemy_player_id,
            turn_id: TurnId::new(Uuid::new_v4().to_string()),
            turn_number: TurnNumber::new(1),
        }
    }

    // 1. 初期化
    fn reset(&mut self) {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let mut units = create_test_units(&game_id, &self.my_player_id);
        units.extend(create_test_units(&game_id, &self.enemy_player_id));
        self.steps.clear();
        self.action_queue.clear();
        self.units = units;
        self.current_unit_idx = 0;
        self.current_step_idx = 0;
        self.game = create_test_game(&game_id, &self.my_player_id, &self.enemy_player_id);
        self.turn_id = TurnId::new(Uuid::new_v4().to_string());
        self.turn_number = TurnNumber::new(1);
    }

    // 2. AIが行動を「予約」する関数（作戦点を消費）
    fn queue_action(&mut self, action_dto: ActionDto) -> bool {
        let action = Action::create(
            ActionType::new_string(action_dto.action_type),
            UnitId::new(action_dto.unit_id.clone()),
            UnitTypeId::new(action_dto.unit_type_id.clone()),
            Position::new(action_dto.col, action_dto.row),
            TriggerId::new(action_dto.using_main_trigger_id.clone()),
            TriggerId::new(action_dto.using_sub_trigger_id.clone()),
            TriggerAzimuth::new(action_dto.main_trigger_azimuth),
            TriggerAzimuth::new(action_dto.sub_trigger_azimuth),
            CurrentActionPoints::new(10), // 予約時点では消費アクションポイントは0
        );
        if self.steps.len() >= 15 {
            print!("最大ステップ数を超えたため、アクション予約不可です。");
            return false; // 最大ステップ数を超えたら予約不可
        }
        // 1. 今フォーカスしている味方ユニットを取得
        // friend のユニット位置（Vec 内のインデックス）を先に集める（不変走査）
        let friend_indices: Vec<usize> = self
            .units
            .iter()
            .enumerate()
            .filter(|(_, u)| u.owner_player_id() == &self.my_player_id)
            .map(|(i, _)| i)
            .collect();

        // 安全のため bounds チェック
        let friendly_count = friend_indices.len();
        if self.current_unit_idx >= friendly_count {
            print!("現在のユニットインデックスが範囲外です。");
            return false; // 範囲外のインデックスは予約不可
        }

        let unit_idx = friend_indices[self.current_unit_idx];
        // ここで不変借用は終わっているので、可変参照を取れる
        let current_unit: &mut Unit = &mut self.units[unit_idx];

        // 2. アクションが現在のユニットの位置から移動できる位置にあるか確認
        if current_unit
            .position()
            .col()
            .abs_diff(action.position().col())
            > 1
            || current_unit
                .position()
                .row()
                .abs_diff(action.position().row())
                > 1
        {
            print!("アクションの移動先が1マス以上離れているため、予約不可です。");
            return false; // １マス以上離れた位置への移動は不可
        }

        // 3. アクションの移動位置が盤外でないか確認
        if action.position().col() < 0
            || action.position().col() > 35
            || action.position().row() < 0
            || action.position().row() > 35
        {
            print!(
                "アクションの移動先が盤外のため、予約不可です。col={} row={}",
                action.position().col(),
                action.position().row()
            );
            return false; // 盤外への移動は不可
        }

        // 5. ユニットの位置を更新
        current_unit.set_position(action.position().clone());

        // 4. アクションを予約
        self.action_queue.push(action);

        // 💡 4. ここがポイント：ユニットの行動が「確定」したかどうかの判定
        // 例：「1アクション設定したら次のユニットへ」とする場合：
        self.current_unit_idx += 1;

        if self.current_unit_idx >= friend_indices.len() {
            let step_id = Uuid::new_v4().to_string();
            self.steps.push(Step::create(
                StepId::new(step_id),
                self.action_queue.clone(),
                Vec::new(),
            ));
            self.action_queue.clear(); // 予約リストをクリア
            self.current_unit_idx = 0; // 全ユニットの行動が予約されたら、次のターンへ
        }
        true // 予約成功！
    }

    // 3. 15秒の一斉行動フェーズ（予約された行動をまとめて実行）
    // 戻り値: (units, 報酬, ゲーム終了フラグ)
    fn resolve_turn(&mut self) -> (Vec<Unit>, f32, bool) {
        eprintln!(
            "DEBUG: about to execute friend_turn with {} steps",
            self.steps.len()
        );
        for (si, s) in self.steps.iter().enumerate() {
            eprintln!(" Step {}", si);
            for (ai, a) in s.actions().iter().enumerate() {
                eprintln!(
                    "  action {} unit={} pos=({}, {}) azimuth=({}, {})",
                    ai,
                    a.unit_id().value(),
                    a.position().col(),
                    a.position().row(),
                    a.main_trigger_azimuth().value(),
                    a.sub_trigger_azimuth().value()
                );
            }
        }
        // 味方側のTurnを作成
        let mut friend_turn = Turn::new(
            self.turn_id.clone(),
            self.game.game_id().clone(),
            self.game.player1_id().clone(),
            self.turn_number.clone(),
            TurnStartDatetime::new(chrono::Utc::now()),
            TurnStatus::new(TurnStatusValue::StepSetting),
            self.steps.clone(),
        );

        // 敵側のステップを作成（まずは固定の行動を4x15設定）
        let mut steps: Vec<Step> = Vec::new();

        for i in 0..15 {
            // step生成のループ
            let mut actions: Vec<Action> = Vec::new();
            for i in 0..4 {
                // 4体分のAction生成のループ
                let action_unit = self
                    .units
                    .iter()
                    .filter(|u| u.owner_player_id() == &self.enemy_player_id)
                    .collect::<Vec<&Unit>>()[i];
                let action = Action::create(
                    ActionType::new(ActionTypeValue::Wait),
                    action_unit.unit_id().clone(),
                    action_unit.unit_type_id().clone(),
                    action_unit.position().clone(),
                    action_unit.using_main_trigger_id().clone(),
                    action_unit.using_sub_trigger_id().clone(),
                    TriggerAzimuth::new(0),
                    TriggerAzimuth::new(0),
                    CurrentActionPoints::new(0),
                );
                actions.push(action);
            }
            steps.push(Step::create(
                StepId::new(Uuid::new_v4().to_string()),
                actions,
                Vec::new(),
            ));
        }

        let mut enemy_turn = Turn::new(
            self.turn_id.clone(),
            self.game.game_id().clone(),
            self.enemy_player_id.clone(),
            self.turn_number.clone(),
            TurnStartDatetime::new(chrono::Utc::now()),
            TurnStatus::new(TurnStatusValue::StepSetting),
            steps,
        );

        let _ = self
            .game
            .turn_start(&mut friend_turn, &mut enemy_turn, &mut self.units);

        // 報酬（Reward）の計算
        let mut reward = -0.1; // ターン経過のペナルティ
        let mut done = false;

        // 敵を撃墜したら報酬を加算
        for unit in self
            .units
            .iter()
            .filter(|u| u.owner_player_id() == &self.enemy_player_id)
            .collect::<Vec<&Unit>>()
        {
            if unit.is_bailed_out() {
                reward += 100.0; // 敵撃墜報酬
            }
        }

        // 味方ユニットを取得
        let friend_units = self
            .units
            .iter()
            .filter(|u| u.owner_player_id() == &self.my_player_id)
            .collect::<Vec<&Unit>>();

        // 味方が撃墜されたら報酬を減算
        for unit in &friend_units {
            if unit.is_bailed_out() {
                reward -= 1.0; // 味方撃墜ペナルティ
            }
        }

        // 生存している敵ユニットだけをリストアップ
        let alive_enemy_units = self
            .units
            .iter()
            .filter(|u| u.owner_player_id() == &self.enemy_player_id && !u.is_bailed_out())
            .collect::<Vec<&Unit>>();

        // 敵が全滅していない場合のみ距離チェックを行う
        if !alive_enemy_units.is_empty() {
            for friend in &friend_units {
                // すでにベイルアウトしている味方は除外
                if friend.is_bailed_out() {
                    continue;
                }

                // 1. 移動前の味方の座標（定義は環境に合わせて変更してください）
                let first_step = self.steps.first().unwrap();
                let action_for_friend = first_step
                    .actions()
                    .iter()
                    .find(|a| a.unit_id() == friend.unit_id())
                    .unwrap();
                let prev_friend_pos = action_for_friend.position().clone();

                // 2. 移動「前」の、一番近い敵との最小距離を計算
                let mut min_prev_dist = f32::MAX;
                for enemy in &alive_enemy_units {
                    let dx = prev_friend_pos.get_pixel_position().0 as f32
                        - enemy.position().get_enemy_pixel_position().0 as f32;
                    let dy = prev_friend_pos.get_pixel_position().1 as f32
                        - enemy.position().get_enemy_pixel_position().1 as f32;
                    let dist = (dx * dx + dy * dy).sqrt();
                    if dist < min_prev_dist {
                        min_prev_dist = dist;
                    }
                }

                let final_step = self.steps.last().unwrap();
                let final_action_for_friend = final_step
                    .actions()
                    .iter()
                    .find(|a| a.unit_id() == friend.unit_id())
                    .unwrap();
                let final_friend_pos = final_action_for_friend.position().clone();

                // 3. 移動「後」（現在）の、一番近い敵との最小距離を計算
                let mut min_current_dist = f32::MAX;
                for enemy in &alive_enemy_units {
                    // あなたの環境の距離計算ロジック（または簡易的にマンハッタン距離など）を当てはめてください
                    let dx = final_friend_pos.get_pixel_position().0 as f32
                        - enemy.position().get_enemy_pixel_position().0 as f32;
                    let dy = final_friend_pos.get_pixel_position().1 as f32
                        - enemy.position().get_enemy_pixel_position().1 as f32;
                    let dist = (dx * dx + dy * dy).sqrt();
                    if dist < min_current_dist {
                        min_current_dist = dist;
                    }
                }

                // 4. 判定：一番近い敵との距離が縮まっていれば報酬を与える
                if min_current_dist < min_prev_dist {
                    reward += 1.0; // 一番近い敵に接近したボーナス
                }
            }
        }

        // ゲームが終了しているかどうか（最終ターンに達しているか）
        if self.turn_number.value() >= 6 {
            done = true;
        } else {
            // ターン番号を更新
            self.turn_number = TurnNumber::new(self.turn_number.value() + 1);
            let _ = self.game.advance_to_next_turn();
        }

        // どちらかのプレイヤーのユニットが全滅している場合もゲーム終了
        if self.game.is_any_player_units_destroyed(&self.units) {
            done = true;
        }

        // ターンIDを更新
        self.turn_id = TurnId::new(Uuid::new_v4().to_string());

        // ステップをクリア
        self.steps.clear();
        self.current_unit_idx = 0;

        (self.units.clone(), reward, done)
    }
}

/// テスト用のゲームを作成する関数
/// # Arguments
/// * `game_id` - ゲームのID
/// * `my_player_id` - 自分のプレイヤーID
/// * `enemy_player_id` - 敵のプレイヤーID
/// # Returns
/// * `Game` - 作成されたゲームのインスタンス
fn create_test_game(game_id: &GameId, my_player_id: &PlayerId, enemy_player_id: &PlayerId) -> Game {
    let game = Game::new(
        game_id.clone(),
        GameState::initial(),
        TurnNumber::new(1),
        MotionLabEndTime::new(chrono::Utc::now()),
        my_player_id.clone(),
        enemy_player_id.clone(),
    );
    game
}

/// テスト用の敵ユニットを作成する関数
/// # Arguments
/// * `game_id` - ゲームのID
/// * `player_id` - プレイヤーのID
/// # Returns
/// * `Vec<Unit>` - 作成されたユニットのベクター
fn create_test_units(game_id: &GameId, player_id: &PlayerId) -> Vec<Unit> {
    let mut units: Vec<Unit> = Vec::new();

    let mikumo_osamu = Unit::create(
        UnitTypeId::new("MIKUMO_OSAMU".to_string()),
        game_id.clone(),
        player_id.clone(),
        Position::new(4, 34),
        TriggerId::new("RAYGUST".to_string()),
        TriggerId::new("ASTEROID".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("RAYGUST".to_string()),
            TriggerId::new("THRUSTER".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerId::new("BAGWORM".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("ASTEROID".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerId::new("SPIDER".to_string()),
        ]),
        100,
        100,
        8,
        13,
    );
    units.push(mikumo_osamu);

    let kuga_yuma = Unit::create(
        UnitTypeId::new("KUGA_YUMA".to_string()),
        game_id.clone(),
        player_id.clone(),
        Position::new(12, 34),
        TriggerId::new("SCORPION".to_string()),
        TriggerId::new("SHIELD".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("SCORPION".to_string()),
            TriggerId::new("THRUSTER".to_string()),
            TriggerId::new("GRASSHOPPER".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("SCORPION".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerId::new("GRASSHOPPER".to_string()),
            TriggerId::new("BAGWORM".to_string()),
        ]),
        100,
        100,
        8,
        16,
    );
    units.push(kuga_yuma);

    let amatori_chika = Unit::create(
        UnitTypeId::new("AMATORI_CHIKA".to_string()),
        game_id.clone(),
        player_id.clone(),
        Position::new(20, 34),
        TriggerId::new("IBIS".to_string()),
        TriggerId::new("BAGWORM".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("IBIS".to_string()),
            TriggerId::new("LIGHTNING".to_string()),
            TriggerId::new("HOUND".to_string()),
            TriggerId::new("SHIELD".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("REDBULLET".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerId::new("BAGWORM".to_string()),
        ]),
        100,
        100,
        8,
        12,
    );
    units.push(amatori_chika);

    let hyuse_kuronin = Unit::create(
        UnitTypeId::new("HYUSE_KURONIN".to_string()),
        game_id.clone(),
        player_id.clone(),
        Position::new(28, 34),
        TriggerId::new("KOGETSU".to_string()),
        TriggerId::new("SHIELD".to_string()),
        HavingTriggerIds::new(vec![
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SENKU".to_string()),
            TriggerId::new("SHIELD".to_string()),
        ]),
        HavingTriggerIds::new(vec![
            TriggerId::new("VIPER".to_string()),
            TriggerId::new("ESCUDE".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerId::new("BAGWORM".to_string()),
        ]),
        100,
        100,
        8,
        15,
    );
    units.push(hyuse_kuronin);

    units
}

// Pythonモジュールとして登録
#[pymodule]
fn wt_env(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<WtEnv>()?;
    m.add_class::<ActionDto>()?;
    Ok(())
}
