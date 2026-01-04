export default {
  handler: 'src/functions/ai/getImageUploadUrl/handler.main',
  timeout: 10,
  memorySize: 256,
  events: [
    {
      http: {
        method: 'post',
        path: 'ai/image-upload-url',
        authorizer: {
          type: 'COGNITO_USER_POOLS',
          authorizerId: { Ref: 'ApiGatewayAuthorizer' }
        },
        cors: true
      }
    }
  ]
};
