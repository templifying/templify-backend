export default {
  handler: 'src/functions/marketplace/getTemplate/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'marketplace/templates/{templateId}',
        cors: true
      }
    }
  ]
};
