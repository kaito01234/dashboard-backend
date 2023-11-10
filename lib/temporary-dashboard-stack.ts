import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { CreateStateMachine } from '@/lib/resource/temporary-dashboard/create-state-machine';
import { DashboardApi } from '@/lib/resource/temporary-dashboard/dashboard-api';
import { DeleteStateMachine } from '@/lib/resource/temporary-dashboard/delete-state-machine';
import { GetTableFunction } from '@/lib/resource/temporary-dashboard/get-table-function';
import { UpdateTestResultFunction } from '@/lib/resource/temporary-dashboard/update-test-result-function';

/**
 *
 */
export class TemporaryDashboardStack extends cdk.Stack {
  /**
   *
   * @param scope
   * @param id
   * @param props
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcId = 'vpc-xxxxxxxx';

    // 既存のVPCを取得
    const vpc = ec2.Vpc.fromLookup(this, 'vpc', {
      vpcId,
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

    // GetTableFunction
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
