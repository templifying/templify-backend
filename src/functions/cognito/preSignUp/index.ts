export default {
  handler: 'src/functions/cognito/preSignUp/handler.main',
  events: [
    {
      cognitoUserPool: {
        pool: { Ref: 'CognitoUserPool' },
        trigger: 'PreSignUp' as const,
        existing: true
      }
    }
  ]
};
