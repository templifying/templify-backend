import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface SubscriptionLimits {
  pdfGenerationsPerMonth: number;
  templatesAllowed: number;
  apiTokensAllowed: number;
  maxPdfSizeMB: number;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionLimits> = {
  free: {
    pdfGenerationsPerMonth: 100,
    templatesAllowed: 5,
    apiTokensAllowed: 1,
    maxPdfSizeMB: 10
  },
  starter: {
    pdfGenerationsPerMonth: 1000,
    templatesAllowed: 50,
    apiTokensAllowed: 3,
    maxPdfSizeMB: 25
  },
  professional: {
    pdfGenerationsPerMonth: 10000,
    templatesAllowed: 500,
    apiTokensAllowed: 10,
    maxPdfSizeMB: 50
  },
  enterprise: {
    pdfGenerationsPerMonth: -1, // unlimited
    templatesAllowed: -1, // unlimited
    apiTokensAllowed: -1, // unlimited
    maxPdfSizeMB: 100
  }
};

export const subscriptionMiddleware = () => {
  return {
    before: async (handler: any): Promise<any> => {
      const userId = handler.event.userId;
      
      if (!userId) {
        return; // No user, let other middleware handle auth
      }
      
      try {
        // Get subscription data
        const subscriptionData = await docClient.send(new GetCommand({
          TableName: process.env.SUBSCRIPTIONS_TABLE!,
          Key: { userId }
        }));
        
        let subscription = subscriptionData.Item;
        
        // If no subscription, create a free tier subscription
        if (!subscription) {
          subscription = {
            userId,
            plan: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          await docClient.send(new UpdateCommand({
            TableName: process.env.SUBSCRIPTIONS_TABLE!,
            Key: { userId },
            UpdateExpression: 'SET #plan = :plan, #status = :status, createdAt = :createdAt, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#plan': 'plan',
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':plan': 'free',
              ':status': 'active',
              ':createdAt': subscription.createdAt,
              ':updatedAt': subscription.updatedAt
            }
          }));
        }
        
        // Check if subscription is active
        if (subscription.status !== 'active') {
          return {
            statusCode: 402,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify({
              message: 'Subscription is not active',
              subscriptionStatus: subscription.status
            })
          };
        }
        
        // Get current month's usage
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format
        const usageData = await docClient.send(new GetCommand({
          TableName: process.env.USAGE_TABLE!,
          Key: { 
            userId,
            yearMonth: currentMonth
          }
        }));
        
        const usage = usageData.Item || {
          userId,
          yearMonth: currentMonth,
          pdfCount: 0,
          totalSizeMB: 0
        };
        
        // Attach subscription and usage to event
        handler.event.subscription = subscription;
        handler.event.subscriptionLimits = SUBSCRIPTION_PLANS[subscription.plan] || SUBSCRIPTION_PLANS.free;
        handler.event.currentUsage = usage;
        
      } catch (error) {
        console.error('Error checking subscription:', error);
        // Don't fail the request, just use free tier limits
        handler.event.subscription = { plan: 'free', status: 'active' };
        handler.event.subscriptionLimits = SUBSCRIPTION_PLANS.free;
        handler.event.currentUsage = { pdfCount: 0, totalSizeMB: 0 };
      }
    }
  };
};