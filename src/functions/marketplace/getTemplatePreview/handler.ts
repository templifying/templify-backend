import { APIGatewayProxyHandler } from 'aws-lambda';
import { formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

export const main: APIGatewayProxyHandler = async (event) => {
  try {
    const templateId = event.pathParameters?.templateId;

    if (!templateId) {
      return formatJSONResponse({ message: 'Template ID is required' }, 400);
    }

    // Get template metadata
    const result = await docClient.send(new GetCommand({
      TableName: process.env.MARKETPLACE_TABLE!,
      Key: { templateId }
    }));

    if (!result.Item) {
      return formatJSONResponse({ message: 'Template not found' }, 404);
    }

    const template = result.Item;

    // Get template content from S3
    const s3Response = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.ASSETS_BUCKET!,
      Key: template.s3Key
    }));

    const content = await s3Response.Body?.transformToString('utf-8');

    return formatJSONResponse({
      template: {
        ...template,
        content
      }
    });
  } catch (error) {
    console.error('Error getting marketplace template preview:', error);
    return formatErrorResponse(error as Error);
  }
};
