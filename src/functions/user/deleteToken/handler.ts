import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const deleteToken: ValidatedEventAPIGatewayProxyEvent<null> = async (event) => {
  try {
    const userId = event.userId!;
    const tokenId = event.pathParameters?.tokenId;

    if (!tokenId) {
      return formatJSONResponse({
        error: 'Token ID is required'
      }, 400);
    }

    // First check if token belongs to user
    const tokenResult = await docClient.send(new GetCommand({
      TableName: process.env.TOKENS_TABLE!,
      Key: {
        userId,
        tokenId
      }
    }));

    if (!tokenResult.Item) {
      return formatJSONResponse({
        error: 'Token not found'
      }, 404);
    }

    // Delete the token
    await docClient.send(new DeleteCommand({
      TableName: process.env.TOKENS_TABLE!,
      Key: {
        userId,
        tokenId
      }
    }));

    return formatJSONResponse({
      message: 'Token deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting token:', error);
    return formatErrorResponse(error as Error);
  }
};

export const main = middyfy(deleteToken)
  .use(iamOnlyMiddleware());