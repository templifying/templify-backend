export default {
  handler: 'src/functions/marketplace/useTemplate/handler.main',
  events: [
    {
      http: {
        method: 'post',
        path: 'marketplace/templates/{templateId}/use',
        authorizer: 'aws_iam',
        cors: true
      }
    }
  ]
};
