use super::Visibility;
use crate::domain::unit_management::models::unit::position::position::Position;

/// checkUnitsVisibility: 同一座標は true
#[test]
fn check_units_visibility_same_position_is_true() {
    let visibility = Visibility::create();
    let result = visibility.check_units_visibility(&Position::new(0, 0), &Position::new(0, 0));
    assert!(result);
}

/// checkUnitsVisibility: (31, 14)から(30, 24)は距離が遠いので不可視
#[test]
fn check_units_visibility_far_distance_is_false() {
    let visibility = Visibility::create();
    let result = visibility.check_units_visibility(&Position::new(31, 14), &Position::new(30, 24));
    assert!(!result);
}

/// hasLineOfSight: 障害物があるラインは false
#[test]
fn has_line_of_sight_with_obstacle_is_false() {
    let visibility = Visibility::create();
    let result = visibility.has_line_of_sight(&Position::new(20, 22), &Position::new(29, 13));
    assert!(!result);
}

/// hasLineOfSight: 遮蔽のないラインは true
#[test]
fn has_line_of_sight_without_obstacle_is_true() {
    let visibility = Visibility::create();
    let result = visibility.has_line_of_sight(&Position::new(20, 22), &Position::new(29, 13));
    assert!(result);
}

/// hasLineOfSight: 真っ直ぐなラインのパスを取得
#[test]
fn get_line_path_straight_vertical_line() {
    let visibility = Visibility::create();
    let result = visibility.get_line_path(&Position::new(5, 13), &Position::new(5, 15));
    assert_eq!(
        result,
        vec![
            Position::new(5, 13),
            Position::new(5, 14),
            Position::new(5, 15),
        ]
    );
}
