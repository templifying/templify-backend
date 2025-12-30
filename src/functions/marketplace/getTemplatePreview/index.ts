export default {
  handler: 'src/functions/marketplace/getTemplatePreview/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'marketplace/templates/{templateId}/preview',
        cors: true
      }
    }
  ]
};
