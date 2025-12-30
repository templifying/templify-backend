import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { dualAuthMiddleware } from '@libs/middleware/dualAuth';
import { subscriptionMiddleware } from '@libs/middleware/subscription';
import { checkLimitsMiddleware, usageTrackingMiddleware } from '@libs/middleware/usageTracking';
import { PdfService } from '@libs/services/pdfService';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({});
const pdfService = new PdfService();

interface GeneratePdfRequest {
  templateId: string;
  data: any;
  async?: boolean;
  sendEmail?: string[];
}

const generatePdf: ValidatedEventAPIGatewayProxyEvent<GeneratePdfRequest> = async (event, context) => {
  // Don't wait for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    const userId = event.userId!;
    const { templateId, data, async = false, sendEmail } = event.body;
    
    if (async) {
      // Invoke async Lambda
      const command = new InvokeCommand({
        FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-generatePdfAsync`,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
          userId,
          templateId,
          data,
          sendEmail
        }))
      });
      
      await lambdaClient.send(command);
      
      return formatJSONResponse({
        success: true,
        message: 'PDF generation started. You will receive an email when ready.',
        async: true
      });
    } else {
      // Generate PDF synchronously
      const result = await pdfService.generatePdf({
        userId,
        templateId,
        data,
        sendEmail
      });
      
      return formatJSONResponse({
        success: true,
        pdfUrl: result.url,
        expiresIn: '5 days',
        size: result.sizeBytes
      });
    }
  } catch (error) {
    return formatErrorResponse(error);
  }
};

export const main = middyfy(generatePdf)
  .use(dualAuthMiddleware())
  .use(subscriptionMiddleware())
  .use(checkLimitsMiddleware('pdf_generation'))
  .use(usageTrackingMiddleware({ actionType: 'pdf_generation' }));