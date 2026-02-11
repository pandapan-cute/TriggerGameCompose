pub mod current_action_points;
pub mod having_trigger_ids;
pub mod is_bailout;
pub mod main_trigger_hp;
pub mod position;
pub mod sight_range;
pub mod sub_trigger_hp;
pub mod trigger_id;
pub mod unit_id;
pub mod unit_type_id;
pub mod wait_time;

mod unit;
pub use unit::Unit;

#[cfg(test)]
mod unit_test;
