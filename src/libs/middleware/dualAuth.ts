import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';
import { decode } from 'jsonwebtoken';

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
}

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface DualAuthOptions {
  requireAuth?: boolean;
  allowApiToken?: boolean;
}

export const dualAuthMiddleware = (options: DualAuthOptions = { requireAuth: true, allowApiToken: true }) => {
  return {
    before: async (handler: any): Promise<any> => {
      let userId: string | undefined;
      let userEmail: string | undefined;

      // First, try to extract user info from JWT Bearer token
      // This is the primary auth method for web clients and works in offline mode
      const authHeader = handler.event.headers?.['Authorization'] ||
                         handler.event.headers?.['authorization'];

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = decode(token) as JwtPayload;
          if (decoded?.sub) {
            userId = decoded.sub;
            userEmail = decoded.email;
          }
        } catch (e) {
          console.warn('Failed to decode JWT:', e);
        }
      }
      
      // Check for API token if allowed and no JWT userId found
      if (!userId && options.allowApiToken) {
        const apiToken = handler.event.headers?.['x-api-key'] || handler.event.headers?.['X-Api-Key'];
        
        if (apiToken) {
          try {
            // Hash the token for storage (we never store raw tokens)
            const hashedToken = createHash('sha256').update(apiToken).digest('hex');
            
            // Look up the token in DynamoDB
            const tokenData = await docClient.send(new GetCommand({
              TableName: process.env.TOKENS_TABLE!,
              Key: { token: hashedToken }
            }));
            
            if (tokenData.Item && tokenData.Item.active && (!tokenData.Item.expiresAt || tokenData.Item.expiresAt > Date.now())) {
              userId = tokenData.Item.userId;
              
              // Update last used timestamp
              await docClient.send(new UpdateCommand({
                TableName: process.env.TOKENS_TABLE!,
                Key: { token: hashedToken },
                UpdateExpression: 'SET lastUsed = :now',
                ExpressionAttributeValues: {
                  ':now': new Date().toISOString()
                }
              }));
            }
          } catch (error) {
            console.error('Error validating API token:', error);
          }
        }
      }
      
      // If no valid API token, check for AWS IAM authentication
      if (!userId) {
        // The cognitoIdentityId is set by API Gateway when using AWS_IAM authorizer
        userId = handler.event.requestContext?.identity?.cognitoIdentityId;
      }
      
      // Check if authentication is required
      if (options.requireAuth && !userId) {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify({
            message: 'Unauthorized: Valid authentication required'
          })
        };
      }
      
      // Attach userId and userEmail to event for downstream use
      if (userId) {
        handler.event.userId = userId;
      }
      if (userEmail) {
        handler.event.userEmail = userEmail;
      }
    }
  };
};

// Middleware for AWS_IAM only endpoints
export const iamOnlyMiddleware = () => {
  return dualAuthMiddleware({ requireAuth: true, allowApiToken: false });
};