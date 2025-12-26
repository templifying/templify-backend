import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export type ValidatedAPIGatewayProxyEvent<S = null> = APIGatewayProxyEvent & { body: S; userId?: string };
export type ValidatedEventAPIGatewayProxyEvent<S = null> = (
  event: ValidatedAPIGatewayProxyEvent<S>,
  context: Context
) => Promise<APIGatewayProxyResult>;

export const formatJSONResponse = (response: Record<string, any>, statusCode = 200): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response)
  };
};

export const formatErrorResponse = (error: any, statusCode = 500): APIGatewayProxyResult => {
  console.error('Error:', error);
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      message: error.message || 'An error occurred',
      error: process.env.STAGE === 'dev' ? error : undefined
    })
  };
};