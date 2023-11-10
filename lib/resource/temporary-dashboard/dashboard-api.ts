import { Construct } from 'constructs';

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

/**
 * ResourceProps
 */
interface ResourceProps extends cdk.StackProps {
  /**
   * @property {sfn.StateMachine} createStateMachine createStateMachine
   */
  createStateMachine: sfn.StateMachine;
  /**
   * @property {sfn.StateMachine} deleteStateMachine deleteStateMachine
   */
  deleteStateMachine: sfn.StateMachine;
  /**
   * @property {nodejs.NodejsFunction} getTableFunction getTableFunction
   */
  getTableFunction: nodejs.NodejsFunction;
  /**
   * @property {nodejs.NodejsFunction} updateTestResultFunction updateTestResultFunction
   */
  updateTestResultFunction: nodejs.NodejsFunction;
}

/**
 * API Gateway作成
 */
export class DashboardApi extends cdk.Stack {
  /**
   *
   */
  public stateMachine: sfn.StateMachine;

  /**
   * API Gateway作成
   * @param {Construct} scope コンストラクト
   * @param {string} id スタック名
   * @param {ResourceProps} props 設定
   */
  constructor(scope: Construct, id: string, props: ResourceProps) {
    super(scope, id, props);

    /*
     * API Gateway
     */
    // APIGatewayのログの出力先作成
    const log = new logs.LogGroup(scope, 'TemporaryDashboardRestApiLogGroup', {
      logGroupName: '/aws/api-gateway/TemporaryDashboard',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // APIGateway作成
    const api = new apigateway.RestApi(scope, 'TemporaryDashboardRestApi', {
      restApiName: 'TemporaryDashboardApi',
      cloudWatchRole: true,
      cloudWatchRoleRemovalPolicy: cdk.RemovalPolicy.DESTROY,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(log),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        tracingEnabled: false,
      },
    });

    // APIキーを作成
    const apiKey = api.addApiKey('ApiKey', { apiKeyName: 'ApiKey' });
    // 使用量プランを作ってAPIキー・API・ステージを紐付け
    const plan = api.addUsagePlan('UsagePlan', { name: 'ApiUsageplan' });
    plan.addApiKey(apiKey);
    plan.addApiStage({ stage: api.deploymentStage });

    // API
    const webapi = api.root.addResource('api', { defaultMethodOptions: { apiKeyRequired: true } });

    // StepFunctions実行ロール
    const statesExecutionRole = new iam.Role(scope, 'StatesExecutionRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      inlinePolicies: {
        StatesExecutionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['states:StartExecution'],
              resources: [props.createStateMachine.stateMachineArn, props.deleteStateMachine.stateMachineArn],
            }),
          ],
        }),
      },
    });

    // CreateStateMachine
    webapi.addMethod(
      'POST',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'StartExecution',
        options: {
          credentialsRole: statesExecutionRole,
          requestTemplates: {
            'application/json': `{
            "stateMachineArn": "${props.createStateMachine.stateMachineArn}",
            "input": "$util.escapeJavaScript($input.json('$'))"
          }`,
          },
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': `$util.parseJson($input.json('$.output'))`,
              },
            },
            {
              selectionPattern: '4\\d{2}',
              statusCode: '400',
              responseTemplates: {
                'application/json': `$input.path('$.errorMessage')`,
              },
            },
            {
              selectionPattern: '5\\d{2}',
              statusCode: '500',
              responseTemplates: {
                'application/json': `$input.path('$.errorMessage')`,
              },
            },
          ],
        },
      }),
      { methodResponses: [{ statusCode: '200' }, { statusCode: '400' }, { statusCode: '500' }] }
    );

    // deleteStateMachine
    webapi.addMethod(
      'DELETE',
      new apigateway.AwsIntegration({
        service: 'states',
        action: 'StartExecution',
        options: {
          credentialsRole: statesExecutionRole,
          requestTemplates: {
            'application/json': `{
                "stateMachineArn": "${props.deleteStateMachine.stateMachineArn}",
                "input": "$util.escapeJavaScript($input.json('$'))"
              }`,
          },
          integrationResponses: [
            {
              statusCode: '200',
              responseTemplates: {
                'application/json': `$util.parseJson($input.json('$.output'))`,
              },
            },
            {
              selectionPattern: '4\\d{2}',
              statusCode: '400',
              responseTemplates: {
                'application/json': `$input.path('$.errorMessage')`,
              },
            },
            {
              selectionPattern: '5\\d{2}',
              statusCode: '500',
              responseTemplates: {
                'application/json': `$input.path('$.errorMessage')`,
              },
            },
          ],
        },
      }),
      { methodResponses: [{ statusCode: '200' }, { statusCode: '400' }, { statusCode: '500' }] }
    );

    // GetTemporaryTableFunction
    webapi.addMethod('GET', new apigateway.LambdaIntegration(props.getTableFunction));

    // UpdateTestResultFunction
    webapi.addMethod('PUT', new apigateway.LambdaIntegration(props.updateTestResultFunction));

    /*
     * AWS WAF
     */
    // WAFの作成
    const webAcl = new wafv2.CfnWebACL(scope, 'TemporaryDashboardAcl', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      name: 'TemporaryDashboardAcl',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: 'TemporaryDashboardAcl',
      },
    });
    const association = new wafv2.CfnWebACLAssociation(scope, 'AssociationApiGateway', {
      resourceArn: `arn:aws:apigateway:ap-northeast-1::/restapis/${api.restApiId}/stages/prod`,
      webAclArn: webAcl.attrArn,
    });
    association.node.addDependency(api);
  }
}
