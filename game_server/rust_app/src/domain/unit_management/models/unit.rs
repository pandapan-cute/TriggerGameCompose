pub mod unit_id;
pub mod unit_type_id;
pub mod owner_player_id;
pub mod current_action_points;
pub mod wait_time;
pub mod position;
pub mod using_main_trigger_id;
pub mod using_sub_trigger_id;
pub mod having_main_trigger_ids;
pub mod having_sub_trigger_ids;
pub mod main_trigger_hp;
pub mod sub_trigger_hp;
pub mod sight_range;
pub mod is_bailout;

mod unit;
pub use unit::Unit;

#[cfg(test)]
mod unit_test;
