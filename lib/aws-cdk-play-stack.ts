import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
// import {NodejsFunction} from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambdaEventSource from 'aws-cdk-lib/aws-lambda-event-sources'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

const imageBucket = 'cdk-chuck-imagebucket'

export class AwsCdkPlayStack extends cdk.Stack {

  /***
   * 
   * @param {cdk.Construct} scope
   * @param {string} id
   * @param {cdk.StackProps} props
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // The code that defines your stack goes here

    //================================================================
    // Bucket for storing images
    //================================================================
    const bucket = new s3.Bucket(this, imageBucket, {
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    new cdk.CfnOutput(this, "Bucket", { value: bucket.bucketName})

    //================================================================
    // Role for AWS Lambda
    //================================================================
    const role = new iam.Role(this, "cdk-chuck-lambdarole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
    })
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "rekognition:*",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ], 
        resources: ["*"]
      })
    )

    //================================================================
    // Dynamo Db table for stroing image labels
    //================================================================
    const table = new dynamodb.Table(this, "cdk-chuck-imagetable", { 
      partitionKey: { name: "Image", type: dynamodb.AttributeType.STRING},
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    new cdk.CfnOutput(this, "Table", { value: table.tableName})

    //================================================================
    // AWS Lambda function
    //================================================================
    const lambdaFn = new lambda.Function(this, "cdk-chuck-function", {
      code: lambda.AssetCode.fromAsset("lambda"),
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "index.handler",
      role: role,
      environment: {
        TABLE: table.tableName,
        BUCKET: bucket.bucketName
      }
    })
    lambdaFn.addEventSource(
      new lambdaEventSource.S3EventSource(bucket, {
        events: [s3.EventType.OBJECT_CREATED]
      })
    )

    bucket.grantReadWrite(lambdaFn)
    table.grantFullAccess(lambdaFn)

    // example resource
    // const queue = new sqs.Queue(this, 'AwsCdkPlayQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
