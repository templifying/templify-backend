export default {
  handler: 'src/functions/user/listTokens/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'user/tokens',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};