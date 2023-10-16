import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { loadYamlToJson } from '../../util/loadYamlToJson';

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
 * GitHub Self hosted-runner作成
 */
export class CreateEnv extends cdk.Stack {
  /**
   * GitHub Self hosted-runner作成
   * @param {Construct} scope コンストラクト
   * @param {string} id スタック名
   * @param {ResourceProps} props 設定
   */
  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    // CodeBuildロール
    const migrateRole = new iam.Role(scope, 'MigrateResetRole', {
      roleName: 'TemporaryEnv-MigrateResetRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });
    // MigrateReset
    const migrateReset = new codebuild.Project(scope, 'MigrateReset', {
      projectName: 'TemporaryEnv-MigrateReset',
      role: migrateRole,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml(loadYamlToJson('./buildspec/TemporaryEnv-MigrateReset.yml')),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
    });

    const stateMachine = new sfn.StateMachine(scope, 'CreateTemporaryEnv', {
      stateMachineName: 'CreateTemporaryEnv',
      definition: new tasks.DynamoPutItem(this, 'StatusCreate', {
        item: {
          id: tasks.DynamoAttributeValue.fromString('aaa'),
          name: tasks.DynamoAttributeValue.fromString('aaa'),
          branch: tasks.DynamoAttributeValue.fromString('aaa'),
          url: tasks.DynamoAttributeValue.fromString('aaa'),
          status: tasks.DynamoAttributeValue.fromString('aaa'),
          e2e: tasks.DynamoAttributeValue.fromString('aaa'),
          priority: tasks.DynamoAttributeValue.fromString('aaa'),
          createData: tasks.DynamoAttributeValue.fromString('aaa'),
        },
        table: props.table,
      }).next(
        new tasks.CodeBuildStartBuild(this, 'MigrateReset', {
          project: migrateReset,
        })
      ),
    });
  }
}
