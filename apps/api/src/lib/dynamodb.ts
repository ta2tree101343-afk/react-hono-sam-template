import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"
import { env } from "./env"

// DYNAMODB_ENDPOINT_URL が設定されていれば DynamoDB Local などのエンドポイントへ接続、
// 未設定なら AWS 本物の DynamoDB へ接続する
const client = new DynamoDBClient({
	region: env.AWS_REGION,
	...(env.DYNAMODB_ENDPOINT_URL && {
		endpoint: env.DYNAMODB_ENDPOINT_URL,
	}),
})

export const docClient = DynamoDBDocumentClient.from(client, {
	marshallOptions: {
		removeUndefinedValues: true,
	},
})
