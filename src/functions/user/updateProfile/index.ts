export default {
  handler: 'src/functions/user/updateProfile/handler.main',
  events: [
    {
      http: {
        method: 'put',
        path: 'user/profile',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};