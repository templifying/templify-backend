import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const getUsage: ValidatedEventAPIGatewayProxyEvent<null> = async (event) => {
  try {
    const userId = event.userId!;

    // Get current period (month)
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get usage for current period
    const result = await docClient.send(new GetCommand({
      TableName: process.env.USAGE_TABLE!,
      Key: {
        userId,
        period: currentPeriod
      }
    }));

    const usage = result.Item || {
      userId,
      period: currentPeriod,
      pdfGenerations: 0,
      templatesUploaded: 0,
      tokensCreated: 0,
      bytesGenerated: 0
    };

    return formatJSONResponse({
      usage,
      currentPeriod
    });
  } catch (error) {
    console.error('Error getting usage:', error);
    return formatErrorResponse(error as Error);
  }
};

export const main = middyfy(getUsage)
  .use(iamOnlyMiddleware());