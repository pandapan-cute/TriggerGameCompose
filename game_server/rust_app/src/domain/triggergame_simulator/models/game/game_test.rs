#[cfg(test)]
mod tests {
    use super::super::current_turn_number::current_turn_number::CurrentTurnNumber;
    use super::super::game::Game;
    use super::super::game_id::game_id::GameId;
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use uuid::Uuid;

    fn create_player_id() -> PlayerId {
        PlayerId::new(Uuid::new_v4().to_string())
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

        let mut game = Game::reconstruct(game_id, current_turn_number, player1_id, player2_id);
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

        let game = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
            player1_id.clone(),
            player2_id.clone(),
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

        let game1 = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
            player1_id.clone(),
            player2_id.clone(),
        );
        let game2 = Game::reconstruct(
            game_id.clone(),
            current_turn_number.clone(),
            player1_id.clone(),
            player2_id.clone(),
        );
        assert_eq!(game1, game2);
    }
}
