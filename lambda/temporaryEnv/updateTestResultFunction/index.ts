/* eslint-disable no-console */
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({ region: 'ap-northeast-1' });

/**
 * Lambda関数
 * @param {APIGatewayProxyEvent} event API Gatewayのイベントオブジェクト
 * @returns {Promise<APIGatewayProxyResult>} Lambda関数のレスポンス
 * @throws {Error} Error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const getCommand = new GetItemCommand({
    TableName: 'TemporaryDashboard',
    Key: {
      ['id']: { S: 'pkValue' },
    },
  });
  const response = await client.send(getCommand);
  const tableData = response.Item;

  if (tableData) {
    const updateCommand = new UpdateItemCommand({
      TableName: 'TemporaryDashboard',
      Key: {
        id: { S: 'pkValue' },
      },
      ExpressionAttributeValues: {
        ':newResult': { S: 'pkValue' },
      },
      UpdateExpression: 'SET e2e = :newResult',
    });
    await client.send(updateCommand);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('Success'),
    };
  } else {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('Key not found'),
    };
  }
};
