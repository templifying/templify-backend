import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

    // Query tokens for this user using the GSI to find the one with matching tokenId
    const queryResult = await docClient.send(new QueryCommand({
      TableName: process.env.TOKENS_TABLE!,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: 'tokenId = :tokenId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':tokenId': tokenId
      }
    }));

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return formatJSONResponse({
        error: 'Token not found'
      }, 404);
    }

    const tokenRecord = queryResult.Items[0];

    // Delete the token using the actual partition key (token hash)
    await docClient.send(new DeleteCommand({
      TableName: process.env.TOKENS_TABLE!,
      Key: {
        token: tokenRecord.token
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