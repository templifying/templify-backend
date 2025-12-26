import { formatJSONResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';

const handler = async () => {
  return formatJSONResponse({ message: 'Not implemented yet' });
};

export const main = middyfy(handler);
