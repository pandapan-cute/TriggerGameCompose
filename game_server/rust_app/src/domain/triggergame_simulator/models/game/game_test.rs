#[cfg(test)]
mod tests {
    use super::super::current_turn_number::current_turn_number::CurrentTurnNumber;
    use super::super::game::Game;
    use super::super::game_id::game_id::GameId;
    use super::super::match_id::match_id::MatchId;
    use super::super::unit_id::unit_id::UnitId;
    use uuid::Uuid;

    #[test]
    fn test_create_game() {
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![
            UnitId::new(Uuid::new_v4().to_string()),
            UnitId::new(Uuid::new_v4().to_string()),
        ];

        let game = Game::create(match_id.clone(), unit_ids);

        assert_eq!(game.match_id(), &match_id);
        assert_eq!(game.current_turn_number().value(), 1);
        assert!(!game.is_game_finished());
        assert_eq!(game.unit_count(), 2);
    }

    #[test]
    fn test_advance_to_next_turn() {
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![UnitId::new(Uuid::new_v4().to_string())];

        let mut game = Game::create(match_id, unit_ids);
        assert_eq!(game.current_turn_number().value(), 1);

        game.advance_to_next_turn().unwrap();
        assert_eq!(game.current_turn_number().value(), 2);

        game.advance_to_next_turn().unwrap();
        assert_eq!(game.current_turn_number().value(), 3);
    }

    #[test]
    fn test_is_game_finished() {
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![UnitId::new(Uuid::new_v4().to_string())];

        let mut game = Game::create(match_id, unit_ids);
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
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![UnitId::new(Uuid::new_v4().to_string())];
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let current_turn_number = CurrentTurnNumber::new(6);

        let mut game = Game::reconstruct(game_id, match_id, unit_ids, current_turn_number);

        assert!(game.is_game_finished());

        let result = game.advance_to_next_turn();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "ゲームは既に最終ターンに達しています"
        );
    }

    #[test]
    fn test_add_unit() {
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![];

        let mut game = Game::create(match_id, unit_ids);
        assert_eq!(game.unit_count(), 0);

        let unit_id = Uuid::new_v4().to_string();
        game.add_unit(&unit_id);

        assert_eq!(game.unit_count(), 1);
        assert!(game.contains_unit(&unit_id));
    }

    #[test]
    fn test_contains_unit() {
        let unit_id1 = Uuid::new_v4().to_string();
        let unit_id2 = Uuid::new_v4().to_string();
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![UnitId::new(unit_id1.clone())];

        let game = Game::create(match_id, unit_ids);

        assert!(game.contains_unit(&unit_id1));
        assert!(!game.contains_unit(&unit_id2));
    }

    #[test]
    fn test_reconstruct_game() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![UnitId::new(Uuid::new_v4().to_string())];
        let current_turn_number = CurrentTurnNumber::new(3);

        let game = Game::reconstruct(
            game_id.clone(),
            match_id.clone(),
            unit_ids,
            current_turn_number.clone(),
        );

        assert_eq!(game.game_id(), &game_id);
        assert_eq!(game.match_id(), &match_id);
        assert_eq!(game.current_turn_number(), &current_turn_number);
    }

    #[test]
    fn test_game_equality() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let match_id = MatchId::new(Uuid::new_v4().to_string());
        let unit_ids = vec![];
        let current_turn_number = CurrentTurnNumber::new(1);

        let game1 = Game::reconstruct(
            game_id.clone(),
            match_id.clone(),
            unit_ids.clone(),
            current_turn_number.clone(),
        );
        let game2 = Game::reconstruct(game_id.clone(), match_id, unit_ids, current_turn_number);

        assert_eq!(game1, game2);
    }
}
