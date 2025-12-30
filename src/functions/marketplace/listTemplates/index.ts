export default {
  handler: 'src/functions/marketplace/listTemplates/handler.main',
  events: [
    {
      http: {
        method: 'get',
        path: 'marketplace/templates',
        cors: true
      }
    }
  ]
};
