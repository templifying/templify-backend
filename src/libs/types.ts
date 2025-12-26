import { APIGatewayProxyEvent } from 'aws-lambda';

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  userId?: string;
  subscription?: any;
  subscriptionLimits?: any;
  currentUsage?: any;
}