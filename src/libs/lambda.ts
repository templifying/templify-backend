import middy from '@middy/core';
import middyJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';

export const middyfy = (handler: any) => {
  return middy(handler)
    .use(middyJsonBodyParser())
    .use(httpErrorHandler());
};