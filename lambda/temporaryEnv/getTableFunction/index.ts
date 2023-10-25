/* eslint-disable no-console */
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import dayjs = require('dayjs');

const client = new DynamoDBClient({ region: 'ap-northeast-1' });

export type TableData = {
  id: string;
  name: string;
  branch: string;
  url: string;
  envStatus: string;
  e2e: string;
  priority: string;
  createData: string;
};

/**
 * Lambda関数
 * @param {APIGatewayProxyEvent} event API Gatewayのイベントオブジェクト
 * @returns {Promise<APIGatewayProxyResult>} Lambda関数のレスポンス
 * @throws {Error} Error
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const command = new ScanCommand({ TableName: 'TemporaryDashboard' });
  const response = await client.send(command);
  const tableList: TableData[] =
    response.Items?.map(function (item) {
      return {
        id: item.id?.S ?? '',
        name: item.name?.S ?? '',
        branch: item.branch?.S ?? '',
        url: item.url?.S ?? '',
        envStatus: item.envStatus?.S ?? '',
        e2e: item.e2e?.S ?? '',
        priority: item.priority?.S ?? '',
        createData: item.createData?.S ?? '',
      };
    }) ?? [];

  const result: TableData[] = tableList.sort(function (a, b) {
    return dayjs(a.createData) < dayjs(b.createData) ? -1 : 1; //オブジェクトの昇順ソート
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result }),
  };
};
