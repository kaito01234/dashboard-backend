import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CreateStateMachine } from './resource/create-state-machine';
import { DashboardApi } from './resource/dashboard-api';
import { DeleteStateMachine } from './resource/delete-state-machine';
import { GetTableFunction } from './resource/get-table-function';
import { UpdateTestResultFunction } from './resource/update-test-result-function';

export class TemporaryDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 既存のVPCを取得
    const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
      vpcId: 'vpc-08eb1563be35f049f',
    });

    // DynamoDB作成
    const table = new dynamodb.TableV2(this, 'TemporaryDashboardTable', {
      tableName: 'TemporaryDashboard',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CreateStateMachine
    const createStateMachine = new CreateStateMachine(this, 'CreateStateMachine', { ...props, vpc, table });

    // DeleteStateMachine
    const deleteStateMachine = new DeleteStateMachine(this, 'DeleteStateMachine', { ...props, vpc, table });

    // GetTemporaryTableFunction
    const getTableFunction = new GetTableFunction(this, 'GetTableFunction', { ...props, table });

    // UpdateTestResultFunction
    const updateTestResultFunction = new UpdateTestResultFunction(this, 'UpdateTestResultFunction', { ...props, table });

    // API Gateway
    new DashboardApi(this, 'ApiGateway', {
      ...props,
      createStateMachine: createStateMachine.stateMachine,
      deleteStateMachine: deleteStateMachine.stateMachine,
      getTableFunction: getTableFunction.nodejsFunction,
      updateTestResultFunction: updateTestResultFunction.nodejsFunction,
    });
  }
}
