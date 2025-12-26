export default {
  handler: 'src/functions/user/deleteToken/handler.main',
  events: [
    {
      http: {
        method: 'delete',
        path: 'user/tokens/{tokenId}',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};