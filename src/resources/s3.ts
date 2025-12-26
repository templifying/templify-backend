export const s3Buckets = {
  AssetsBucket: {
    Type: 'AWS::S3::Bucket',
    Properties: {
      BucketName: 'templify-${self:provider.stage}-assets',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }
        ]
      },
      VersioningConfiguration: {
        Status: 'Enabled'
      },
      LifecycleConfiguration: {
        Rules: [
          {
            Id: 'DeleteOldPDFs',
            Status: 'Enabled',
            Prefix: 'pdfs/',
            ExpirationInDays: 30
          },
          {
            Id: 'TransitionOldPDFsToIA',
            Status: 'Enabled',
            Prefix: 'pdfs/',
            Transitions: [
              {
                TransitionInDays: 7,
                StorageClass: 'STANDARD_IA'
              }
            ]
          }
        ]
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposedHeaders: ['ETag'],
            MaxAge: 3000
          }
        ]
      }
    }
  }
};