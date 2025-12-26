# Templify API - Multi-User SaaS PDF Generation Service

A serverless API for multi-user PDF generation with template management, built on AWS Lambda.

## Architecture

- **Multi-User**: Each user has isolated templates and PDFs
- **Dual Authentication**: AWS IAM (web app) and API tokens (programmatic access)
- **Usage Tracking**: Per-user limits based on subscription tiers
- **Serverless**: Built with Serverless Framework and AWS Lambda

## Quick Start

### Prerequisites

1. AWS CLI configured with credentials
2. Node.js 20.x
3. Serverless Framework CLI: `npm install -g serverless`

### Installation

```bash
npm install

# Install Puppeteer layer dependencies
cd layers/puppeteer && npm install && cd ../..
```

### Local Development

```bash
# Run offline
npm run offline

# Type check
npm run typecheck
```

### Deployment

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

## API Endpoints

### User Management (AWS_IAM only)
- `GET /user/profile` - Get user profile and subscription
- `GET /user/tokens` - List API tokens
- `POST /user/tokens` - Create new API token
- `DELETE /user/tokens/{tokenId}` - Delete API token
- `GET /user/usage` - Get usage statistics

### Template Management (AWS_IAM only)
- `GET /templates` - List user templates
- `POST /templates` - Upload new template
- `DELETE /templates/{templateId}` - Delete template

### PDF Generation (Dual auth - AWS_IAM or API token)
- `POST /pdf/generate` - Generate PDF synchronously
- `POST /pdf/generate-async` - Generate PDF asynchronously

## Authentication

### Web Application (AWS_IAM)
Uses AWS Amplify with Cognito for authentication. Requests are automatically signed.

### API Access (Token)
Include API token in request header:
```
X-Api-Key: tlfy_your_token_here
```

## Usage Example

### Generate PDF with API Token

```bash
curl -X POST https://api.templify.com/pdf/generate \
  -H "X-Api-Key: tlfy_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "invoice-001",
    "data": {
      "customerName": "John Doe",
      "amount": 100.00
    },
    "sendEmail": ["customer@example.com"]
  }'
```

## Subscription Tiers

- **Free**: 100 PDFs/month, 5 templates, 1 API token
- **Starter**: 1,000 PDFs/month, 50 templates, 3 API tokens
- **Professional**: 10,000 PDFs/month, 500 templates, 10 API tokens
- **Enterprise**: Unlimited

## Environment Variables

The following are automatically configured:
- `USERS_TABLE` - DynamoDB table for users
- `TOKENS_TABLE` - DynamoDB table for API tokens
- `USAGE_TABLE` - DynamoDB table for usage tracking
- `ASSETS_BUCKET` - S3 bucket for templates and PDFs
- `FROM_EMAIL` - SES verified email address

## Next Steps

1. **Configure SES**: Verify your domain/email in AWS SES
2. **Set up Cognito**: Configure Google OAuth in the Cognito User Pool
3. **Custom Domain**: Update `customDomain` in serverless.ts
4. **Deploy**: Run `npm run deploy:dev` to deploy

## Project Structure

```
templify-api/
├── src/
│   ├── functions/       # Lambda functions
│   ├── libs/           # Shared libraries
│   └── resources/      # AWS resource definitions
├── layers/
│   └── puppeteer/      # Chromium layer
├── serverless.ts       # Serverless configuration
└── package.json
```