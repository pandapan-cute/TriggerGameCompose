package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// main DynamoDB Localの初期化スクリプト
//
// LocalのDynamoDBそのものはdocker composeでイメージを立ち上げる
func main() {
	ctx := context.Background()

	// DynamoDB Local に接続
	endpoint := getEnv("DYNAMODB_ENDPOINT", "http://dynamodb-local:8000")
	region := getEnv("AWS_REGION", "ap-northeast-1")

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{URL: endpoint}, nil
			},
		)),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			"dummy", "dummy", "",
		)),
	)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	client := dynamodb.NewFromConfig(cfg)

	log.Println("🚀 Starting DynamoDB initialization...")
	time.Sleep(2 * time.Second) // DynamoDB Localの起動待ち

	// テーブル作成
	if err := createTables(ctx, client); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	// テストデータ投入
	// if err := insertTestData(ctx, client); err != nil {
	// 	log.Fatalf("Failed to insert test data: %v", err)
	// }

	log.Println("✅ Initialization complete!")
}

func createTables(ctx context.Context, client *dynamodb.Client) error {
	log.Println("📋 Creating tables...")

	// NOTE: テーブル追加時にはここも更新すること
	// Matchingsテーブル
	_, errMatchings := client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String("Matchings"),
		AttributeDefinitions: []types.AttributeDefinition{
			{AttributeName: aws.String("matching_id"), AttributeType: types.ScalarAttributeTypeS},
			{AttributeName: aws.String("matching_status"), AttributeType: types.ScalarAttributeTypeS},
			{AttributeName: aws.String("matching_start_datetime"), AttributeType: types.ScalarAttributeTypeS},
		},
		KeySchema: []types.KeySchemaElement{
			{AttributeName: aws.String("matching_id"), KeyType: types.KeyTypeHash},
		},
		GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{
			{
				IndexName: aws.String("MatchingStatusIndex"),
				KeySchema: []types.KeySchemaElement{
					{AttributeName: aws.String("matching_status"), KeyType: types.KeyTypeHash},
					{AttributeName: aws.String("matching_start_datetime"), KeyType: types.KeyTypeRange},
				},
				Projection: &types.Projection{ProjectionType: types.ProjectionTypeAll},
			},
		},
		BillingMode: types.BillingModePayPerRequest,
	})

	if errMatchings != nil {
		log.Printf("⚠️  Matchings table: %v", errMatchings)
	} else {
		log.Println("✅ Matchings table created")
	}

	// Connectionsテーブル
	_, errConnections := client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String("Connections"),
		AttributeDefinitions: []types.AttributeDefinition{
			{AttributeName: aws.String("player_id"), AttributeType: types.ScalarAttributeTypeS},
		},
		KeySchema: []types.KeySchemaElement{
			// プライマリキーを player_id に設定することで、一意のプレイヤーに対して最新の接続IDを保存できる
			{AttributeName: aws.String("player_id"), KeyType: types.KeyTypeHash},
		},
		BillingMode: types.BillingModePayPerRequest,
	})

	if errConnections != nil {
		log.Printf("⚠️  Connections table: %v", errConnections)
	} else {
		log.Println("✅ Connections table created")
	}

	// Unitsテーブル
	_, errUnits := client.CreateTable(ctx, &dynamodb.CreateTableInput{
		TableName: aws.String("Units"),
		AttributeDefinitions: []types.AttributeDefinition{
			{AttributeName: aws.String("unit_id"), AttributeType: types.ScalarAttributeTypeS},
			{AttributeName: aws.String("game_id"), AttributeType: types.ScalarAttributeTypeS},
		},
		KeySchema: []types.KeySchemaElement{
			{AttributeName: aws.String("unit_id"), KeyType: types.KeyTypeHash},
		},
		GlobalSecondaryIndexes: []types.GlobalSecondaryIndex{
			{
				IndexName: aws.String("GameIdIndex"),
				KeySchema: []types.KeySchemaElement{
					{AttributeName: aws.String("game_id"), KeyType: types.KeyTypeHash},
				},
				Projection: &types.Projection{ProjectionType: types.ProjectionTypeAll},
			},
		},
		BillingMode: types.BillingModePayPerRequest,
	})

	if errUnits != nil {
		log.Printf("⚠️  Units table: %v", errUnits)
	} else {
		log.Println("✅ Units table created")
	}
	return nil
}

func insertTestData(ctx context.Context, client *dynamodb.Client) error {
	log.Println("📊 Inserting test data...")

	testMatches := []map[string]types.AttributeValue{
		{
			"matching_id":             &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f2b"},
			"player1_id":              &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f3f"},
			"player2_id":              &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f4f"},
			"matching_status":         &types.AttributeValueMemberS{Value: "Interrupted"},
			"matching_start_datetime": &types.AttributeValueMemberS{Value: "2026-01-12T10:00:00Z"},
			"matching_end_datetime":   &types.AttributeValueMemberS{Value: "2026-01-12T10:05:00Z"},
		},
		{
			"matching_id":             &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f2c"},
			"player1_id":              &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f7f"},
			"matching_status":         &types.AttributeValueMemberS{Value: "InProgress"},
			"matching_start_datetime": &types.AttributeValueMemberS{Value: "2026-01-12T11:00:00Z"},
		},
		{
			"matching_id":             &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f2d"},
			"player1_id":              &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f8f"},
			"player2_id":              &types.AttributeValueMemberS{Value: "212df6af-6345-46a3-b7fe-d1d892ae0f9f"},
			"matching_status":         &types.AttributeValueMemberS{Value: "Interrupted"},
			"matching_start_datetime": &types.AttributeValueMemberS{Value: "2026-01-12T12:00:00Z"},
			"matching_end_datetime":   &types.AttributeValueMemberS{Value: "2026-01-12T12:10:00Z"},
		},
	}

	for _, item := range testMatches {
		_, err := client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String("Matchings"),
			Item:      item,
		})
		if err != nil {
			return fmt.Errorf("failed to insert item: %w", err)
		}
	}

	log.Printf("✅ Inserted %d test matches", len(testMatches))
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
