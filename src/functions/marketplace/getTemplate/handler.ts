import { APIGatewayProxyHandler } from 'aws-lambda';
import { formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const main: APIGatewayProxyHandler = async (event) => {
  try {
    const templateId = event.pathParameters?.templateId;

    if (!templateId) {
      return formatJSONResponse({ message: 'Template ID is required' }, 400);
    }

    const result = await docClient.send(new GetCommand({
      TableName: process.env.MARKETPLACE_TABLE!,
      Key: { templateId }
    }));

    if (!result.Item) {
      return formatJSONResponse({ message: 'Template not found' }, 404);
    }

    return formatJSONResponse({ template: result.Item });
  } catch (error) {
    console.error('Error getting marketplace template:', error);
    return formatErrorResponse(error as Error);
  }
};
