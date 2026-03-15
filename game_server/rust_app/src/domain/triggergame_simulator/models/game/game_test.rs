#[cfg(test)]
mod tests {
    use super::super::current_turn_number::current_turn_number::CurrentTurnNumber;
    use super::super::game::Game;
    use super::super::game_id::game_id::GameId;
    use crate::domain::triggergame_simulator::models::action::action::Action;
    use crate::domain::triggergame_simulator::models::action::action_type::action_type::{
        ActionType, ActionTypeValue,
    };
    use crate::domain::triggergame_simulator::models::action::trigger_azimuth::trigger_azimuth::TriggerAzimuth;
    use crate::domain::triggergame_simulator::models::step::step::Step;
    use crate::domain::triggergame_simulator::models::step::step_id::step_id::StepId;
    use crate::domain::triggergame_simulator::models::turn::turn_number::turn_number::TurnNumber;
    use crate::domain::triggergame_simulator::models::turn::Turn;
    use crate::domain::unit_management::models::unit::{
        having_trigger_ids::having_trigger_ids::HavingTriggerIds, position::position::Position,
        trigger_id::trigger_id::TriggerId, unit_type_id::unit_type_id::UnitTypeId, Unit,
    };
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::visibility::{self, Visibility};
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
    fn test_advance_turn_when_game_finished() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let current_turn_number = CurrentTurnNumber::new(6);
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let visibility = Visibility::create();
        let mut game = Game::reconstruct(
            game_id,
            current_turn_number,
            player1_id,
            player2_id,
            visibility,
        );
        assert!(game.is_game_finished());

        let result = game.advance_to_next_turn();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "ゲームは既に最終ターンに達しています");
    }

    #[test]
    fn test_reconstruct_game() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let current_turn_number = CurrentTurnNumber::new(3);
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let visibility = Visibility::create();

        let game = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
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
        let current_turn_number = CurrentTurnNumber::new(1);
        let player1_id = create_player_id();
        let player2_id = create_player_id();
        let visibility = Visibility::create();

        let game1 = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
            player1_id.clone(),
            player2_id.clone(),
            visibility.clone(),
        );
        let game2 = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
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

        game.turn_start(&mut p1_turn, &mut p2_turn, &mut units).unwrap();

        assert_eq!(units[0].position(), &Position::new(3, 2));
        assert_eq!(units[1].position(), &Position::new(5, 2));
    }
}
