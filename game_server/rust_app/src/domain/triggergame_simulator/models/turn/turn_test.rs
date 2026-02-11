#[cfg(test)]
mod tests {
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;
    use crate::domain::triggergame_simulator::models::game::game_id::game_id::GameId;

    use super::super::turn::Turn;
    use super::super::turn_id::turn_id::TurnId;
    use super::super::turn_number::turn_number::TurnNumber;
    use super::super::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
    use super::super::turn_status::turn_status::{TurnStatus, TurnStatusValue};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn test_create_turn() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let turn = Turn::create(
            game_id.clone(),
            player_id.clone(),
            turn_number.clone(),
            start_datetime,
        );
        assert_eq!(turn.turn_number(), &turn_number);
        assert!(turn.is_step_setting());
        assert!(!turn.is_completed());
    }

    #[test]
    fn test_complete_turn() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(
            game_id.clone(),
            player_id.clone(),
            turn_number,
            start_datetime,
        );

        let end_datetime = Utc::now();
        turn.complete(end_datetime).unwrap();

        assert!(turn.is_completed());
    }

    #[test]
    fn test_complete_already_completed_turn() {
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(
            game_id.clone(),
            player_id.clone(),
            turn_number,
            start_datetime,
        );

        let end_datetime = Utc::now();
        turn.complete(end_datetime).unwrap();

        // 既に完了したターンを再度完了しようとするとエラー
        let result = turn.complete(Utc::now());
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "既にターンは完了しています");
    }

    #[test]
    fn test_reconstruct_turn() {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(3);
        let start_datetime = Utc::now();
        let end_datetime = Utc::now();
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_status = TurnStatus::new(TurnStatusValue::Completed);

        let turn = Turn::reconstruct(
            turn_id.clone(),
            game_id.clone(),
            player_id.clone(),
            turn_number.clone(),
            turn_start_datetime,
            turn_status,
            Vec::new(),
        );

        assert_eq!(turn.turn_id(), &turn_id);
        assert_eq!(turn.turn_number(), &turn_number);
        assert!(turn.is_completed());
    }

    #[test]
    fn test_turn_equality() {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let game_id = GameId::new(Uuid::new_v4().to_string());
        let player_id = PlayerId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_status = TurnStatus::new(TurnStatusValue::StepSetting);

        let turn1 = Turn::reconstruct(
            turn_id.clone(),
            game_id.clone(),
            player_id.clone(),
            turn_number.clone(),
            turn_start_datetime.clone(),
            turn_status.clone(),
            Vec::new(),
        );
        let turn2 = Turn::reconstruct(
            turn_id.clone(),
            game_id.clone(),
            player_id.clone(),
            turn_number,
            turn_start_datetime,
            turn_status,
            Vec::new(),
        );

        assert_eq!(turn1, turn2);
    }
}
