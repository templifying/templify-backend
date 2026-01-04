export default {
  handler: 'src/functions/templates/getTemplate/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'templates/{templateId}',
        authorizer: {
          type: 'COGNITO_USER_POOLS',
          authorizerId: { Ref: 'ApiGatewayAuthorizer' }
        },
        cors: true
      }
    }
  ]
};
