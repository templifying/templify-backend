export default {
  handler: 'src/functions/user/createToken/handler.main',
  events: [
    {
      http: {
        method: 'post',
        path: 'user/tokens',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};