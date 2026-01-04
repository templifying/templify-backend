export default {
  handler: 'src/functions/ai/processGeneration/handler.main',
  timeout: 300, // 5 minutes for AI generation
  memorySize: 1024,
  reservedConcurrency: 5, // Limit concurrent executions (AI calls are expensive)
  events: [
    {
      sqs: {
        arn: { 'Fn::GetAtt': ['AIGenerationQueue', 'Arn'] },
        batchSize: 1, // Process one at a time (AI generation is resource intensive)
        maximumBatchingWindow: 0 // Process immediately
      }
    }
  ]
};
