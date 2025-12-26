import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { dualAuthMiddleware } from '@libs/middleware/dualAuth';

const generatePdfAsync: ValidatedEventAPIGatewayProxyEvent<any> = async () => {
  return formatJSONResponse({ message: 'Async PDF generation not implemented yet' });
};

export const main = middyfy(generatePdfAsync)
  .use(dualAuthMiddleware({ allowApiToken: true }));