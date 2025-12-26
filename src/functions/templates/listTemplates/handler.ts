import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const listTemplates: ValidatedEventAPIGatewayProxyEvent<null> = async (event) => {
  try {
    const userId = event.userId!;

    // Query templates for this user
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.TEMPLATES_TABLE!,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }));

    return formatJSONResponse({
      templates: result.Items || []
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    return formatErrorResponse(error as Error);
  }
};

export const main = middyfy(listTemplates)
  .use(iamOnlyMiddleware());