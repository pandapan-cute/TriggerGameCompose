package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Message struct {
	Type       string   `json:"type"`       // matchmaking, action など
	Characters []string `json:"characters"` // キャラクターのリスト
	PlayerId   *string  `json:"playerId"`   // null 許容
	MatchId    *string  `json:"matchId"`    // null 許容
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Read error:", err)
			break
		}

		log.Printf("Received: %+v\n", msg)

		// メッセージ内容に応じて Lambda 呼び出し
		response := invokeLambda(msg)

		// クライアントに返信
		if err := conn.WriteJSON(response); err != nil {
			log.Println("Write error:", err)
			break
		}
	}
}

func invokeLambda(msg Message) map[string]interface{} {
	client := &http.Client{}

	payload, err := json.Marshal(msg)
	if err != nil {
		return map[string]interface{}{"error": "Marshal failed"}
	}

	req, err := http.NewRequest("POST", "http://websocket-server:5000",
		bytes.NewBuffer(payload))
	if err != nil {
		return map[string]interface{}{"error": "Request creation failed"}
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{"error": "Lambda invocation failed", "message": err.Error()}
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result
}

func main() {
	http.HandleFunc("/", handleWebSocket)
	log.Println("WebSocket server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
