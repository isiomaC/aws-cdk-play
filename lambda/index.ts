import {APIGatewayProxyEventV2, APIGatewayProxyResultV2, S3Event} from 'aws-lambda'
import * as AWS from 'aws-sdk';

// export const handler = (event: APIGatewayProxyEventV2, context: any) => {

// }

const minCofidence = 60;

interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
    };
  };
}

export async function handler(event: S3Event) {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;
    await rekFunction(bucket, key);
  }
}

async function rekFunction(bucket: string, key: string) {
  console.log(`Detected the following image in S3`);
  console.log(`Bucket: ${bucket}, key name: ${key}`);

  const rekognition = new AWS.Rekognition();

  const response = await rekognition.detectLabels({
    Image: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    },
    MaxLabels: 10,
    MinConfidence: minCofidence
  }).promise();

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const imageLabelsTable = "cdk-chuck-imagetable"; // '!' asserts that TABLE environment variable is defined

  // Put item into table
  await dynamodb.put({
    TableName: imageLabelsTable,
    Item: { Image: key }
  }).promise();

  const objectsDetected: string[] = [];

  if (response.Labels){
    for (const label of response.Labels) {
        const newItem = label.Name ?? "unknown";
        objectsDetected.push(newItem);
        const objectNum = objectsDetected.length;
        const itemAtt = `object${objectNum}`;
        await dynamodb.update({
          TableName: imageLabelsTable,
          Key: { Image: key },
          UpdateExpression: `set ${itemAtt} = :r`,
          ExpressionAttributeValues: { ':r': `${newItem}` },
          ReturnValues: 'UPDATED_NEW'
        }).promise();
      }
  }
  
}