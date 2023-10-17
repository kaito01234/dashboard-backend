import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CreateEnv } from './resource/create-env';

export class AwsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB作成
    const table = new dynamodb.TableV2(this, 'TemporaryEnvironmentTable', {
      tableName: 'TemporaryEnvironment',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create
    // new CreateEnv(this, 'Create', { ...props, table });
  }
}
