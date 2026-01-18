#[cfg(test)]
mod tests {
    use super::super::turn::Turn;
    use super::super::turn_end_datetime::turn_end_datetime::TurnEndDatetime;
    use super::super::turn_id::turn_id::TurnId;
    use super::super::turn_number::turn_number::TurnNumber;
    use super::super::turn_start_datetime::turn_start_datetime::TurnStartDatetime;
    use super::super::turn_status::turn_status::{TurnStatus, TurnStatusValue};
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn test_create_turn() {
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let turn = Turn::create(turn_number.clone(), start_datetime);

        assert_eq!(turn.turn_number(), &turn_number);
        assert!(turn.is_step_setting());
        assert!(!turn.is_completed());
        assert!(turn.turn_end_datetime().is_none());
    }

    #[test]
    fn test_start_unit_stepping() {
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(turn_number, start_datetime);
        assert!(turn.is_step_setting());

        turn.start_unit_stepping().unwrap();
        assert!(turn.is_unit_stepping());
        assert!(!turn.is_step_setting());
    }

    #[test]
    fn test_start_unit_stepping_from_invalid_status() {
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(turn_number, start_datetime);
        turn.start_unit_stepping().unwrap();

        // 既にユニット行動中の状態から再度開始しようとするとエラー
        let result = turn.start_unit_stepping();
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            "行動設定中のステータスでないとユニット行動を開始できません"
        );
    }

    #[test]
    fn test_complete_turn() {
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(turn_number, start_datetime);
        turn.start_unit_stepping().unwrap();

        let end_datetime = Utc::now();
        turn.complete(end_datetime).unwrap();

        assert!(turn.is_completed());
        assert!(turn.turn_end_datetime().is_some());
    }

    #[test]
    fn test_complete_already_completed_turn() {
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();

        let mut turn = Turn::create(turn_number, start_datetime);
        turn.start_unit_stepping().unwrap();

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
        let turn_number = TurnNumber::new(3);
        let start_datetime = Utc::now();
        let end_datetime = Utc::now();
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_end_datetime = Some(TurnEndDatetime::new(end_datetime));
        let turn_status = TurnStatus::new(TurnStatusValue::Completed);

        let turn = Turn::reconstruct(
            turn_id.clone(),
            turn_number.clone(),
            turn_start_datetime,
            turn_end_datetime,
            turn_status,
        );

        assert_eq!(turn.turn_id(), &turn_id);
        assert_eq!(turn.turn_number(), &turn_number);
        assert!(turn.is_completed());
        assert!(turn.turn_end_datetime().is_some());
    }

    #[test]
    fn test_turn_equality() {
        let turn_id = TurnId::new(Uuid::new_v4().to_string());
        let turn_number = TurnNumber::new(1);
        let start_datetime = Utc::now();
        let turn_start_datetime = TurnStartDatetime::new(start_datetime);
        let turn_status = TurnStatus::new(TurnStatusValue::StepSetting);

        let turn1 = Turn::reconstruct(
            turn_id.clone(),
            turn_number.clone(),
            turn_start_datetime.clone(),
            None,
            turn_status.clone(),
        );
        let turn2 = Turn::reconstruct(turn_id.clone(), turn_number, turn_start_datetime, None, turn_status);

        assert_eq!(turn1, turn2);
    }
}
