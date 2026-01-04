export const sqsQueues = {
  // Dead Letter Queue for failed PDF generation jobs
  PdfGenerationDLQ: {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: 'mkpdfs-${self:provider.stage}-pdf-generation-dlq',
      MessageRetentionPeriod: 1209600 // 14 days
    }
  },

  // Main PDF generation queue
  PdfGenerationQueue: {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: 'mkpdfs-${self:provider.stage}-pdf-generation',
      VisibilityTimeout: 360, // 6 minutes (longer than Lambda timeout)
      MessageRetentionPeriod: 345600, // 4 days
      ReceiveMessageWaitTimeSeconds: 20, // Long polling
      RedrivePolicy: {
        deadLetterTargetArn: { 'Fn::GetAtt': ['PdfGenerationDLQ', 'Arn'] },
        maxReceiveCount: 3 // Move to DLQ after 3 failures
      }
    }
  },

  // Dead Letter Queue for failed AI generation jobs
  AIGenerationDLQ: {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: 'mkpdfs-${self:provider.stage}-ai-generation-dlq',
      MessageRetentionPeriod: 1209600 // 14 days
    }
  },

  // AI template generation queue (longer timeout for Claude API calls)
  AIGenerationQueue: {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: 'mkpdfs-${self:provider.stage}-ai-generation',
      VisibilityTimeout: 600, // 10 minutes (AI generation can take 30+ seconds)
      MessageRetentionPeriod: 345600, // 4 days
      ReceiveMessageWaitTimeSeconds: 20, // Long polling
      RedrivePolicy: {
        deadLetterTargetArn: { 'Fn::GetAtt': ['AIGenerationDLQ', 'Arn'] },
        maxReceiveCount: 2 // Move to DLQ after 2 failures (AI calls are expensive)
      }
    }
  }
};
