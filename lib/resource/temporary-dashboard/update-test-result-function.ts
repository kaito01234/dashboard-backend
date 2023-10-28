import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';

/**
 * ResourceProps
 */
interface ResourceProps extends cdk.StackProps {
  /**
   * @property {dynamodb.TableV2} table DynamoDB
   */
  table: dynamodb.TableV2;
}

/**
 * UpdateTestResultFunction
 */
export class UpdateTestResultFunction extends cdk.Stack {
  /**
   *
   */
  public nodejsFunction: nodejs.NodejsFunction;

  /**
   * UpdateTestResultFunction
   * @param {Construct} scope コンストラクト
   * @param {string} id スタック名
   * @param {ResourceProps} props 設定
   */
  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    this.nodejsFunction = new nodejs.NodejsFunction(scope, `${id}-UpdateTestResultFunction`, {
      functionName: 'TemporaryEnv-UpdateTestResultFunction',
      entry: 'lambda/temporaryEnv/updateTestResultFunction/index.ts',
      handler: 'handler',
      depsLockFilePath: 'lambda/temporaryEnv/updateTestResultFunction/package-lock.json',
      bundling: {
        nodeModules: ['@aws-sdk/client-dynamodb'],
      },
      runtime: lambda.Runtime.NODEJS_18_X,
    });
    this.nodejsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:*'],
        resources: ['*'],
      })
    );
  }
}
