import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';
import { subscriptionMiddleware } from '@libs/middleware/subscription';
import { checkAILimitsMiddleware } from '@libs/middleware/aiLimits';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import type { QuestionAnswer } from '@libs/services/bedrockService';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sqsClient = new SQSClient({});

// Get SQS queue URL - handle cases where CloudFormation refs aren't resolved (e.g., sls offline)
const getQueueUrl = (): string => {
  const queueUrl = process.env.AI_GENERATION_QUEUE_URL;

  // If it's a valid URL string, use it directly
  if (typeof queueUrl === 'string' && queueUrl.startsWith('https://')) {
    return queueUrl;
  }

  // CloudFormation ref not resolved - construct the real AWS URL
  const region = process.env.REGION || 'us-east-1';
  const stage = process.env.STAGE || 'dev';
  const queueName = `mkpdfs-${stage}-ai-generation`;

  return `https://sqs.${region}.amazonaws.com/197837191835/${queueName}`;
};

interface SubmitAIJobRequest {
  // Job type: 'analysis' for first step (get questions), 'generation' for second step (create template)
  // Defaults to 'generation' for backward compatibility
  jobType?: 'analysis' | 'generation';
  prompt: string;
  templateType?: string;
  // Option 1: Direct base64 (for small images < 500KB)
  imageBase64?: string;
  imageMediaType?: 'image/png' | 'image/jpeg' | 'image/webp';
  // Option 2: S3 key (for large images, uploaded via presigned URL)
  imageS3Key?: string;
  // For 'generation' jobs - reference to analysis job and user's answers
  analysisJobId?: string;
  answers?: QuestionAnswer[];
  // Legacy iteration support (for refining generated templates)
  previousTemplate?: string;
  feedback?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_IMAGE_SIZE_BASE64 = 500 * 1024 * 1.34; // ~670KB base64 for 500KB binary (reduced to stay under API Gateway limit)

const submitAIJob: ValidatedEventAPIGatewayProxyEvent<SubmitAIJobRequest> = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    const userId = event.userId!;
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const {
      jobType = 'generation', // Default for backward compatibility
      prompt,
      templateType,
      imageBase64,
      imageMediaType,
      imageS3Key,
      analysisJobId,
      answers,
      previousTemplate,
      feedback
    } = body;

    console.log('[submitAIJob] Request:', {
      userId,
      jobType,
      hasPrompt: !!prompt,
      hasBase64Image: !!imageBase64,
      hasS3Image: !!imageS3Key,
      hasAnalysisJobId: !!analysisJobId,
      hasAnswers: !!answers
    });

    // Validate job type
    if (jobType !== 'analysis' && jobType !== 'generation') {
      return formatJSONResponse({
        success: false,
        error: 'INVALID_JOB_TYPE',
        message: 'Job type must be "analysis" or "generation"'
      }, 400);
    }

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return formatJSONResponse({
        success: false,
        error: 'INVALID_PROMPT',
        message: 'A prompt is required to generate a template'
      }, 400);
    }

    if (prompt.length < 10) {
      return formatJSONResponse({
        success: false,
        error: 'PROMPT_TOO_SHORT',
        message: 'Please provide a more detailed description (at least 10 characters)'
      }, 400);
    }

    if (prompt.length > 2000) {
      return formatJSONResponse({
        success: false,
        error: 'PROMPT_TOO_LONG',
        message: 'Prompt is too long. Please keep it under 2000 characters.'
      }, 400);
    }

    // Validate image - either base64 or S3 key, not both
    if (imageBase64 && imageS3Key) {
      return formatJSONResponse({
        success: false,
        error: 'INVALID_IMAGE_SOURCE',
        message: 'Provide either imageBase64 or imageS3Key, not both'
      }, 400);
    }

    // Validate base64 image if provided
    if (imageBase64) {
      if (!imageMediaType || !ALLOWED_IMAGE_TYPES.includes(imageMediaType as typeof ALLOWED_IMAGE_TYPES[number])) {
        return formatJSONResponse({
          success: false,
          error: 'INVALID_IMAGE_TYPE',
          message: 'Image must be PNG, JPEG, or WebP format'
        }, 400);
      }

      if (imageBase64.length > MAX_IMAGE_SIZE_BASE64) {
        return formatJSONResponse({
          success: false,
          error: 'IMAGE_TOO_LARGE',
          message: 'Base64 image too large. Please use S3 upload for images over 500KB.'
        }, 400);
      }

      if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        return formatJSONResponse({
          success: false,
          error: 'INVALID_IMAGE_DATA',
          message: 'Invalid image data format'
        }, 400);
      }
    }

    // Validate S3 key if provided
    if (imageS3Key) {
      // Ensure the S3 key belongs to the user and is in the correct folder
      if (!imageS3Key.startsWith(`users/${userId}/ai-images/`)) {
        return formatJSONResponse({
          success: false,
          error: 'INVALID_S3_KEY',
          message: 'Invalid image S3 key'
        }, 400);
      }
    }

    const hasImage = !!(imageBase64 || imageS3Key);

    // Generate job ID
    const jobId = uuidv4();
    const now = new Date().toISOString();

    // Create job record in DynamoDB
    const jobRecord: Record<string, unknown> = {
      jobId,
      userId,
      jobType, // NEW: 'analysis' or 'generation'
      status: 'pending',
      prompt,
      templateType: templateType || null,
      hasImage,
      imageSource: imageBase64 ? 'base64' : (imageS3Key ? 's3' : null),
      imageS3Key: imageS3Key || null, // Store S3 key for retrieval
      // Generation job specific fields
      analysisJobId: analysisJobId || null,
      answers: answers || null,
      // Legacy iteration support
      previousTemplate: previousTemplate || null,
      feedback: feedback || null,
      createdAt: now,
      updatedAt: now
    };

    await docClient.send(new PutCommand({
      TableName: process.env.AI_JOBS_TABLE,
      Item: jobRecord
    }));

    console.log('[submitAIJob] Job created in DynamoDB:', { jobId, userId, jobType, status: 'pending' });

    // Send message to SQS queue (include full data for processing)
    const queueUrl = getQueueUrl();
    console.log('[submitAIJob] Sending to SQS:', { queueUrl, jobType });

    await sqsClient.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        jobId,
        userId,
        jobType, // NEW
        prompt,
        templateType,
        imageBase64,
        imageMediaType,
        imageS3Key,
        analysisJobId, // NEW
        answers, // NEW
        previousTemplate,
        feedback
      })
    }));

    console.log('[submitAIJob] SQS message sent successfully');

    // Build status URL
    const baseUrl = process.env.FRONTEND_URL?.replace('https://', 'https://apis.').replace('.mkpdfs.com', '.apis.mkpdfs.com') ||
      `https://${process.env.STAGE === 'prod' ? '' : process.env.STAGE + '.'}apis.mkpdfs.com`;
    const statusUrl = `${baseUrl}/ai/jobs/${jobId}`;

    return formatJSONResponse({
      success: true,
      jobId,
      jobType, // NEW: Return job type in response
      status: 'pending',
      statusUrl,
      message: jobType === 'analysis'
        ? 'AI analysis job submitted - questions will be generated'
        : 'AI template generation job submitted successfully'
    }, 202);
  } catch (error) {
    console.error('Error submitting AI job:', error);
    return formatErrorResponse(error as Error);
  }
};

// Note: Usage tracking happens when job completes (in processGeneration)
export const main = middyfy(submitAIJob)
  .use(iamOnlyMiddleware())
  .use(subscriptionMiddleware())
  .use(checkAILimitsMiddleware());
