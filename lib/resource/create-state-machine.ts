import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { loadYamlToJson } from '../../util/loadYamlToJson';

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
 * createStateMachine
 */
export class CreateStateMachine extends cdk.Stack {
  public stateMachine: sfn.StateMachine;

  /**
   * createStateMachine
   * @param {Construct} scope コンストラクト
   * @param {string} id スタック名
   * @param {ResourceProps} props 設定
   */
  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    /*
     * Start
     */
    const start = new sfn.Pass(scope, `${id}-Start`, {
      stateName: 'Start',
      parameters: {
        'uuid.$': 'States.UUID()',
        'createData.$': '$$.Execution.StartTime',
        'params.$': '$',
      },
    });

    /*
     * DynamoDB-StatusCreateStep
     */
    const dbStatusCreateStep = new tasks.DynamoPutItem(scope, `${id}-DynamoDB-StatusCreateStep`, {
      stateName: 'DynamoDB-StatusStarting',
      table: props.table,
      item: {
        id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.uuid')),
        name: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.params.name')),
        branch: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.params.branch')),
        url: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.params.url')),
        envStatus: tasks.DynamoAttributeValue.fromString('Starting'),
        e2e: tasks.DynamoAttributeValue.fromString('UnTested'),
        priority: tasks.DynamoAttributeValue.fromString(''),
        createData: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.createData')),
      },
      resultPath: '$.output',
    });

    /*
     * DynamoDB-StatusLaunch
     */
    const dbStatusLaunchStep = new tasks.DynamoUpdateItem(scope, `${id}-DynamoDB-StatusLaunch`, {
      stateName: 'DynamoDB-StatusCreating',
      table: props.table,
      key: {
        id: tasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.uuid')),
      },
      expressionAttributeValues: {
        ':newStatus': tasks.DynamoAttributeValue.fromString('Creating'),
      },
      updateExpression: 'SET envStatus = :newStatus',
      resultPath: '$.output',
    });

    /*
     * CreateDatabase
     */
    // CreateDatabaseロール
    const createDatabaseRole = new iam.Role(scope, `${id}-CreateDatabaseRole`, {
      roleName: 'TemporaryEnv-CreateDatabaseRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });
    // CreateDatabase
    const createDatabase = new codebuild.Project(scope, `${id}-CreateDatabaseProject`, {
      projectName: 'TemporaryEnv-CreateDatabase',
      source: codebuild.Source.gitHub({
        owner: 'Yayoi-KK',
        repo: 'nextgen_payroll',
        branchOrRef: 'main',
      }),
      vpc: props.vpc,
      role: createDatabaseRole,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml(loadYamlToJson('./buildspec/TemporaryEnv-CreateDatabase.yml')),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
    });
    // step
    const createDatabaseStep = new tasks.CodeBuildStartBuild(scope, `${id}-CreateDatabase`, {
      stateName: 'Codebuild-CreateDatabase',
      project: createDatabase,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      environmentVariablesOverride: {
        URL: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: sfn.JsonPath.stringAt('$.params.url'),
        },
      },
      resultPath: '$.output',
    });

    /*
     * CreateStackRole
     */
    // CreateStackロール
    const createStackRole = new iam.Role(scope, `${id}-CreateStackRole`, {
      roleName: 'TemporaryEnv-CreateStackRole',
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });
    // CreateStack
    const createStack = new codebuild.Project(scope, `${id}-CreateStackProject`, {
      projectName: 'TemporaryEnv-CreateStack',
      source: codebuild.Source.gitHub({
        owner: 'Yayoi-KK',
        repo: 'nextgen_payroll_infra',
        branchOrRef: 'main',
      }),
      vpc: props.vpc,
      role: createStackRole,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml(loadYamlToJson('./buildspec/TemporaryEnv-CreateStack.yml')),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
    });
    // step
    const createStackStep = new tasks.CodeBuildStartBuild(scope, `${id}-CreateStack`, {
      stateName: 'Codebuild-CreateStack',
      project: createStack,
      integrationPattern: sfn.IntegrationPattern.RUN_JOB,
      environmentVariablesOverride: {
        URL: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: sfn.JsonPath.stringAt('$.params.url'),
        },
        BRANCH: {
          type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          value: sfn.JsonPath.stringAt('$.params.branch'),
        },
      },
      resultPath: '$.output',
    });

    // StateMachine
    this.stateMachine = new sfn.StateMachine(scope, `${id}-CreateEnv`, {
      stateMachineName: 'TemporaryEnv-CreateEnv',
      definitionBody: sfn.DefinitionBody.fromChainable(
        start.next(dbStatusCreateStep).next(createDatabaseStep).next(createStackStep).next(dbStatusLaunchStep)
      ),
    });
  }
}
