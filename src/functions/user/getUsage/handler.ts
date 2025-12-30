import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const getUsage: ValidatedEventAPIGatewayProxyEvent<null> = async (event) => {
  try {
    const userId = event.userId!;

    // Get current period (month)
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Run all queries in parallel
    const [usageResult, templatesResult, tokensResult] = await Promise.all([
      // Get usage for current period (PDF generations)
      docClient.send(new GetCommand({
        TableName: process.env.USAGE_TABLE!,
        Key: {
          userId,
          yearMonth
        }
      })),
      // Get actual template count
      docClient.send(new QueryCommand({
        TableName: process.env.TEMPLATES_TABLE!,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Select: 'COUNT'
      })),
      // Get actual token count
      docClient.send(new QueryCommand({
        TableName: process.env.TOKENS_TABLE!,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        Select: 'COUNT'
      }))
    ]);

    // Map DB fields to API response fields
    const item = usageResult.Item || {};
    const usage = {
      userId,
      yearMonth,
      pdfGenerations: item.pdfCount || 0,
      templatesUploaded: templatesResult.Count || 0,
      tokensCreated: tokensResult.Count || 0,
      bytesGenerated: item.totalSizeBytes || 0
    };

    return formatJSONResponse({
      usage,
      currentPeriod: yearMonth
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    return formatErrorResponse(error as Error);
  }
};

export const main = middyfy(getUsage)
  .use(iamOnlyMiddleware());