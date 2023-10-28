import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

import { loadYamlToJson } from '@/util/loadYamlToJson';

/**
 * ResourceProps
 */
interface ResourceProps extends cdk.StackProps {
  /**
   * @property {dynamodb.TableV2} vpc VPC
   */
  vpc: ec2.IVpc;
  /**
   * @property {dynamodb.TableV2} table DynamoDB
   */
  table: dynamodb.TableV2;
}

/**
 * deleteStateMachine
 */
export class DeleteStateMachine extends cdk.Stack {
  /**
   *
   */
  public stateMachine: sfn.StateMachine;

  /**
   * deleteStateMachine
   * @param {Construct} scope コンストラクト
   * @param {string} id スタック名
   * @param {ResourceProps} props 設定
   */
  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    const owner = 'xxxxxxxx';
    const repo = 'xxxxxxxx';

    /*
     * Start
     */
    const start = new sfn.Pass(scope, `${id}-Start`, {
      stateName: 'Start',
      parameters: {
        'params.$': '$',
      },
    });

    /*
     * DynamoDB-StatusDeleting
     */
    const dbStatusDeleteStep = new tasks.DynamoUpdateItem(scope, `${id}-DynamoDB-StatusDeleting`, {
      stateName: 'DynamoDB-StatusDeleting',
      table: props.table,
      key: {
        id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.params.id')),
      },
      expressionAttributeValues: {
        ':newStatus': tasks.DynamoAttributeValue.fromString('Deleting'),
      },
      updateExpression: 'SET envStatus = :newStatus',
      resultPath: '$.output',
    });

    /*
     * DynamoDB-DeleteItem
     */
    const dbDeleteItemStep = new tasks.DynamoDeleteItem(scope, `${id}-DynamoDB-DeleteItem`, {
      stateName: 'DynamoDB-DeleteItem',
      table: props.table,
      key: {
        id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.params.id')),
      },
      resultPath: '$.output',
    });

    /*
     * DeleteStackRole
     */
    // DeleteStackロール
    const deleteStackRole = new iam.Role(scope, `${id}-DeleteStackRole`, {
      roleName: 'TemporaryEnv-DeleteStackRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });
    // DeleteStack
    const deleteStack = new codebuild.Project(scope, `${id}-DeleteStackProject`, {
      projectName: 'TemporaryEnv-DeleteStack',
      source: codebuild.Source.gitHub({
        owner,
        repo: `${repo}_infra`,
        branchOrRef: 'main',
      }),
      vpc: props.vpc,
      role: deleteStackRole,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml(loadYamlToJson('./buildspec/TemporaryEnv-DeleteStack.yml')),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
    });
    // step
    const deleteStackStep = new tasks.CodeBuildStartBuild(scope, `${id}-DeleteStack`, {
      stateName: 'Codebuild-DeleteStack',
      project: deleteStack,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      environmentVariablesOverride: {
        URL: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: sfn.JsonPath.stringAt('$.params.url'),
        },
      },
      resultPath: '$.output',
    });

    // StateMachine
    this.stateMachine = new sfn.StateMachine(scope, `${id}-DeleteEnv`, {
      stateMachineName: 'TemporaryEnv-DeleteEnv',
      definitionBody: sfn.DefinitionBody.fromChainable(start.next(dbStatusDeleteStep).next(deleteStackStep).next(dbDeleteItemStep)),
    });
  }
}
