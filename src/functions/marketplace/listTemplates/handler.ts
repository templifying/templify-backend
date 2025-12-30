import { APIGatewayProxyHandler } from 'aws-lambda';
import { formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const validCategories = ['business', 'certificates', 'marketing', 'personal'];

export const main: APIGatewayProxyHandler = async (event) => {
  try {
    const category = event.queryStringParameters?.category;

    let templates;

    if (category && category !== 'all') {
      if (!validCategories.includes(category)) {
        return formatJSONResponse({
          message: `Invalid category. Valid options: ${validCategories.join(', ')}`
        }, 400);
      }

      // Query by category using GSI
      const result = await docClient.send(new QueryCommand({
        TableName: process.env.MARKETPLACE_TABLE!,
        IndexName: 'category-index',
        KeyConditionExpression: 'category = :cat',
        ExpressionAttributeValues: { ':cat': category }
      }));
      templates = result.Items || [];
    } else {
      // Scan all templates (acceptable for small catalog)
      const result = await docClient.send(new ScanCommand({
        TableName: process.env.MARKETPLACE_TABLE!
      }));
      templates = result.Items || [];
    }

    // Sort by popularity (descending) then by name
    templates.sort((a, b) => {
      const popDiff = (b.popularity || 0) - (a.popularity || 0);
      if (popDiff !== 0) return popDiff;
      return (a.name || '').localeCompare(b.name || '');
    });

    return formatJSONResponse({ templates });
  } catch (error) {
    console.error('Error listing marketplace templates:', error);
    return formatErrorResponse(error as Error);
  }
};
