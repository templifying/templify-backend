export default {
  handler: 'src/functions/templates/listTemplates/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'templates',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};