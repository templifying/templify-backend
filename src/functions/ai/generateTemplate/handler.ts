import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';
import { subscriptionMiddleware } from '@libs/middleware/subscription';
import { checkAILimitsMiddleware } from '@libs/middleware/aiLimits';
import { usageTrackingMiddleware } from '@libs/middleware/usageTracking';
import { BedrockService } from '@libs/services/bedrockService';

const bedrockService = new BedrockService();

interface GenerateTemplateBody {
  prompt: string;
  templateType?: string;
}

const generateTemplate: ValidatedEventAPIGatewayProxyEvent<GenerateTemplateBody> = async (event: any) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { prompt, templateType } = body;

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

    // Generate template using Bedrock
    const result = await bedrockService.generateTemplate({
      prompt,
      templateType
    });

    // Calculate remaining generations after this one
    const aiGenerationsRemaining = event.aiGenerationsRemaining;
    const remaining = aiGenerationsRemaining === -1
      ? -1  // unlimited
      : Math.max(0, aiGenerationsRemaining - 1);

    return formatJSONResponse({
      success: true,
      template: result.template,
      sampleData: result.sampleData,
      remainingGenerations: remaining
    });

  } catch (error: any) {
    console.error('Error generating template:', error);

    // Handle specific Bedrock errors
    if (error.name === 'ThrottlingException') {
      return formatJSONResponse({
        success: false,
        error: 'SERVICE_BUSY',
        message: 'AI service is temporarily busy. Please try again in a moment.',
        retryable: true
      }, 503);
    }

    if (error.name === 'ModelTimeoutException') {
      return formatJSONResponse({
        success: false,
        error: 'TIMEOUT',
        message: 'AI generation timed out. Please try with a simpler prompt.',
        retryable: true
      }, 504);
    }

    // Handle validation errors
    if (error.message?.includes('Invalid Handlebars') ||
        error.message?.includes('Failed to parse')) {
      return formatJSONResponse({
        success: false,
        error: 'GENERATION_FAILED',
        message: 'Failed to generate a valid template. Please try rephrasing your prompt.',
        retryable: true
      }, 422);
    }

    return formatErrorResponse(error);
  }
};

export const main = middyfy(generateTemplate)
  .use(iamOnlyMiddleware())
  .use(subscriptionMiddleware())
  .use(checkAILimitsMiddleware())
  .use(usageTrackingMiddleware({ actionType: 'ai_generation' }));
