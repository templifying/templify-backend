export default {
  handler: 'src/functions/user/getProfile/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'user/profile',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};