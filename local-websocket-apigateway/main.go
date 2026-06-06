package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// 接続中のクライアントを管理
var (
	clients   = make(map[string]*websocket.Conn)
	clientsMu sync.RWMutex
)

type Message struct {
	Action   string `json:"action"`   // matchmaking など
	PlayerId string `json:"playerId"` // プレイヤーID
	GameId   string `json:"gameId"`   // ゲームID
	Units    any    `json:"units"`    // ユニットの初期配置情報
	Steps    any    `json:"steps"`    // ユニットの行動情報
	// Characters []string `json:"characters"` // キャラクターのリスト
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// WebSocket リクエストかチェック
	if r.Header.Get("Upgrade") != "websocket" {
		log.Printf("Non-WebSocket request from %s", r.RemoteAddr)
		http.Error(w, "WebSocket endpoint only", http.StatusBadRequest)
		return
	}
	// 接続元のログ出力
	log.Printf("Connection attempt from: %s, Origin: %s, Upgrade: %s, Connection: %s",
		r.RemoteAddr,
		r.Header.Get("Origin"),
		r.Header.Get("Upgrade"),
		r.Header.Get("Connection"))

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// API Gateway 相当の接続IDを接続時に払い出し、接続ライフサイクル中は固定で使う。
	connectionID := uuid.NewString()
	clientsMu.Lock()
	clients[connectionID] = conn
	clientsMu.Unlock()

	defer func() {
		conn.Close()
		// 接続を削除し、connection_id を取得して $disconnect を Lambda に通知
		clientsMu.Lock()
		delete(clients, connectionID)
		clientsMu.Unlock()
		if connectionID != "" {
			invokeDisconnect(connectionID)
		}
	}()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Read error:", err)
			break
		}
		// 受信したメッセージのログ出力
		// log.Printf("Received: %+v\n", msg)

		// Lambda を呼び出し
		response := invokeLambda(connectionID, msg)

		// クライアントに返信（Lambda からの POST で送信されるため、ここでは不要）
		_ = response
	}
}

// Lambda からのメッセージ送信を受け付ける
func handlePostToConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// URL から connection_id を取得
	// /@connections/{connectionId}
	connectionId := r.URL.Path[len("/@connections/"):]

	log.Printf("POST to connection: %s", connectionId)

	// リクエストボディを読み取る
	var reqBody json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		log.Printf("Failed to decode body: %v", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// Lambda からのリクエストボディのログ出力
	// log.Printf("Message data: %s", string(reqBody))

	// 接続を取得
	clientsMu.RLock()
	conn, ok := clients[connectionId]
	clientsMu.RUnlock()

	if !ok {
		log.Printf("Connection not found: %s", connectionId)
		http.Error(w, "Connection not found", http.StatusNotFound)
		return
	}

	// メッセージを送信
	if err := conn.WriteMessage(websocket.TextMessage, reqBody); err != nil {
		log.Printf("Write error: %v", err)
		http.Error(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// invokeDisconnect は WebSocket 切断時に Lambda へ $disconnect イベントを送信する。
// これにより game_server 側の切断後処理（待機中断・接続削除）をローカルでも再現できる。
func invokeDisconnect(connectionId string) {
	client := &http.Client{}

	lambdaEvent := map[string]interface{}{
		"requestContext": map[string]interface{}{
			"connectionId": connectionId,
			"routeKey":     "$disconnect",
			"domainName":   "localhost",
			"stage":        "local",
		},
		"body": "",
	}

	payload, err := json.Marshal(lambdaEvent)
	if err != nil {
		log.Printf("Disconnect marshal error: %v", err)
		return
	}

	lambdaURL := "http://game-server:9000/2015-03-31/functions/game_server/invocations"
	req, err := http.NewRequest("POST", lambdaURL, bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("Disconnect request creation error: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Disconnect Lambda invocation error: %v", err)
		return
	}
	defer resp.Body.Close()
	log.Printf("Disconnect Lambda response status: %d (connectionId=%s)", resp.StatusCode, connectionId)
}

// invokeLambda は通常の受信メッセージを $default ルートイベントとして Lambda に転送する。
func invokeLambda(connectionID string, msg Message) map[string]interface{} {
	client := &http.Client{}

	// bodyを文字列化
	bodyJSON, err := json.Marshal(msg)
	if err != nil {
		log.Printf("❌ Body marshal error: %v", err)
		return map[string]interface{}{"error": "Body marshal failed"}
	}

	// Lambda Runtime API の形式に合わせる
	lambdaEvent := map[string]interface{}{
		"requestContext": map[string]interface{}{
			"connectionId": connectionID,
			"routeKey":     "$default",
			"domainName":   "localhost",
			"stage":        "local",
		},
		"body": string(bodyJSON), // ← 文字列に変換
	}

	payload, err := json.Marshal(lambdaEvent)
	if err != nil {
		return map[string]interface{}{"error": "Marshal failed"}
	}

	// API Gateway から Lambda に送るペイロードのログ出力
	// log.Printf("Sending to Lambda: %s", string(payload))

	// Lambda Runtime API の正しいエンドポイント
	lambdaURL := "http://game-server:9000/2015-03-31/functions/game_server/invocations"

	req, err := http.NewRequest("POST", lambdaURL, bytes.NewBuffer(payload))
	if err != nil {
		return map[string]interface{}{"error": "Request creation failed"}
	}

	// ログ追加
	log.Printf("Lambda endpoint: %s", req.URL.String())

	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Lambda invocation error: %v", err)
		return map[string]interface{}{"error": "Lambda invocation failed", "message": err.Error()}
	}
	defer resp.Body.Close()

	// ログ追加
	log.Printf("Lambda response status: %d", resp.StatusCode)

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("Response decode error: %v", err)
		return map[string]interface{}{"error": "Failed to decode response"}
	}

	// ログ追加
	log.Printf("Lambda response: %+v", result)

	return result
}

func main() {
	// WebSocket エンドポイント
	http.HandleFunc("/", handleWebSocket)

	// Lambda からのメッセージ送信エンドポイント
	http.HandleFunc("/@connections/", handlePostToConnection)
	log.Println("WebSocket server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
