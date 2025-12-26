import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const uploadTemplate: ValidatedEventAPIGatewayProxyEvent<any> = async () => {
  return formatJSONResponse({ message: 'Upload template not implemented yet' });
};

export const main = middyfy(uploadTemplate)
  .use(iamOnlyMiddleware());