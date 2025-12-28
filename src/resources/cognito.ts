export const cognitoResources = {
  CognitoUserPool: {
    Type: 'AWS::Cognito::UserPool',
    Properties: {
      UserPoolName: 'mkpdfs-${self:provider.stage}-user-pool',
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
      Schema: [
        {
          Name: 'email',
          AttributeDataType: 'String',
          Required: true,
          Mutable: true
        },
        {
          Name: 'name',
          AttributeDataType: 'String',
          Required: false,
          Mutable: true
        }
      ],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
          RequireUppercase: true
        }
      },
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
      UserPoolAddOns: {
        AdvancedSecurityMode: 'ENFORCED'
      },
      AccountRecoverySetting: {
        RecoveryMechanisms: [
          {
            Name: 'verified_email',
            Priority: 1
          }
        ]
      }
    }
  },

  // Cognito Hosted UI Domain (required for OAuth flows)
  CognitoUserPoolDomain: {
    Type: 'AWS::Cognito::UserPoolDomain',
    Properties: {
      Domain: 'auth-mkpdfs-${self:provider.stage}',
      UserPoolId: { Ref: 'CognitoUserPool' }
    }
  },

  // Google Identity Provider
  CognitoUserPoolIdentityProviderGoogle: {
    Type: 'AWS::Cognito::UserPoolIdentityProvider',
    Properties: {
      UserPoolId: { Ref: 'CognitoUserPool' },
      ProviderName: 'Google',
      ProviderType: 'Google',
      ProviderDetails: {
        client_id: '{{resolve:secretsmanager:mkpdfs/google-oauth/${self:provider.stage}:SecretString:client_id}}',
        client_secret: '{{resolve:secretsmanager:mkpdfs/google-oauth/${self:provider.stage}:SecretString:client_secret}}',
        authorize_scopes: 'openid email profile'
      },
      AttributeMapping: {
        email: 'email',
        name: 'name',
        picture: 'picture',
        given_name: 'given_name',
        family_name: 'family_name'
      }
    }
  },

  CognitoUserPoolClient: {
    Type: 'AWS::Cognito::UserPoolClient',
    DependsOn: ['CognitoUserPoolIdentityProviderGoogle'],
    Properties: {
      ClientName: 'mkpdfs-${self:provider.stage}-web-client',
      UserPoolId: {
        Ref: 'CognitoUserPool'
      },
      ExplicitAuthFlows: [
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH'
      ],
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
      SupportedIdentityProviders: ['COGNITO', 'Google'],
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile', 'aws.cognito.signin.user.admin'],
      AllowedOAuthFlowsUserPoolClient: true,
      CallbackURLs: [
        'http://localhost:3000/callback',
        'https://mkpdfs.com/callback'
      ],
      LogoutURLs: [
        'http://localhost:3000/logout',
        'https://mkpdfs.com/logout'
      ],
      RefreshTokenValidity: 30,
      AccessTokenValidity: 60,
      IdTokenValidity: 60,
      TokenValidityUnits: {
        AccessToken: 'minutes',
        IdToken: 'minutes',
        RefreshToken: 'days'
      }
    }
  },

  CognitoIdentityPool: {
    Type: 'AWS::Cognito::IdentityPool',
    Properties: {
      IdentityPoolName: 'mkpdfs_${self:provider.stage}_identity_pool',
      AllowUnauthenticatedIdentities: false,
      CognitoIdentityProviders: [
        {
          ClientId: {
            Ref: 'CognitoUserPoolClient'
          },
          ProviderName: {
            'Fn::GetAtt': ['CognitoUserPool', 'ProviderName']
          }
        }
      ]
    }
  },

  CognitoIdentityPoolRoles: {
    Type: 'AWS::Cognito::IdentityPoolRoleAttachment',
    Properties: {
      IdentityPoolId: {
        Ref: 'CognitoIdentityPool'
      },
      Roles: {
        authenticated: {
          'Fn::GetAtt': ['CognitoAuthRole', 'Arn']
        }
      }
    }
  },

  CognitoAuthRole: {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Federated: 'cognito-identity.amazonaws.com'
            },
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': {
                  Ref: 'CognitoIdentityPool'
                }
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'authenticated'
              }
            }
          }
        ]
      },
      Policies: [
        {
          PolicyName: 'CognitoAuthorizedPolicy',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'mobileanalytics:PutEvents',
                  'cognito-sync:*',
                  'cognito-identity:*'
                ],
                Resource: '*'
              },
              {
                Effect: 'Allow',
                Action: [
                  'execute-api:Invoke'
                ],
                Resource: [
                  {
                    'Fn::Sub': 'arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:*/*'
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }
};
