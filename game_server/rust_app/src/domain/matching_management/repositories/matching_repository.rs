use crate::domain::matching_management::models::matching::Matching;
use async_trait::async_trait;

/// Matchingリポジトリのトレイト
#[async_trait]
pub trait MatchingRepository: Send + Sync {
    /// マッチング情報を保存
    async fn save(&self, matching: &Matching) -> Result<(), String>;

    /// マッチング情報を更新
    async fn update(&self, matching: &Matching) -> Result<(), String>;

    /// 最新の待機中マッチングを取得
    async fn get_latest_waiting_matching(&self) -> Result<Option<Matching>, String>;

    /// 指定プレイヤーの waiting(InProgress) マッチングを中断する。
    ///
    /// 実装は以下を満たすこと:
    /// - Completed を Interrupted で上書きしない
    /// - 条件に一致しない場合は no-op で成功 (idempotent)
    async fn interrupt_waiting_by_player_id(&self, player_id: &str) -> Result<(), String>;
}
