export default {
  handler: 'src/functions/user/getUsage/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'user/usage',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};