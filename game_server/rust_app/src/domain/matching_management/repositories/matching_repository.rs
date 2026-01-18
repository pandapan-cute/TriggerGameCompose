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
}
