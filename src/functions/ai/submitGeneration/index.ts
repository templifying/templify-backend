export default {
  handler: 'src/functions/ai/submitGeneration/handler.main',
  timeout: 30,
  memorySize: 256,
  events: [
    {
      http: {
        method: 'post',
        path: 'ai/generate-template-async',
        authorizer: {
          type: 'COGNITO_USER_POOLS',
          authorizerId: { Ref: 'ApiGatewayAuthorizer' }
        },
        cors: true
      }
    }
  ]
};
