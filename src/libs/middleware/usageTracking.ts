import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface UsageTrackingOptions {
  actionType: 'pdf_generation' | 'template_upload' | 'token_creation' | 'ai_generation';
  sizeInBytes?: number;
}

export const usageTrackingMiddleware = (options: UsageTrackingOptions) => {
  return {
    after: async (handler: any) => {
      console.log('[UsageTracking] after hook triggered', {
        actionType: options.actionType,
        statusCode: handler.response?.statusCode,
        userId: handler.event.userId
      });

      // Only track successful requests
      if (handler.response?.statusCode !== 200) {
        console.log('[UsageTracking] Skipping - statusCode is not 200');
        return;
      }

      const userId = handler.event.userId;
      if (!userId) {
        console.log('[UsageTracking] Skipping - no userId');
        return;
      }
      
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM format

      try {
        const addExpressions: string[] = [];
        const setExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {};

        // Track different types of actions
        switch (options.actionType) {
          case 'pdf_generation':
            // Use pageCount from handler (each object in array = 1 page)
            const pageCount = handler.event.pageCount || 1;
            addExpressions.push('pdfCount :inc');
            expressionAttributeValues[':inc'] = pageCount;

            console.log('[UsageTracking] PDF generation - pages:', pageCount);

            if (options.sizeInBytes) {
              addExpressions.push('totalSizeBytes :size');
              expressionAttributeValues[':size'] = options.sizeInBytes;
            }
            break;

          case 'template_upload':
            addExpressions.push('templateUploads :inc');
            expressionAttributeValues[':inc'] = 1;
            break;

          case 'token_creation':
            addExpressions.push('tokensCreated :inc');
            expressionAttributeValues[':inc'] = 1;
            break;

          case 'ai_generation':
            addExpressions.push('aiGenerations :inc');
            expressionAttributeValues[':inc'] = 1;
            console.log('[UsageTracking] AI generation tracked');
            break;
        }

        // Update last activity timestamp
        setExpressions.push('lastActivity = :now');
        expressionAttributeValues[':now'] = new Date().toISOString();

        // Build proper UpdateExpression: "SET x = :x ADD y :y"
        const updateParts: string[] = [];
        if (setExpressions.length > 0) {
          updateParts.push(`SET ${setExpressions.join(', ')}`);
        }
        if (addExpressions.length > 0) {
          updateParts.push(`ADD ${addExpressions.join(', ')}`);
        }
        const updateExpression = updateParts.join(' ');

        // Update usage in DynamoDB
        console.log('[UsageTracking] Updating DynamoDB', {
          table: process.env.USAGE_TABLE,
          userId,
          yearMonth: currentMonth,
          updateExpression
        });

        await docClient.send(new UpdateCommand({
          TableName: process.env.USAGE_TABLE!,
          Key: {
            userId,
            yearMonth: currentMonth
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeValues: expressionAttributeValues
        }));

        console.log('[UsageTracking] Successfully updated usage');

      } catch (error) {
        console.error('[UsageTracking] Error tracking usage:', error);
        // Don't fail the request due to tracking errors
      }
    }
  };
};

// Helper to calculate page count from request data
const calculatePageCount = (data: any): number => {
  return Array.isArray(data) ? data.length : 1;
};

// Helper middleware to check limits before allowing action
export const checkLimitsMiddleware = (limitType: 'pdf_generation' | 'template_upload' | 'token_creation') => {
  return {
    before: async (handler: any): Promise<any> => {
      const limits = handler.event.subscriptionLimits;
      const usage = handler.event.currentUsage;

      if (!limits || !usage) {
        return; // Let request proceed if we don't have limit data
      }

      let exceeded = false;
      let message = '';
      let responseBody: Record<string, any> = {};

      switch (limitType) {
        case 'pdf_generation':
          // Calculate pages requested from request body
          const body = handler.event.body;
          const pagesRequested = body?.data ? calculatePageCount(body.data) : 1;
          const currentPages = usage.pdfCount || 0;
          const pageLimit = limits.pagesPerMonth;
          const pagesRemaining = pageLimit === -1 ? Infinity : pageLimit - currentPages;

          // Check if this request would exceed the limit
          if (pageLimit !== -1 && currentPages + pagesRequested > pageLimit) {
            exceeded = true;
            message = pagesRemaining <= 0
              ? `Monthly page limit reached (${pageLimit} pages)`
              : `Request would exceed monthly page limit. You have ${pagesRemaining} pages remaining but requested ${pagesRequested}.`;
            responseBody = {
              message,
              pagesRequested,
              pagesRemaining: Math.max(0, pagesRemaining),
              currentUsage: currentPages,
              limit: pageLimit,
              plan: handler.event.subscription?.plan
            };
          }
          break;

        case 'template_upload':
          // Would need to count templates from templates table
          break;

        case 'token_creation':
          // Would need to count tokens from tokens table
          break;
      }

      if (exceeded) {
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
          },
          body: JSON.stringify(responseBody)
        };
      }
    }
  };
};