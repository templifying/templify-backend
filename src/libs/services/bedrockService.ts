import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Handlebars from 'handlebars';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

// Register Handlebars helpers for validation (same as pdfService)
Handlebars.registerHelper('ifEq', function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  return a === b ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('gt', function (a: number, b: number) {
  return a > b;
});

Handlebars.registerHelper('formatDate', function (date: unknown) {
  if (!date) return '';
  const d = new Date(date as string | number | Date);
  return d.toLocaleDateString();
});

Handlebars.registerHelper('formatCurrency', function (amount: number) {
  if (typeof amount !== 'number') return amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
});

// ============================================
// Analysis Types (Two-Step Flow)
// ============================================

export interface StructuredQuestion {
  id: string;
  category: 'fields' | 'images' | 'tables' | 'layout';
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'boolean';
  options?: string[];
  defaultValue?: string | string[] | boolean;
  required: boolean;
  helperText?: string;
}

export interface QuestionAnswer {
  questionId: string;
  value: string | string[] | boolean;
}

export interface ImageAnalysis {
  detectedFields: string[];
  suggestedLayout: string;
  documentType: string;
}

export interface AnalyzeTemplateOptions {
  prompt: string;
  templateType?: string;
  image?: {
    data: string;
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
}

export interface AnalysisResult {
  questions: StructuredQuestion[];
  imageAnalysis?: ImageAnalysis;
}

// ============================================
// Generation Types
// ============================================

export interface AnalysisContext {
  questions: StructuredQuestion[];
  answers: QuestionAnswer[];
  imageAnalysis?: ImageAnalysis;
}

export interface GenerateTemplateOptions {
  prompt: string;
  templateType?: string;
  image?: {
    data: string;      // Base64 without data URL prefix
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  };
  // Two-step flow context
  analysisContext?: AnalysisContext;
  // Legacy iteration support
  previousTemplate?: string;
  feedback?: string;
}

export interface GeneratedTemplate {
  template: {
    content: string;
    name: string;
    description: string;
  };
  sampleData: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are an expert PDF template designer specializing in Handlebars templates with print-optimized CSS. Your templates are professional, well-structured, and follow best practices.

WHEN GIVEN A REFERENCE IMAGE:
1. Analyze the layout structure (headers, footers, columns, sections, grids)
2. Identify typography choices (font sizes, weights, spacing, hierarchy)
3. Recognize color schemes and apply them consistently using CSS
4. Replicate the visual hierarchy, alignment, and spacing as closely as possible
5. Convert any placeholder text or data fields to appropriate Handlebars variables
6. Ensure the generated template captures the design intent while being fully data-driven
7. If the image shows a table or list, use {{#each}} helpers appropriately
8. Match the aspect ratio and page layout (portrait/landscape) shown in the image

WHEN GIVEN FEEDBACK ON A PREVIOUS TEMPLATE:
1. Carefully analyze the feedback and identify specific changes requested
2. Preserve parts of the template that were not mentioned in the feedback
3. Apply the requested changes while maintaining overall consistency
4. Ensure the updated template still compiles and works with similar data structure

AVAILABLE HANDLEBARS HELPERS:
- {{#ifEq a b}}...{{else}}...{{/ifEq}} - Conditional equality check
- {{#gt a b}}...{{/gt}} - Greater than comparison (returns boolean)
- {{formatDate date}} - Formats date to locale string
- {{formatCurrency amount}} - Formats number as USD currency
- {{#each items}}...{{/each}} - Iterate over arrays

TEMPLATE REQUIREMENTS:
1. Use semantic HTML5 with proper print CSS
2. Include @media print styles for page breaks, margins
3. Use CSS Grid or Flexbox for layouts
4. Include @page rules for PDF sizing (A4 default)
5. Ensure all dynamic content uses Handlebars {{variable}} syntax
6. Support array iteration with {{#each items}}
7. Include conditional rendering for optional fields

CSS REQUIREMENTS:
- Use print-friendly fonts (system fonts stack)
- Include proper page-break-before, page-break-after, page-break-inside rules
- Set appropriate margins for printing
- Use border-collapse: collapse for tables
- Keep styling clean and professional

OUTPUT FORMAT:
You MUST return ONLY a valid JSON object with exactly this structure (no markdown, no explanation):
{
  "template": "<!-- Full Handlebars HTML template here -->",
  "sampleData": { /* Matching JSON data with realistic values */ },
  "suggestedName": "template-name-in-kebab-case",
  "description": "Brief description of the template"
}

IMPORTANT:
- The template must be valid Handlebars syntax
- The sampleData must contain all variables used in the template
- Generate realistic sample data (real-looking names, dates, amounts)
- Do not include any text outside the JSON object`;

const ANALYSIS_SYSTEM_PROMPT = `You are an expert PDF template analyst. Your job is to analyze user requirements and ask targeted clarifying questions to ensure the generated template perfectly matches their needs.

Your goal is to generate 5-7 CRITICAL clarifying questions that will help create the perfect template. Focus only on ambiguities and missing information - don't ask obvious questions.

WHEN GIVEN A REFERENCE IMAGE:
1. Identify all visible fields and data areas in the image
2. Determine the document type (invoice, report, certificate, letter, etc.)
3. Identify layout structure (headers, tables, columns, footers)
4. Note any images/logos - are they static branding or dynamic content?
5. List detected fields in your response

QUESTION CATEGORIES (cover the most relevant ones):
1. FIELDS: Which fields are required vs optional? How to handle null/empty values? (show placeholder, hide, show "N/A"?)
2. IMAGES: Are logos/images static (baked into template) or dynamic (provided at PDF generation time)?
3. TABLES: If there are line items - what's the expected row count? How to handle empty tables?
4. LAYOUT: Page size (A4/Letter), orientation, special margin requirements?

QUESTION TYPES:
- single_choice: Radio buttons, user picks one option
- multiple_choice: Checkboxes, user can pick multiple options
- boolean: Yes/No toggle
- text: Free-form text input (use sparingly)

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no explanation):
{
  "questions": [
    {
      "id": "q1",
      "category": "fields",
      "question": "Human-readable question text?",
      "type": "single_choice",
      "options": ["Option A", "Option B", "Option C"],
      "defaultValue": "Option A",
      "required": true,
      "helperText": "Brief context if needed"
    }
  ],
  "imageAnalysis": {
    "detectedFields": ["Field 1", "Field 2", "Field 3"],
    "suggestedLayout": "A4 Portrait with header and footer",
    "documentType": "Invoice"
  }
}

RULES:
- Generate 5-7 questions maximum - focus on critical ambiguities only
- imageAnalysis is REQUIRED if an image was provided, omit if no image
- Each question must have a unique id (q1, q2, etc.)
- Provide sensible defaultValue when possible
- helperText is optional - only include if it adds value
- Make options clear and mutually exclusive for single_choice
- Do not ask about styling preferences (colors, fonts) - those come from the image/prompt`;

export class BedrockService {
  // Use Claude Sonnet 4.5 via US inference profile (cross-region)
  private modelId = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

  // Timeout for Bedrock API calls (2 minutes) - prevents hung calls from blocking for full Lambda timeout
  private readonly BEDROCK_TIMEOUT_MS = 120000;

  async generateTemplate(options: GenerateTemplateOptions): Promise<GeneratedTemplate> {
    const { prompt, templateType, image, analysisContext, previousTemplate, feedback } = options;

    // Build multimodal content array
    const content: Array<{ type: string; [key: string]: unknown }> = [];

    // Add image if provided (must come before text for Claude)
    if (image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.data
        }
      });
    }

    // Build text prompt
    let userPrompt = '';

    if (image) {
      userPrompt += `I've provided a reference image. Please analyze this design and create a PDF template that matches its layout, styling, and structure as closely as possible.\n\n`;
    }

    userPrompt += `Create a professional PDF template based on this description:\n\n"${prompt}"\n\n`;

    if (templateType) {
      userPrompt += `Template type: ${templateType}\n`;
    }

    // Add analysis context if provided (two-step flow)
    if (analysisContext) {
      userPrompt += `\n--- REQUIREMENTS CLARIFICATION ---\n`;
      userPrompt += `The user has answered the following clarifying questions:\n\n`;

      for (const question of analysisContext.questions) {
        const answer = analysisContext.answers.find(a => a.questionId === question.id);
        if (answer) {
          const answerValue = Array.isArray(answer.value)
            ? answer.value.join(', ')
            : String(answer.value);
          userPrompt += `Q: ${question.question}\nA: ${answerValue}\n\n`;
        }
      }

      if (analysisContext.imageAnalysis) {
        userPrompt += `\nImage Analysis Results:\n`;
        userPrompt += `- Document Type: ${analysisContext.imageAnalysis.documentType}\n`;
        userPrompt += `- Suggested Layout: ${analysisContext.imageAnalysis.suggestedLayout}\n`;
        userPrompt += `- Detected Fields: ${analysisContext.imageAnalysis.detectedFields.join(', ')}\n`;
      }

      userPrompt += `\nPlease use these requirements when generating the template.\n--- END REQUIREMENTS ---\n`;
    }

    // Add iteration context if refining a previous template
    if (previousTemplate && feedback) {
      userPrompt += `\n--- ITERATION MODE ---\nHere is the previous version of the template:\n\`\`\`html\n${previousTemplate}\n\`\`\`\n\nUser feedback: "${feedback}"\n\nPlease improve the template based on this feedback while preserving parts that weren't mentioned.\n--- END ITERATION ---\n`;
    }

    userPrompt += `\nGenerate the template following all requirements in your instructions. The sample data should be realistic and demonstrate all template features including any array iterations and conditional sections.`;

    content.push({ type: 'text', text: userPrompt });

    // Create abort controller with timeout to prevent hung calls
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.BEDROCK_TIMEOUT_MS);

    let response;
    try {
      response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [
              { role: 'user', content }
            ]
          })
        }),
        { abortSignal: abortController.signal }
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Bedrock API call timed out after ${this.BEDROCK_TIMEOUT_MS / 1000} seconds`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const responseContent = responseBody.content[0]?.text;

    console.log('Bedrock response stats:', {
      hasContent: !!responseContent,
      contentLength: responseContent?.length || 0,
      stopReason: responseBody.stop_reason
    });

    if (!responseContent) {
      console.error('No content in AI response:', JSON.stringify(responseBody).substring(0, 500));
      throw new Error('No content in AI response');
    }

    try {
      return this.parseAndValidateResponse(responseContent);
    } catch (parseError) {
      console.error('Parse/validation error:', {
        error: (parseError as Error).message,
        responsePreview: responseContent.substring(0, 1000)
      });
      throw parseError;
    }
  }

  private parseAndValidateResponse(content: string): GeneratedTemplate {
    // Try to extract JSON from the response
    let jsonContent = content.trim();

    // Handle markdown code blocks if present
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object directly
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    let parsed: {
      template: string;
      sampleData: Record<string, unknown>;
      suggestedName: string;
      description: string;
    };

    try {
      parsed = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse AI response as JSON: ${(error as Error).message}`);
    }

    // Validate required fields
    if (!parsed.template || typeof parsed.template !== 'string') {
      throw new Error('AI response missing valid template field');
    }

    if (!parsed.sampleData || typeof parsed.sampleData !== 'object') {
      throw new Error('AI response missing valid sampleData field');
    }

    if (!parsed.suggestedName || typeof parsed.suggestedName !== 'string') {
      throw new Error('AI response missing valid suggestedName field');
    }

    // Validate Handlebars syntax
    try {
      Handlebars.compile(parsed.template);
    } catch (error) {
      throw new Error(`Generated template has invalid Handlebars syntax: ${(error as Error).message}`);
    }

    // Validate sample data works with template
    try {
      const compiledTemplate = Handlebars.compile(parsed.template);
      compiledTemplate(parsed.sampleData);
    } catch (error) {
      throw new Error(`Sample data does not match template: ${(error as Error).message}`);
    }

    return {
      template: {
        content: parsed.template,
        name: parsed.suggestedName,
        description: parsed.description || ''
      },
      sampleData: parsed.sampleData
    };
  }

  // ============================================
  // Analysis Method (Two-Step Flow)
  // ============================================

  async analyzeTemplate(options: AnalyzeTemplateOptions): Promise<AnalysisResult> {
    const { prompt, templateType, image } = options;

    // Build multimodal content array
    const content: Array<{ type: string; [key: string]: unknown }> = [];

    // Add image if provided (must come before text for Claude)
    if (image) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.data
        }
      });
    }

    // Build text prompt
    let userPrompt = '';

    if (image) {
      userPrompt += `I've provided a reference image of the template I want to create. Please analyze this image to understand the layout, fields, and structure.\n\n`;
    }

    userPrompt += `I want to create a PDF template based on this description:\n\n"${prompt}"\n\n`;

    if (templateType) {
      userPrompt += `Template type: ${templateType}\n\n`;
    }

    userPrompt += `Please analyze my requirements and generate clarifying questions to help create the perfect template. Focus on critical ambiguities - don't ask obvious questions.`;

    content.push({ type: 'text', text: userPrompt });

    // Create abort controller with timeout to prevent hung calls
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.BEDROCK_TIMEOUT_MS);

    let response;
    try {
      response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: this.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 4096,
            system: ANALYSIS_SYSTEM_PROMPT,
            messages: [
              { role: 'user', content }
            ]
          })
        }),
        { abortSignal: abortController.signal }
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Bedrock API call timed out after ${this.BEDROCK_TIMEOUT_MS / 1000} seconds`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const responseContent = responseBody.content[0]?.text;

    console.log('Bedrock analysis response stats:', {
      hasContent: !!responseContent,
      contentLength: responseContent?.length || 0,
      stopReason: responseBody.stop_reason
    });

    if (!responseContent) {
      console.error('No content in AI analysis response:', JSON.stringify(responseBody).substring(0, 500));
      throw new Error('No content in AI analysis response');
    }

    try {
      return this.parseAndValidateAnalysisResponse(responseContent, !!image);
    } catch (parseError) {
      console.error('Analysis parse/validation error:', {
        error: (parseError as Error).message,
        responsePreview: responseContent.substring(0, 1000)
      });
      throw parseError;
    }
  }

  private parseAndValidateAnalysisResponse(content: string, hasImage: boolean): AnalysisResult {
    // Try to extract JSON from the response
    let jsonContent = content.trim();

    // Handle markdown code blocks if present
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to find JSON object directly
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonContent = objectMatch[0];
    }

    let parsed: {
      questions: StructuredQuestion[];
      imageAnalysis?: ImageAnalysis;
    };

    try {
      parsed = JSON.parse(jsonContent);
    } catch (error) {
      throw new Error(`Failed to parse AI analysis response as JSON: ${(error as Error).message}`);
    }

    // Validate questions array
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('AI analysis response missing questions array');
    }

    if (parsed.questions.length === 0) {
      throw new Error('AI analysis response has empty questions array');
    }

    if (parsed.questions.length > 10) {
      // Trim to 7 questions if too many
      parsed.questions = parsed.questions.slice(0, 7);
    }

    // Validate each question
    for (const q of parsed.questions) {
      if (!q.id || !q.question || !q.type || !q.category) {
        throw new Error(`Invalid question structure: ${JSON.stringify(q).substring(0, 100)}`);
      }

      // Validate question type
      if (!['single_choice', 'multiple_choice', 'text', 'boolean'].includes(q.type)) {
        throw new Error(`Invalid question type: ${q.type}`);
      }

      // Validate category
      if (!['fields', 'images', 'tables', 'layout'].includes(q.category)) {
        throw new Error(`Invalid question category: ${q.category}`);
      }

      // Ensure options exist for choice types
      if ((q.type === 'single_choice' || q.type === 'multiple_choice') && (!q.options || q.options.length === 0)) {
        throw new Error(`Question ${q.id} is ${q.type} but has no options`);
      }

      // Ensure required field has a default
      if (q.required === undefined) {
        q.required = true;
      }
    }

    // Validate imageAnalysis if image was provided
    if (hasImage && !parsed.imageAnalysis) {
      console.warn('Image was provided but no imageAnalysis in response');
      // Don't throw - make it optional
    }

    if (parsed.imageAnalysis) {
      if (!parsed.imageAnalysis.detectedFields || !Array.isArray(parsed.imageAnalysis.detectedFields)) {
        parsed.imageAnalysis.detectedFields = [];
      }
      if (!parsed.imageAnalysis.suggestedLayout) {
        parsed.imageAnalysis.suggestedLayout = 'A4 Portrait';
      }
      if (!parsed.imageAnalysis.documentType) {
        parsed.imageAnalysis.documentType = 'Document';
      }
    }

    return {
      questions: parsed.questions,
      imageAnalysis: parsed.imageAnalysis
    };
  }
}
