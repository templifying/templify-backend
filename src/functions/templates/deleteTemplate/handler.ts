import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';

const deleteTemplate: ValidatedEventAPIGatewayProxyEvent<null> = async () => {
  return formatJSONResponse({ message: 'Delete template not implemented yet' });
};

export const main = middyfy(deleteTemplate)
  .use(iamOnlyMiddleware());