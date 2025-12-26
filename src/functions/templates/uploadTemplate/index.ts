export default {
  handler: 'src/functions/templates/uploadTemplate/handler.main',
  events: [
    {
      http: {
        method: 'post',
        path: 'templates',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};