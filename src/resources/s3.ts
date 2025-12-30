export const s3Buckets = {
  AssetsBucket: {
    Type: 'AWS::S3::Bucket',
    DeletionPolicy: 'Retain',
    UpdateReplacePolicy: 'Retain',
    Properties: {
      BucketName: 'mkpdfs-${self:provider.stage}-bucket',
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
          }
        ]
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: false,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: false
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
  },
  AssetsBucketPolicy: {
    Type: 'AWS::S3::BucketPolicy',
    Properties: {
      Bucket: { Ref: 'AssetsBucket' },
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadMarketplaceThumbnails',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: {
              'Fn::Sub': '${AssetsBucket.Arn}/marketplace/thumbnails/*'
            }
          },
          {
            Sid: 'PublicReadMarketplaceThumbnailsFull',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: {
              'Fn::Sub': '${AssetsBucket.Arn}/marketplace/thumbnails-full/*'
            }
          }
        ]
      }
    }
  }
};