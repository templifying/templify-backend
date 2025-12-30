import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';
import { subscriptionMiddleware } from '@libs/middleware/subscription';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const getUserProfile: ValidatedEventAPIGatewayProxyEvent<null> = async (event: any) => {
  try {
    const userId = event.userId!;
    
    // Get user data from DynamoDB
    const userData = await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE!,
      Key: { userId }
    }));
    
    let user = userData.Item;
    
    // If user doesn't exist, create profile
    if (!user) {
      // Use email from JWT token (set by dualAuth middleware), fallback to unknown
      const email = event.userEmail || 'unknown@example.com';
      user = {
        userId,
        email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: {
          emailNotifications: true,
          defaultTemplateSettings: {}
        }
      };
      
      // Save new user
      await docClient.send(new PutCommand({
        TableName: process.env.USERS_TABLE!,
        Item: user
      }));
    }
    
    // Add subscription and usage data from middleware
    const profile = {
      ...user,
      subscription: event.subscription,
      subscriptionLimits: event.subscriptionLimits,
      currentUsage: event.currentUsage
    };
    
    return formatJSONResponse({
      success: true,
      data: profile
    });
    
  } catch (error) {
    return formatErrorResponse(error);
  }
};

export const main = middyfy(getUserProfile)
  .use(iamOnlyMiddleware())
  .use(subscriptionMiddleware());