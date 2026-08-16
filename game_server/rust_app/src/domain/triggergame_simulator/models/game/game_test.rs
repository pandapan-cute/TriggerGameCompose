#[cfg(test)]
mod tests {
    use super::super::game::Game;
    use super::super::game_id::game_id::GameId;
    use crate::application::game;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::action::action::Action;
    use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
        ActionType, ActionTypeValue,
    };
    use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::triggergame_simulator::models::game::game_state::GameState;
    use crate::domain::triggergame_simulator::models::game::game_type::GameType;
    use crate::domain::triggergame_simulator::models::game::{game_type, motion_lab_end_time};
    use crate::domain::triggergame_simulator::models::game::motion_lab_end_time::MotionLabEndTime;
    use crate::domain::triggergame_simulator::models::game::visibility::{self, Visibility};
    use crate::domain::triggergame_simulator::models::step::step::Step;
    use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
    use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
    use crate::domain::triggergame_simulator::models::turn::Turn;
    use crate::domain::unit_management::models::unit::current_action_points::current_action_points::CurrentActionPoints;
use crate::domain::unit_management::models::unit::{
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_type_id::unit_type_id::UnitTypeId, Unit,
    };
    use chrono::Utc;
    use uuid::Uuid;

    fn create_player_id() -> PlayerId {
        PlayerId::new(Uuid::new_v4().to_string())
    }

    fn create_unit(game_id: &GameId, owner: &PlayerId, position: Position) -> Unit {
        Unit::create(
            UnitTypeId::new("KUGA_YUMA".to_string()),
            game_id.clone(),
            owner.clone(),
            position,
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            HavingTriggerIds::new(vec![
                TriggerId::new("KOGETSU".to_string()),
                TriggerId::new("IBIS".to_string()),
            ]),
            HavingTriggerIds::new(vec![
                TriggerId::new("SHIELD".to_string()),
                TriggerId::new("BAGWORM".to_string()),
            ]),
            100,
            100,
            8,
            10,
        )
    }

    fn create_step(action: Action) -> Step {
        Step::create(
            StepId::new(Uuid::new_v4().to_string()),
            vec![action],
            Vec::new(),
        )
    }

    #[test]
    fn test_create_game() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let game = Game::create(game_id.clone(), &player1_id, &player2_id);

        assert_eq!(game.game_id(), &game_id);
        assert_eq!(game.current_turn_number().value(), 1);
        assert!(!game.is_game_finished());
    }

    #[test]
    fn test_advance_to_next_turn() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player1_id = create_player_id();
        let player2_id = create_player_id();

        let mut game = Game::create(game_id.clone(), &player1_id, &player2_id);
        assert_eq!(game.current_turn_number().value(), 1);

        game.advance_to_next_turn().unwrap();
        assert_eq!(game.current_turn_number().value(), 2);

        game.advance_to_next_turn().unwrap();
        assert_eq!(game.current_turn_number().value(), 3);
    }

    #[test]
    fn test_is_game_finished() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player1_id = create_player_id();
        let player2_id = create_player_id();

        let mut game = Game::create(game_id.clone(), &player1_id, &player2_id);
        assert!(!game.is_game_finished());

        // ターン6まで進める
        for _ in 1..6 {
            game.advance_to_next_turn().unwrap();
        }

        assert_eq!(game.current_turn_number().value(), 6);
        assert!(game.is_game_finished());
    }

    #[test]
    fn test_reconstruct_game() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let game_state = GameState::initial();
        let game_type = GameType::initial();
        let current_turn_number = TurnNumber::new(3);
        let motion_lab_end_time = MotionLabEndTime::initial();
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let visibility = Visibility::create();

        let game = Game::reconstruct(
            game_id.clone(),
            game_state,
            game_type,
            current_turn_number.clone(),
            motion_lab_end_time,
            player1_id.clone(),
            player2_id.clone(),
            visibility,
        );

        assert_eq!(game.game_id(), &game_id);
        assert_eq!(game.current_turn_number(), &current_turn_number);
    }

    #[test]
    fn test_game_equality() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let game_state = GameState::initial();
        let game_type = GameType::initial();
        let current_turn_number = TurnNumber::new(1);
        let motion_lab_end_time = MotionLabEndTime::initial();
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let visibility = Visibility::create();

        let game1 = Game::reconstruct(
            game_id.clone(),
            game_state.clone(),
            game_type.clone(),
            current_turn_number.clone(),
            motion_lab_end_time.clone(),
            player1_id.clone(),
            player2_id.clone(),
            visibility.clone(),
        );
        let game2 = Game::reconstruct(
            game_id.clone(),
            game_state,
            game_type.clone(),
            current_turn_number.clone(),
            motion_lab_end_time.clone(),
            player1_id.clone(),
            player2_id.clone(),
            visibility.clone(),
        );
        assert_eq!(game1, game2);
    }

    #[test]
    fn test_turn_start_executes_simultaneous_actions_for_both_players() {
        // 仕様: 同一ステップで両プレイヤーが同時に行動した場合、両者の移動が反映される。
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let mut game = Game::create(game_id.clone(), &player1_id, &player2_id);

        let mut units = vec![
            create_unit(&game_id, &player1_id, Position::new(2, 2)),
            create_unit(&game_id, &player2_id, Position::new(4, 2)),
        ];

        let p1_action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            units[0].unit_id().clone(),
            units[0].unit_type_id().clone(),
            Position::new(3, 2),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerAzimuth::new(0),
            TriggerAzimuth::new(0),
            CurrentActionPoints::new(5),
        );
        let p2_action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            units[1].unit_id().clone(),
            units[1].unit_type_id().clone(),
            Position::new(5, 2),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerAzimuth::new(180),
            TriggerAzimuth::new(180),
            CurrentActionPoints::new(5),
        );

        let mut p1_turn = Turn::create(
            game_id.clone(),
            player1_id.clone(),
            TurnNumber::new(1),
            Utc::now(),
        );
        p1_turn.set_steps(vec![create_step(p1_action)]);

        let mut p2_turn = Turn::create(
            game_id.clone(),
            player2_id.clone(),
            TurnNumber::new(1),
            Utc::now(),
        );
        p2_turn.set_steps(vec![create_step(p2_action)]);

        game.turn_start(&mut p1_turn, &mut p2_turn, &mut units)
            .unwrap();

        assert_eq!(units[0].position(), &Position::new(3, 2));
        assert_eq!(units[1].position(), &Position::new(5, 2));
    }

    #[test]
    fn test_turn_start_keeps_pending_actions_blocked_until_head_action_can_move() {
        // 仕様: 未消費アクション列の先頭が移動できない間は、後続アクションを飛ばさない。
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let mut game = Game::create(game_id.clone(), &player1_id, &player2_id);

        let mut units = vec![create_unit(&game_id, &player1_id, Position::new(2, 2))];

        let first_action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            units[0].unit_id().clone(),
            units[0].unit_type_id().clone(),
            Position::new(4, 2),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerAzimuth::new(0),
            TriggerAzimuth::new(0),
            CurrentActionPoints::new(10),
        );
        let second_action = Action::create(
            ActionType::new(ActionTypeValue::Move),
            units[0].unit_id().clone(),
            units[0].unit_type_id().clone(),
            Position::new(3, 2),
            TriggerId::new("KOGETSU".to_string()),
            TriggerId::new("SHIELD".to_string()),
            TriggerAzimuth::new(0),
            TriggerAzimuth::new(0),
            CurrentActionPoints::new(10),
        );

        let mut p1_turn = Turn::create(
            game_id.clone(),
            player1_id.clone(),
            TurnNumber::new(1),
            Utc::now(),
        );
        p1_turn.set_steps(vec![create_step(first_action), create_step(second_action)]);

        let mut p2_turn = Turn::create(
            game_id.clone(),
            player2_id.clone(),
            TurnNumber::new(1),
            Utc::now(),
        );

        game.turn_start(&mut p1_turn, &mut p2_turn, &mut units)
            .unwrap();

        assert_eq!(units[0].position(), &Position::new(2, 2));
    }
}
