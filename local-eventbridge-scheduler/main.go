package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	// スケジュール名（一意）。同名が存在する場合は409を返す。
	// スケジュールの作成リクエストを表す構造体。
	"time"
	// 実行時にPOSTする先のURL。
)

// targetUrl へそのまま送るJSONペイロード。

// 現在時刻からの遅延秒数。executeAt と同時指定は不可。
type createScheduleRequest struct {
	// 実行時刻（RFC3339文字列）。delaySeconds と同時指定は不可。
	Name      string          `json:"name"`
	TargetURL string          `json:"targetUrl"`
	Payload   json.RawMessage `json:"payload"`
	// scheduleResponse はAPIで返却するスケジュール状態DTO。
	// 内部状態(scheduleEntry)をクライアント向けのJSONに整形したもの。
	DelaySeconds *int64 `json:"delaySeconds,omitempty"`
	// スケジュール名。
	ExecuteAt string `json:"executeAt,omitempty"`
	// 実行先URL。
}

// 実行時に送信するJSONペイロード。

// 作成時刻（RFC3339）。
type scheduleResponse struct {
	// 予定実行時刻（RFC3339）。
	Name string `json:"name"`
	// 現在状態（scheduled / running / executed / failed）。
	TargetURL string `json:"targetUrl"`
	// 失敗時のエラーメッセージ。成功時は空。
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    string          `json:"createdAt"`
	ScheduledFor string          `json:"scheduledFor"`
	// scheduleEntry はサーバー内部で保持するスケジュール実体。
	// メモリ上の状態・タイマー制御情報を持つ。
	Status string `json:"status"`
	// スケジュール名（一意キー）。
	LastError string `json:"lastError,omitempty"`
	// 実行先URL。
}

// 実行時に送信するJSONペイロード。

// 登録時刻。
type scheduleEntry struct {
	// 実行予定時刻。
	name string
	// 実行状態（scheduled / running / executed / failed）。
	targetURL string
	// 失敗時のエラーメッセージ。
	payload json.RawMessage
	// 予約実行のためのGo標準タイマー。
	createdAt    time.Time
	scheduledFor time.Time
	status       string
	lastError    string
	timer        *time.Timer
}

var (
	schedules   = map[string]*scheduleEntry{}
	schedulesMu sync.RWMutex
)

// main はローカルSchedulerのHTTPエンドポイントを公開するエントリポイント。
// EventBridge Scheduler 風の最小APIとして health/schedules 系を提供する。
func main() {
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/schedules", handleSchedules)
	http.HandleFunc("/schedules/", handleScheduleByName)

	log.Println("Local EventBridge Scheduler starting on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}

// handleHealth はヘルスチェック用エンドポイント。
// GET のみ許可し、稼働確認を返す。
func handleHealth(w http.ResponseWriter, r *http.Request) {
	// 想定外メソッドは早期に拒否する。
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// handleSchedules は /schedules のルーティング担当。
// POST=作成, GET=一覧取得を振り分ける。
func handleSchedules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		// タイマー作成
		handleCreateSchedule(w, r)
	case http.MethodGet:
		// 登録済みタイマー一覧
		handleListSchedules(w)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleScheduleByName は /schedules/{name} のルーティング担当。
// GET=単体取得, DELETE=取消を処理する。
func handleScheduleByName(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/schedules/")
	// 名前が空なら対象を特定できないためエラー。
	if name == "" {
		http.Error(w, "schedule name is required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		// 単体参照
		handleGetSchedule(w, name)
	case http.MethodDelete:
		// タイマー取消
		handleDeleteSchedule(w, name)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleCreateSchedule はタイマー登録API。
// 入力検証後にメモリへ保存し、time.AfterFunc で実行を予約する。
func handleCreateSchedule(w http.ResponseWriter, r *http.Request) {
	var req createScheduleRequest
	// 1) JSONをデコード
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	// 2) 必須項目・相互排他などを検証
	if err := validateCreateScheduleRequest(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 3) 実行時刻を決定（delaySeconds / executeAt / デフォルト150秒）
	scheduledFor, err := resolveScheduledTime(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	entry := &scheduleEntry{
		name:         req.Name,
		targetURL:    req.TargetURL,
		payload:      req.Payload,
		createdAt:    now,
		scheduledFor: scheduledFor,
		status:       "scheduled",
	}

	schedulesMu.Lock()
	// 同名スケジュールの重複作成は防止する。
	if _, exists := schedules[req.Name]; exists {
		schedulesMu.Unlock()
		http.Error(w, "schedule already exists", http.StatusConflict)
		return
	}

	delay := time.Until(scheduledFor)
	// 過去時刻が指定された場合は即時実行扱いに丸める。
	if delay < 0 {
		delay = 0
	}

	// 4) 到達時刻に executeSchedule を起動するタイマーを登録
	entry.timer = time.AfterFunc(delay, func() {
		executeSchedule(req.Name)
	})
	schedules[req.Name] = entry
	schedulesMu.Unlock()

	writeJSON(w, http.StatusCreated, toScheduleResponse(entry))
}

// handleListSchedules は全スケジュールの現在状態を返す。
func handleListSchedules(w http.ResponseWriter) {
	schedulesMu.RLock()
	defer schedulesMu.RUnlock()

	res := make([]scheduleResponse, 0, len(schedules))
	for _, entry := range schedules {
		res = append(res, toScheduleResponse(entry))
	}

	writeJSON(w, http.StatusOK, map[string]any{"schedules": res})
}

// handleGetSchedule は1件分のスケジュール状態を返す。
func handleGetSchedule(w http.ResponseWriter, name string) {
	schedulesMu.RLock()
	entry, ok := schedules[name]
	schedulesMu.RUnlock()
	// 指定名が未登録なら404。
	if !ok {
		http.Error(w, "schedule not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, toScheduleResponse(entry))
}

// handleDeleteSchedule はスケジュールを取消して削除する。
// 予約済みタイマーがあれば stop して実行を止める。
func handleDeleteSchedule(w http.ResponseWriter, name string) {
	schedulesMu.Lock()
	entry, ok := schedules[name]
	// 指定名が未登録なら404。
	if !ok {
		schedulesMu.Unlock()
		http.Error(w, "schedule not found", http.StatusNotFound)
		return
	}

	if entry.timer != nil {
		entry.timer.Stop()
	}
	delete(schedules, name)
	schedulesMu.Unlock()

	w.WriteHeader(http.StatusNoContent)
}

// executeSchedule は期限到達時に呼ばれる実行本体。
// targetUrl へ payload をPOSTし、結果を status/lastError に反映する。
func executeSchedule(name string) {
	schedulesMu.Lock()
	entry, ok := schedules[name]
	// 削除済みなどで見つからなければ何もしない。
	if !ok {
		schedulesMu.Unlock()
		return
	}
	entry.status = "running"
	entry.lastError = ""
	schedulesMu.Unlock()

	err := postToTarget(entry.targetURL, entry.payload)

	schedulesMu.Lock()
	defer schedulesMu.Unlock()
	if current, exists := schedules[name]; exists {
		// 呼び出し失敗時は failed + エラー内容を記録する。
		if err != nil {
			current.status = "failed"
			current.lastError = err.Error()
			log.Printf("[scheduler] failed to execute %s: %v", name, err)
			return
		}

		// 成功時は executed に更新する。
		current.status = "executed"
		current.lastError = ""
		log.Printf("[scheduler] executed %s", name)
	}
}

// postToTarget はターゲットURLへJSONをPOSTする共通処理。
// 2xx以外は失敗として扱う。
func postToTarget(targetURL string, payload json.RawMessage) error {
	req, err := http.NewRequest(http.MethodPost, targetURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("target returned non-2xx status: %d", resp.StatusCode)
	}

	return nil
}

// validateCreateScheduleRequest は作成リクエストの入力妥当性を検証する。
// - 必須項目（name/targetUrl/payload）
// - delaySeconds と executeAt の同時指定禁止
// - delaySeconds の負値禁止
func validateCreateScheduleRequest(req createScheduleRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return errors.New("name is required")
	}
	if strings.TrimSpace(req.TargetURL) == "" {
		return errors.New("targetUrl is required")
	}
	if len(req.Payload) == 0 {
		return errors.New("payload is required")
	}

	if req.DelaySeconds != nil && strings.TrimSpace(req.ExecuteAt) != "" {
		return errors.New("delaySeconds and executeAt are mutually exclusive")
	}

	// delaySeconds/executeAt 未指定は resolveScheduledTime 側で
	// 「150秒後」デフォルトに解決するためここでは許可する。
	if req.DelaySeconds == nil && strings.TrimSpace(req.ExecuteAt) == "" {
		return nil
	}

	if req.DelaySeconds != nil && *req.DelaySeconds < 0 {
		return errors.New("delaySeconds must be >= 0")
	}

	return nil
}

// resolveScheduledTime は実行予定時刻を算出する。
// 優先順:
// 1) delaySeconds（現在時刻 + 秒）
// 2) executeAt（RFC3339）
// 3) 未指定時はデフォルト150秒後
func resolveScheduledTime(req createScheduleRequest) (time.Time, error) {
	now := time.Now().UTC()

	if req.DelaySeconds == nil && strings.TrimSpace(req.ExecuteAt) == "" {
		return now.Add(150 * time.Second), nil
	}

	if req.DelaySeconds != nil {
		return now.Add(time.Duration(*req.DelaySeconds) * time.Second), nil
	}

	t, err := time.Parse(time.RFC3339, req.ExecuteAt)
	if err != nil {
		return time.Time{}, errors.New("executeAt must be RFC3339")
	}

	return t.UTC(), nil
}

// toScheduleResponse は内部状態をAPI返却用DTOへ変換する。
func toScheduleResponse(entry *scheduleEntry) scheduleResponse {
	return scheduleResponse{
		Name:         entry.name,
		TargetURL:    entry.targetURL,
		Payload:      entry.payload,
		CreatedAt:    entry.createdAt.Format(time.RFC3339),
		ScheduledFor: entry.scheduledFor.Format(time.RFC3339),
		Status:       entry.status,
		LastError:    entry.lastError,
	}
}

// writeJSON はJSONレスポンス書き出しの共通ユーティリティ。
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}
