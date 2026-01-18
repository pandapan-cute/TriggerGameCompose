pub mod combat_id;
pub mod attacking_unit_id;
pub mod defending_unit_id;
pub mod is_avoided;

mod combat;
pub use combat::Combat;

#[cfg(test)]
mod combat_test;
