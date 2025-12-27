// User management functions (AWS_IAM only)
export { default as getUserProfile } from './user/getProfile';
export { default as updateUserProfile } from './user/updateProfile';
export { default as listUserTokens } from './user/listTokens';
export { default as createUserToken } from './user/createToken';
export { default as deleteUserToken } from './user/deleteToken';
export { default as getUserUsage } from './user/getUsage';

// Template management functions (AWS_IAM only)
export { default as listUserTemplates } from './templates/listTemplates';
export { default as uploadTemplate } from './templates/uploadTemplate';
export { default as deleteTemplate } from './templates/deleteTemplate';

// PDF generation functions (Dual auth)
export { default as generatePdf } from './pdf/generate';
export { default as generatePdfAsync } from './pdf/generateAsync';

// Note: Cognito trigger functions (preSignUp, postConfirmation) are defined
// but not exported to Serverless to avoid CloudFormation circular dependencies.
// Lambda triggers will be added manually via AWS CLI after deployment.