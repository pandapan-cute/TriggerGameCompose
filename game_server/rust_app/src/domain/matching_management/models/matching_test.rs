#[cfg(test)]
mod tests {
    use crate::domain::player_management::models::player::player_id::player_id::PlayerId;

    use super::super::matching::*;
    use uuid::Uuid;

    fn create_test_player_ids() -> (PlayerId, PlayerId) {
        let uuid1 = "550e8400-e29b-41d4-a716-446655440001";
        let uuid2 = "550e8400-e29b-41d4-a716-446655440002";
        let player1_id = PlayerId::new(uuid1.to_string());
        let player2_id = PlayerId::new(uuid2.to_string());
        (player1_id, player2_id)
    }

    #[test]
    #[should_panic(expected = "同じプレイヤー同士のマッチングはできません")]
    fn test_create_matching_with_same_player() {
        let uuid3 = "550e8400-e29b-41d4-a716-446655440003";
        let player_id = PlayerId::new(uuid3.to_string());
        let mut matching = Matching::create(player_id.clone());
        matching.matchmaking(player_id).unwrap();
    }

    #[test]
    fn test_complete_matching() {
        let (player1_id, player2_id) = create_test_player_ids();
        let mut matching = Matching::create(player1_id);

        // 少し待機（テストでは即座に完了するため、時間差を作る）
        std::thread::sleep(std::time::Duration::from_millis(10));

        let result = matching.matchmaking(player2_id);
        assert!(result.is_ok());
        assert!(matches!(
            matching.matching_status().value(),
            MatchingStatusValue::Completed
        ));
        assert!(matching.matching_end_datetime().value().is_none());
        assert!(matching.is_finished());
    }

    #[test]
    #[should_panic(expected = "既にマッチング相手が存在します")]
    fn test_complete_already_finished_matching() {
        let (player1_id, player2_id) = create_test_player_ids();
        let mut matching = Matching::create(player1_id);

        // matchmaking関数は所有権ごと渡すので、クローンを作成
        let copy_player2_id = player2_id.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));
        matching.matchmaking(player2_id).unwrap();

        // 既に完了しているマッチングを再度完了しようとする
        matching.matchmaking(copy_player2_id).unwrap();
    }
}
