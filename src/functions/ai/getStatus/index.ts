export default {
  handler: 'src/functions/ai/getStatus/handler.main',
  timeout: 10,
  memorySize: 256,
  events: [
    {
      http: {
        method: 'get',
        path: 'ai/jobs/{jobId}',
        authorizer: {
          type: 'COGNITO_USER_POOLS',
          authorizerId: { Ref: 'ApiGatewayAuthorizer' }
        },
        cors: true
      }
    }
  ]
};
