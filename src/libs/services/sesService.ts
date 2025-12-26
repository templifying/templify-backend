import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({});

interface SendPdfEmailOptions {
  recipients: string[];
  pdfBuffer: Buffer;
  pdfUrl: string;
  fileName: string;
}

export class SESService {
  private readonly MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@templify.com';
  
  async sendPdfEmail(options: SendPdfEmailOptions): Promise<void> {
    const { recipients, pdfBuffer, pdfUrl, fileName } = options;
    const fileSizeMB = pdfBuffer.length / (1024 * 1024);
    
    let emailContent: string;
    
    if (pdfBuffer.length <= this.MAX_ATTACHMENT_SIZE) {
      // Send with attachment
      emailContent = this.createEmailWithAttachment({
        recipients,
        subject: `Your PDF is ready: ${fileName}`,
        htmlBody: this.getAttachmentEmailTemplate(fileName, fileSizeMB),
        textBody: `Your PDF has been generated and is attached to this email.\n\nYou can also download it from: ${pdfUrl}\n\n(Link expires in 5 days)`,
        attachmentName: fileName,
        attachmentData: pdfBuffer
      });
    } else {
      // Send link only
      emailContent = this.createEmailWithLink({
        recipients,
        subject: `Your PDF is ready: ${fileName}`,
        htmlBody: this.getLinkEmailTemplate(fileName, fileSizeMB, pdfUrl),
        textBody: `Your PDF has been generated.\n\nDownload it here: ${pdfUrl}\n\nNote: The file is too large (${fileSizeMB.toFixed(2)} MB) to attach directly.\n\nImportant: This link expires in 5 days.`
      });
    }
    
    await sesClient.send(new SendRawEmailCommand({
      RawMessage: {
        Data: Buffer.from(emailContent)
      }
    }));
  }
  
  private createEmailWithAttachment(options: {
    recipients: string[];
    subject: string;
    htmlBody: string;
    textBody: string;
    attachmentName: string;
    attachmentData: Buffer;
  }): string {
    const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const message = [
      `From: Templify <${this.FROM_EMAIL}>`,
      `To: ${options.recipients.join(', ')}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: multipart/alternative; boundary="alt-' + boundary + '"',
      '',
      `--alt-${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.textBody,
      '',
      `--alt-${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.htmlBody,
      '',
      `--alt-${boundary}--`,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${options.attachmentName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${options.attachmentName}"`,
      '',
      options.attachmentData.toString('base64'),
      '',
      `--${boundary}--`
    ].join('\r\n');
    
    return message;
  }
  
  private createEmailWithLink(options: {
    recipients: string[];
    subject: string;
    htmlBody: string;
    textBody: string;
  }): string {
    const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const message = [
      `From: Templify <${this.FROM_EMAIL}>`,
      `To: ${options.recipients.join(', ')}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.textBody,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      options.htmlBody,
      '',
      `--${boundary}--`
    ].join('\r\n');
    
    return message;
  }
  
  private getAttachmentEmailTemplate(fileName: string, fileSizeMB: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .file-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your PDF is Ready!</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Your PDF has been successfully generated and is attached to this email.</p>
      
      <div class="file-info">
        <strong>📎 File:</strong> ${fileName}<br>
        <strong>📊 Size:</strong> ${fileSizeMB.toFixed(2)} MB
      </div>
      
      <p>The PDF is attached to this email for your convenience. You can also download it using the secure link provided in the plain text version of this email.</p>
      
      <p style="margin-top: 30px; font-style: italic; color: #6c757d;">
        This is an automated message from Templify. Please do not reply to this email.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Templify. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }
  
  private getLinkEmailTemplate(fileName: string, fileSizeMB: number, url: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .file-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your PDF is Ready!</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>Your PDF has been successfully generated.</p>
      
      <div class="warning">
        <strong>⚠️ Note:</strong> The file is too large (${fileSizeMB.toFixed(2)} MB) to attach directly to this email. 
        Please use the download button below.
      </div>
      
      <div class="file-info">
        <strong>📄 File:</strong> ${fileName}<br>
        <strong>📊 Size:</strong> ${fileSizeMB.toFixed(2)} MB
      </div>
      
      <div style="text-align: center;">
        <a href="${url}" class="button">Download PDF</a>
      </div>
      
      <p style="margin-top: 20px; color: #dc3545;">
        <strong>Important:</strong> This download link will expire in 5 days. 
        Please download your file before then.
      </p>
      
      <p style="margin-top: 30px; font-style: italic; color: #6c757d;">
        This is an automated message from Templify. Please do not reply to this email.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Templify. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }
}