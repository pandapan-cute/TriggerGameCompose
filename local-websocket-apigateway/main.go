package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"

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
	Action   string `json:"action"`    // matchmaking など
	PlayerId string `json:"player_id"` // プレイヤーID
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
	defer func() {
		conn.Close()
		// 接続を削除
		clientsMu.Lock()
		for id, c := range clients {
			if c == conn {
				delete(clients, id)
				break
			}
		}
		clientsMu.Unlock()
	}()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		log.Printf("Received: %+v\n", msg)

		// 接続を登録（connection_id として player_id を使用）
		clientsMu.Lock()
		clients[msg.PlayerId] = conn
		clientsMu.Unlock()

		// Lambda を呼び出し
		response := invokeLambda(msg)

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

	log.Printf("Message data: %s", string(reqBody))

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

func invokeLambda(msg Message) map[string]interface{} {
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
			"connectionId": msg.PlayerId,
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

	// ログ追加
	log.Printf("Sending to Lambda: %s", string(payload))

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
