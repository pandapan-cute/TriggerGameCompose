use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;

use super::current_action_points::current_action_points::CurrentActionPoints;
use super::having_trigger_ids::having_trigger_ids::HavingTriggerIds;
use super::is_bailout::is_bailout::IsBailout;
use super::main_trigger_hp::main_trigger_hp::MainTriggerHP;
use super::position::position::Position;
use super::sight_range::sight_range::SightRange;
use super::sub_trigger_hp::sub_trigger_hp::SubTriggerHP;
use super::trigger_id::trigger_id::TriggerId;
use super::unit_id::unit_id::UnitId;
use super::unit_type_id::unit_type_id::UnitTypeId;
use super::wait_time::wait_time::WaitTime;
use serde::Serialize;
use uuid::Uuid;

/// Unit集約
/// ユニットを表すルートエンティティ
#[derive(Debug, Clone)]
pub struct Unit {
    unit_id: UnitId,
    unit_type_id: UnitTypeId,
    game_id: GameId,
    owner_player_id: PlayerId,
    current_action_points: CurrentActionPoints,
    wait_time: WaitTime,
    position: Position,
    using_main_trigger_id: TriggerId,
    using_sub_trigger_id: TriggerId,
    having_main_trigger_ids: HavingTriggerIds,
    having_sub_trigger_ids: HavingTriggerIds,
    main_trigger_hp: MainTriggerHP,
    sub_trigger_hp: SubTriggerHP,
    main_trigger_azimuth: TriggerAzimuth,
    sub_trigger_azimuth: TriggerAzimuth,
    sight_range: SightRange,
    is_bailout: IsBailout,
}

impl Unit {
    // privateなコンストラクタ
    #[allow(clippy::too_many_arguments)]
    fn new(
        unit_id: UnitId,
        unit_type_id: UnitTypeId,
        game_id: GameId,
        owner_player_id: PlayerId,
        current_action_points: CurrentActionPoints,
        wait_time: WaitTime,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        having_main_trigger_ids: HavingTriggerIds,
        having_sub_trigger_ids: HavingTriggerIds,
        main_trigger_hp: MainTriggerHP,
        sub_trigger_hp: SubTriggerHP,
        main_trigger_azimuth: TriggerAzimuth,
        sub_trigger_azimuth: TriggerAzimuth,
        sight_range: SightRange,
        is_bailout: IsBailout,
    ) -> Self {
        Self {
            unit_id,
            unit_type_id,
            game_id,
            owner_player_id,
            current_action_points,
            wait_time,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp,
            sub_trigger_hp,
            main_trigger_azimuth,
            sub_trigger_azimuth,
            sight_range,
            is_bailout,
        }
    }

    /// 新規ユニットの生成
    pub fn create(
        unit_type_id: UnitTypeId,
        game_id: GameId,
        owner_player_id: PlayerId,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        having_main_trigger_ids: HavingTriggerIds,
        having_sub_trigger_ids: HavingTriggerIds,
        initial_main_hp: i32,
        initial_sub_hp: i32,
        initial_sight_range: i32,
        initial_action_points: i32,
    ) -> Self {
        let unit_id = UnitId::new(Uuid::new_v4().to_string());
        let current_action_points = CurrentActionPoints::new(initial_action_points);
        let wait_time = WaitTime::new(0);
        let main_trigger_hp = MainTriggerHP::new(initial_main_hp);
        let sub_trigger_hp = SubTriggerHP::new(initial_sub_hp);
        let main_trigger_azimuth = TriggerAzimuth::new(0); // 初期値は0にしておく
        let sub_trigger_azimuth = TriggerAzimuth::new(0); // 初期値は0にしておく
        let sight_range = SightRange::new(initial_sight_range);
        let is_bailout = IsBailout::new(false);

        Self::new(
            unit_id,
            unit_type_id,
            game_id,
            owner_player_id,
            current_action_points,
            wait_time,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp,
            sub_trigger_hp,
            main_trigger_azimuth,
            sub_trigger_azimuth,
            sight_range,
            is_bailout,
        )
    }

    /// ユニットの再構築（リポジトリから取得時に使用）
    #[allow(clippy::too_many_arguments)]
    pub fn reconstruct(
        unit_id: UnitId,
        unit_type_id: UnitTypeId,
        game_id: GameId,
        owner_player_id: PlayerId,
        current_action_points: CurrentActionPoints,
        wait_time: WaitTime,
        position: Position,
        using_main_trigger_id: TriggerId,
        using_sub_trigger_id: TriggerId,
        having_main_trigger_ids: HavingTriggerIds,
        having_sub_trigger_ids: HavingTriggerIds,
        main_trigger_hp: MainTriggerHP,
        sub_trigger_hp: SubTriggerHP,
        sight_range: SightRange,
        is_bailout: IsBailout,
    ) -> Self {
        let main_trigger_azimuth = TriggerAzimuth::new(0); // 初期値は0にしておく
        let sub_trigger_azimuth = TriggerAzimuth::new(0); // 初期値は0にしておく
        Self::new(
            unit_id,
            unit_type_id,
            game_id,
            owner_player_id,
            current_action_points,
            wait_time,
            position,
            using_main_trigger_id,
            using_sub_trigger_id,
            having_main_trigger_ids,
            having_sub_trigger_ids,
            main_trigger_hp,
            sub_trigger_hp,
            main_trigger_azimuth,
            sub_trigger_azimuth,
            sight_range,
            is_bailout,
        )
    }

    /// ユニットを移動
    ///
    /// ひとまず同じマスにキャラがいるかはチェックしない
    ///
    /// 現在位置と同じ -> 移動しない  
    ///
    /// 現在位置と異なる -> 移動し、行動ポイントを1消費  
    ///
    /// ベイルアウト済みのユニットは移動できない  
    ///
    /// 行動ポイントが不足している場合は移動できない  
    pub fn move_to(&mut self, new_position: Position) -> bool {
        if self.is_bailout.is_bailout() {
            return false;
        }
        // 現在位置と同じなら移動しない
        if self.position == new_position {
            return false;
        }

        const ACTION_POINT_COST_PER_MOVE: i32 = 1; // 移動はアクションポイントを1消費する
        if self.current_action_points.value() < ACTION_POINT_COST_PER_MOVE {
            return false;
        }
        self.position = new_position;
        self.current_action_points = CurrentActionPoints::new(
            self.current_action_points.value() - ACTION_POINT_COST_PER_MOVE,
        );
        true
    }

    /// 使用するトリガーを設定
    ///
    /// アクションポイントが足りない場合は更新しないでスルー
    /// (トリガーが更新されてしまうと、行動できないのにトリガーだけ変更されてトリガーのHPの考えが面倒になるため)
    ///
    /// 所持トリガー外のトリガーIDが指定された場合はエラーを返す
    pub fn set_using_triggers(
        &mut self,
        main_trigger_id: &TriggerId,
        sub_trigger_id: &TriggerId,
    ) -> Result<(), String> {
        if !self.having_main_trigger_ids.contains(main_trigger_id) {
            return Err("指定されたメイントリガーIDは所持していません".to_string());
        }
        if !self.having_sub_trigger_ids.contains(sub_trigger_id) {
            return Err("指定されたサブトリガーIDは所持していません".to_string());
        }
        if self.current_action_points.value() > 0 {
            self.using_main_trigger_id = main_trigger_id.clone();
            self.using_sub_trigger_id = sub_trigger_id.clone();
        }
        Ok(())
    }

    /// メイントリガーでダメージを受ける
    pub fn take_main_trigger_damage(&mut self, damage: i32) -> Result<(), String> {
        if damage < 0 {
            return Err("ダメージは0以上である必要があります".to_string());
        }
        let new_hp = self.main_trigger_hp.value() - damage;
        self.main_trigger_hp = MainTriggerHP::new(new_hp.max(0));

        // HPが0になったら自動ベイルアウト
        if self.main_trigger_hp.value() == 0 {
            self.bailout();
        }
        Ok(())
    }

    /// サブトリガーでダメージを受ける
    pub fn take_sub_trigger_damage(&mut self, damage: i32) -> Result<(), String> {
        if damage < 0 {
            return Err("ダメージは0以上である必要があります".to_string());
        }
        let new_hp = self.sub_trigger_hp.value() - damage;
        self.sub_trigger_hp = SubTriggerHP::new(new_hp.max(0));
        Ok(())
    }

    /// メイントリガーを回復
    pub fn heal_main_trigger(&mut self, amount: i32) -> Result<(), String> {
        if amount < 0 {
            return Err("回復量は0以上である必要があります".to_string());
        }
        let new_hp = self.main_trigger_hp.value() + amount;
        self.main_trigger_hp = MainTriggerHP::new(new_hp);
        Ok(())
    }

    /// サブトリガーを回復
    pub fn heal_sub_trigger(&mut self, amount: i32) -> Result<(), String> {
        if amount < 0 {
            return Err("回復量は0以上である必要があります".to_string());
        }
        let new_hp = self.sub_trigger_hp.value() + amount;
        self.sub_trigger_hp = SubTriggerHP::new(new_hp);
        Ok(())
    }

    /// 行動ポイントを消費
    pub fn consume_action_points(&mut self, amount: i32) -> Result<(), String> {
        if amount < 0 {
            return Err("消費量は0以上である必要があります".to_string());
        }
        if self.current_action_points.value() < amount {
            return Err("行動ポイントが不足しています".to_string());
        }
        self.current_action_points =
            CurrentActionPoints::new(self.current_action_points.value() - amount);
        Ok(())
    }

    /// 行動ポイントを回復
    pub fn restore_action_points(&mut self, amount: i32) -> Result<(), String> {
        if amount < 0 {
            return Err("回復量は0以上である必要があります".to_string());
        }
        let new_points = self.current_action_points.value() + amount;
        self.current_action_points = CurrentActionPoints::new(new_points);
        Ok(())
    }

    /// ウェイトタイムを設定
    pub fn set_wait_time(&mut self, wait_time: WaitTime) {
        self.wait_time = wait_time;
    }

    /// メイントリガーを装備
    pub fn equip_main_trigger(&mut self, trigger_id: TriggerId) {
        self.using_main_trigger_id = trigger_id;
    }

    /// サブトリガーを装備
    pub fn equip_sub_trigger(&mut self, trigger_id: TriggerId) {
        self.using_sub_trigger_id = trigger_id;
    }

    pub fn set_main_trigger_azimuth(&mut self, azimuth: TriggerAzimuth) {
        self.main_trigger_azimuth = azimuth;
    }

    pub fn set_sub_trigger_azimuth(&mut self, azimuth: TriggerAzimuth) {
        self.sub_trigger_azimuth = azimuth;
    }

    /// ベイルアウト
    pub fn bailout(&mut self) {
        self.is_bailout = IsBailout::new(true);
    }

    /// ベイルアウト状態から復帰
    pub fn revive(&mut self) {
        self.is_bailout = IsBailout::new(false);
    }

    /// ユニットがアクティブかどうか
    pub fn is_active(&self) -> bool {
        self.is_bailout.is_active()
    }

    /// ユニットがベイルアウト済みかどうか
    pub fn is_bailed_out(&self) -> bool {
        self.is_bailout.is_bailout()
    }

    // ゲッター
    pub fn unit_id(&self) -> &UnitId {
        &self.unit_id
    }

    pub fn unit_type_id(&self) -> &UnitTypeId {
        &self.unit_type_id
    }

    pub fn game_id(&self) -> &GameId {
        &self.game_id
    }

    pub fn owner_player_id(&self) -> &PlayerId {
        &self.owner_player_id
    }

    pub fn current_action_points(&self) -> &CurrentActionPoints {
        &self.current_action_points
    }

    pub fn wait_time(&self) -> &WaitTime {
        &self.wait_time
    }

    pub fn position(&self) -> &Position {
        &self.position
    }

    pub fn using_main_trigger_id(&self) -> &TriggerId {
        &self.using_main_trigger_id
    }

    pub fn using_sub_trigger_id(&self) -> &TriggerId {
        &self.using_sub_trigger_id
    }

    pub fn having_main_trigger_ids(&self) -> &HavingTriggerIds {
        &self.having_main_trigger_ids
    }

    pub fn having_sub_trigger_ids(&self) -> &HavingTriggerIds {
        &self.having_sub_trigger_ids
    }

    pub fn main_trigger_hp(&self) -> &MainTriggerHP {
        &self.main_trigger_hp
    }

    pub fn main_trigger_azimuth(&self) -> &TriggerAzimuth {
        &self.main_trigger_azimuth
    }

    pub fn sub_trigger_azimuth(&self) -> &TriggerAzimuth {
        &self.sub_trigger_azimuth
    }

    pub fn sub_trigger_hp(&self) -> &SubTriggerHP {
        &self.sub_trigger_hp
    }

    pub fn sight_range(&self) -> &SightRange {
        &self.sight_range
    }

    pub fn is_bailout_value(&self) -> &IsBailout {
        &self.is_bailout
    }
}

impl PartialEq for Unit {
    fn eq(&self, other: &Self) -> bool {
        self.unit_id == other.unit_id
    }
}

impl Eq for Unit {}
