export default {
  handler: 'src/functions/templates/deleteTemplate/handler.main',
  events: [
    {
      http: {
        method: 'delete',
        path: 'templates/{templateId}',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};