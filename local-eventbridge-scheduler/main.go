package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// createScheduleRequest は自作の簡易API形式を受け取るDTO。
type createScheduleRequest struct {
	Name         string          `json:"name"`
	TargetURL    string          `json:"targetUrl"`
	Payload      json.RawMessage `json:"payload"`
	DelaySeconds *int64          `json:"delaySeconds,omitempty"`
	ExecuteAt    string          `json:"executeAt,omitempty"`
}

// awsCreateScheduleRequest は AWS SDK の CreateSchedule リクエストを簡易的に受けるDTO。
type awsCreateScheduleRequest struct {
	GroupName          string          `json:"GroupName"`
	ScheduleExpression string          `json:"ScheduleExpression"`
	Target             awsTarget       `json:"Target"`
	FlexibleTimeWindow json.RawMessage `json:"FlexibleTimeWindow"`
	ClientToken        string          `json:"ClientToken"`
}

// awsTarget は EventBridge Scheduler の Target 情報。
type awsTarget struct {
	Arn     string `json:"Arn"`
	RoleArn string `json:"RoleArn"`
	Input   string `json:"Input"`
}

// scheduleResponse はAPIで返却するスケジュール状態DTO。
type scheduleResponse struct {
	Name         string          `json:"name"`
	TargetURL    string          `json:"targetUrl"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    string          `json:"createdAt"`
	ScheduledFor string          `json:"scheduledFor"`
	Status       string          `json:"status"`
	LastError    string          `json:"lastError,omitempty"`
}

// scheduleEntry はサーバー内部で保持するスケジュール実体。
type scheduleEntry struct {
	name         string
	targetURL    string
	targetArn    string
	roleArn      string
	groupName    string
	payload      json.RawMessage
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

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/schedules", handleSchedules)
	mux.HandleFunc("/schedules/", handleScheduleByName)

	log.Printf(
		"Local EventBridge Scheduler starting on :8081, target=%s",
		resolveLocalTargetURL(""),
	)
	log.Fatal(http.ListenAndServe(":8081", loggingMiddleware(mux)))
}

// loggingMiddleware は受信したメソッドとパスを必ず出力する。
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[scheduler] incoming request: method=%s path=%s from=%s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleSchedules(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		handleCreateSchedule(w, r)
	case http.MethodGet:
		handleListSchedules(w)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleScheduleByName は /schedules/{name} のルーティング担当。
// AWS SDK からの POST CreateSchedule にも対応する。
func handleScheduleByName(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/schedules/")
	if name == "" {
		http.Error(w, "schedule name is required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodPost:
		handleCreateScheduleFromAWS(w, r, name)
	case http.MethodGet:
		handleGetSchedule(w, name)
	case http.MethodDelete:
		handleDeleteSchedule(w, name)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleCreateSchedule は自作API形式でタイマー登録する。
func handleCreateSchedule(w http.ResponseWriter, r *http.Request) {
	var req createScheduleRequest
	body, err := decodeJSONBody(r, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	log.Printf("[scheduler] create request(custom): %s", string(body))

	if err := validateCreateScheduleRequest(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	scheduledFor, err := resolveScheduledTime(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	entry := &scheduleEntry{
		name:         req.Name,
		targetURL:    req.TargetURL,
		payload:      req.Payload,
		createdAt:    time.Now().UTC(),
		scheduledFor: scheduledFor,
		status:       "scheduled",
		groupName:    "custom",
	}

	if err := registerSchedule(entry); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		http.Error(w, err.Error(), status)
		return
	}

	writeJSON(w, http.StatusCreated, toScheduleResponse(entry))
}

// handleCreateScheduleFromAWS は AWS SDK の CreateSchedule 形式を受け取り、
// ローカル用の内部スケジュールへ変換して登録する。
func handleCreateScheduleFromAWS(w http.ResponseWriter, r *http.Request, name string) {
	var req awsCreateScheduleRequest
	body, err := decodeJSONBody(r, &req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	log.Printf("[scheduler] create request(aws): %s", string(body))

	if err := validateAWSCreateScheduleRequest(name, req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	scheduledFor, err := resolveScheduledTimeFromExpression(req.ScheduleExpression)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	payload := normalizePayload(req.Target.Input)
	entry := &scheduleEntry{
		name:         name,
		targetURL:    resolveLocalTargetURL(req.Target.Arn),
		targetArn:    req.Target.Arn,
		roleArn:      req.Target.RoleArn,
		groupName:    resolveGroupName(req.GroupName),
		payload:      payload,
		createdAt:    time.Now().UTC(),
		scheduledFor: scheduledFor,
		status:       "scheduled",
	}

	if err := registerSchedule(entry); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		http.Error(w, err.Error(), status)
		return
	}

	log.Printf(
		"[scheduler] schedule registered: name=%s group=%s runAt=%s targetArn=%s resolvedTargetUrl=%s",
		entry.name,
		entry.groupName,
		entry.scheduledFor.Format(time.RFC3339),
		entry.targetArn,
		entry.targetURL,
	)

	writeJSON(w, http.StatusOK, map[string]string{
		"ScheduleArn": fmt.Sprintf(
			"arn:aws:scheduler:local:000000000000:schedule/%s/%s",
			entry.groupName,
			entry.name,
		),
	})
}

func handleListSchedules(w http.ResponseWriter) {
	schedulesMu.RLock()
	defer schedulesMu.RUnlock()

	res := make([]scheduleResponse, 0, len(schedules))
	for _, entry := range schedules {
		res = append(res, toScheduleResponse(entry))
	}

	writeJSON(w, http.StatusOK, map[string]any{"schedules": res})
}

func handleGetSchedule(w http.ResponseWriter, name string) {
	schedulesMu.RLock()
	entry, ok := schedules[name]
	schedulesMu.RUnlock()
	if !ok {
		http.Error(w, "schedule not found", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, toScheduleResponse(entry))
}

func handleDeleteSchedule(w http.ResponseWriter, name string) {
	schedulesMu.Lock()
	entry, ok := schedules[name]
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

	log.Printf("[scheduler] schedule deleted: name=%s", name)
	w.WriteHeader(http.StatusNoContent)
}

// registerSchedule はスケジュールを登録してタイマー起動を予約する。
func registerSchedule(entry *scheduleEntry) error {
	if entry == nil {
		return errors.New("entry is required")
	}

	schedulesMu.Lock()
	defer schedulesMu.Unlock()

	if _, exists := schedules[entry.name]; exists {
		return errors.New("schedule already exists")
	}

	delay := time.Until(entry.scheduledFor)
	if delay < 0 {
		delay = 0
	}

	entry.timer = time.AfterFunc(delay, func() {
		executeSchedule(entry.name)
	})
	schedules[entry.name] = entry
	return nil
}

func executeSchedule(name string) {
	schedulesMu.Lock()
	entry, ok := schedules[name]
	if !ok {
		schedulesMu.Unlock()
		return
	}
	entry.status = "running"
	entry.lastError = ""
	schedulesMu.Unlock()

	log.Printf("[scheduler] executing schedule: name=%s target=%s", name, entry.targetURL)
	err := postToTarget(entry.targetURL, entry.payload)

	schedulesMu.Lock()
	defer schedulesMu.Unlock()
	if current, exists := schedules[name]; exists {
		if err != nil {
			current.status = "failed"
			current.lastError = err.Error()
			log.Printf("[scheduler] failed to execute %s: %v", name, err)
			return
		}

		current.status = "executed"
		current.lastError = ""
		log.Printf("[scheduler] executed %s", name)
	}
}

func postToTarget(targetURL string, payload json.RawMessage) error {
	requestBody := buildTargetRequestBody(targetURL, payload)
	log.Printf("[scheduler] POST target: url=%s payload=%s", targetURL, string(requestBody))

	req, err := http.NewRequest(http.MethodPost, targetURL, bytes.NewReader(requestBody))
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

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[scheduler] target response: status=%d body=%s", resp.StatusCode, string(body))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("target returned non-2xx status: %d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// buildTargetRequestBody は Lambda Runtime API 向けの呼び出し時に
// requestContext/body を含むイベント形式へラップする。
func buildTargetRequestBody(targetURL string, payload json.RawMessage) []byte {
	if !strings.Contains(targetURL, "/2015-03-31/functions/") {
		return payload
	}

	bodyPayload := payload
	var payloadMap map[string]any
	if err := json.Unmarshal(payload, &payloadMap); err == nil {
		if eventType, ok := payloadMap["eventType"].(string); ok {
			if _, exists := payloadMap["action"]; !exists {
				payloadMap["action"] = eventType
				delete(payloadMap, "eventType")
				if converted, marshalErr := json.Marshal(payloadMap); marshalErr == nil {
					bodyPayload = converted
				}
			}
		}
	}

	wrapped := map[string]any{
		"requestContext": map[string]any{
			"connectionId": "scheduler-local",
			"routeKey":     "$default",
			"domainName":   "eventbridge-scheduler",
			"stage":        "local",
		},
		"body": string(bodyPayload),
	}

	encoded, err := json.Marshal(wrapped)
	if err != nil {
		log.Printf("[scheduler] failed to wrap lambda payload: %v", err)
		return payload
	}

	return encoded
}

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
	if req.DelaySeconds == nil && strings.TrimSpace(req.ExecuteAt) == "" {
		return nil
	}
	if req.DelaySeconds != nil && *req.DelaySeconds < 0 {
		return errors.New("delaySeconds must be >= 0")
	}

	return nil
}

func validateAWSCreateScheduleRequest(name string, req awsCreateScheduleRequest) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("schedule name is required")
	}
	if strings.TrimSpace(req.ScheduleExpression) == "" {
		return errors.New("ScheduleExpression is required")
	}
	if strings.TrimSpace(req.Target.Arn) == "" {
		return errors.New("Target.Arn is required")
	}
	return nil
}

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

// resolveScheduledTimeFromExpression は at(...) 形式の schedule expression を時刻に変換する。
func resolveScheduledTimeFromExpression(expression string) (time.Time, error) {
	expression = strings.TrimSpace(expression)
	if !strings.HasPrefix(expression, "at(") || !strings.HasSuffix(expression, ")") {
		return time.Time{}, fmt.Errorf("unsupported ScheduleExpression: %s", expression)
	}

	raw := strings.TrimSuffix(strings.TrimPrefix(expression, "at("), ")")
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			if layout == "2006-01-02T15:04:05" || layout == "2006-01-02T15:04" {
				return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, time.UTC), nil
			}
			return t.UTC(), nil
		}
	}

	return time.Time{}, fmt.Errorf("failed to parse schedule expression time: %s", raw)
}

// AWS SDK の Target.Arn をローカルの呼び出しURLに変換する。
func resolveLocalTargetURL(targetArn string) string {
	if envURL := strings.TrimSpace(os.Getenv("LAMBDA_INVOKE_URL")); envURL != "" {
		return envURL
	}
	if strings.HasPrefix(targetArn, "http://") || strings.HasPrefix(targetArn, "https://") {
		return targetArn
	}
	return "http://game-server:9000/2015-03-31/functions/game_server/invocations"
}

func resolveGroupName(groupName string) string {
	if strings.TrimSpace(groupName) == "" {
		return "default"
	}
	return groupName
}

func normalizePayload(input string) json.RawMessage {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return json.RawMessage(`{}`)
	}
	if json.Valid([]byte(trimmed)) {
		return json.RawMessage(trimmed)
	}

	wrapped, _ := json.Marshal(map[string]string{"rawInput": input})
	return json.RawMessage(wrapped)
}

func decodeJSONBody(r *http.Request, target any) ([]byte, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read request body: %w", err)
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, errors.New("request body is empty")
	}
	if err := json.Unmarshal(body, target); err != nil {
		return body, fmt.Errorf("invalid JSON body: %w", err)
	}
	return body, nil
}

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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}
