import { ValidatedEventAPIGatewayProxyEvent, formatJSONResponse, formatErrorResponse } from '@libs/apiGateway';
import { middyfy } from '@libs/lambda';
import { iamOnlyMiddleware } from '@libs/middleware/dualAuth';
import { subscriptionMiddleware } from '@libs/middleware/subscription';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({});

interface GetUploadUrlRequest {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  filename?: string;
}

const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const getImageUploadUrl: ValidatedEventAPIGatewayProxyEvent<GetUploadUrlRequest> = async (event) => {
  try {
    const userId = event.userId!;
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { contentType, filename } = body;

    // Validate content type
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType as typeof ALLOWED_CONTENT_TYPES[number])) {
      return formatJSONResponse({
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content type must be image/png, image/jpeg, or image/webp'
      }, 400);
    }

    // Generate unique key for the image
    const extension = contentType.split('/')[1];
    const imageId = uuidv4();
    const s3Key = `users/${userId}/ai-images/${imageId}.${extension}`;

    // Generate presigned URL for upload (valid for 5 minutes)
    const command = new PutObjectCommand({
      Bucket: process.env.ASSETS_BUCKET,
      Key: s3Key,
      ContentType: contentType,
      // Metadata for tracking
      Metadata: {
        'user-id': userId,
        'original-filename': filename || 'unknown',
        'upload-purpose': 'ai-template-generation'
      }
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    console.log('[getImageUploadUrl] Generated presigned URL:', { userId, s3Key });

    return formatJSONResponse({
      success: true,
      uploadUrl,
      s3Key,
      expiresIn: 300,
      maxFileSize: MAX_FILE_SIZE
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return formatErrorResponse(error as Error);
  }
};

export const main = middyfy(getImageUploadUrl)
  .use(iamOnlyMiddleware())
  .use(subscriptionMiddleware());
