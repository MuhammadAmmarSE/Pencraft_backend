import { ToneType, CopyType } from '../../database/entities/rewrite-job.entity';

const TONE_DESCRIPTORS: Record<ToneType, string> = {
  [ToneType.PROFESSIONAL]: 'authoritative, polished, and trustworthy — suitable for B2B or premium DTC brands',
  [ToneType.FRIENDLY]: 'warm, conversational, and approachable — like a knowledgeable friend recommending a product',
  [ToneType.LUXURY]: 'elevated, aspirational, and exclusive — evoking premium craftsmanship and desirability',
  [ToneType.URGENT]: 'compelling and action-driven — creating genuine urgency without being pushy or manipulative',
  [ToneType.PLAYFUL]: 'witty, energetic, and fun — engaging without sacrificing clarity or conversion intent',
  [ToneType.MINIMALIST]: 'clean, precise, and confident — every word earns its place, no filler',
};

export class PromptBuilder {
  // ─── Product Description Prompt ──────────────────────────────────────────────
  static buildProductDescriptionPrompt(params: {
    productTitle: string;
    originalDescription?: string;
    tone: ToneType;
    keywords?: string[];
    includeSEO?: boolean;
    includeEmoji?: boolean;
    targetAudience?: string;
  }): string {
    const {
      productTitle,
      originalDescription,
      tone,
      keywords = [],
      includeSEO = true,
      includeEmoji = false,
      targetAudience,
    } = params;

    return `You are an expert ecommerce copywriter who has generated millions of dollars in product sales.
Your task is to write a high-converting product description for a Shopify store.

## Product Details
- Product Title: ${productTitle}
${originalDescription ? `- Original Description: ${originalDescription}` : '- No original description provided'}
${targetAudience ? `- Target Audience: ${targetAudience}` : ''}
${keywords.length > 0 ? `- Keywords to incorporate: ${keywords.join(', ')}` : ''}

## Tone & Style
Write in a ${TONE_DESCRIPTORS[tone]} tone.
${includeEmoji ? 'Use 1-3 relevant emojis sparingly to add visual breaks.' : 'Do NOT use emojis.'}

## Output Requirements
Write a product description that:
1. Opens with a compelling hook that speaks to the customer's desire or pain point
2. Highlights the top 3-4 benefits (not just features) using short, punchy sentences
3. Includes sensory or emotional language where appropriate
4. Ends with a subtle but clear call-to-action
5. Is between 80-150 words
6. Reads naturally — no fluff, no filler, no generic phrases like "high quality" or "perfect for"

${includeSEO ? `## SEO Requirements
Also provide:
- SEO Title: Under 60 characters, includes primary keyword naturally
- SEO Description: 140-160 characters, includes keyword, compelling and click-worthy` : ''}

## Output Format
Return ONLY a valid JSON object with this exact structure:
{
  "description": "the rewritten product description",
  "seoTitle": "${includeSEO ? 'seo optimized title' : ''}",
  "seoDescription": "${includeSEO ? 'seo meta description' : ''}",
  "keywordsUsed": ["keyword1", "keyword2"]
}

Do not include any explanation, preamble, or text outside the JSON.`;
  }

  // ─── Email Copy Prompt ────────────────────────────────────────────────────────
  static buildEmailPrompt(params: {
    emailType: string;
    productName?: string;
    context?: string;
    tone: ToneType;
    discountPercent?: number;
  }): string {
    const { emailType, productName, context, tone, discountPercent } = params;

    const emailTypeGuide: Record<string, string> = {
      abandoned_cart: 'Recover a customer who added items to cart but did not purchase. Create curiosity and urgency.',
      welcome: 'Welcome a new subscriber. Build brand affinity and set expectations. Drive first purchase.',
      win_back: 'Re-engage a customer who has not purchased in 90+ days. Acknowledge the gap, offer value.',
      promotional: 'Drive urgency around a sale or offer. Clear value proposition, strong CTA.',
      post_purchase: 'Delight a recent buyer. Reduce buyers remorse, encourage review, cross-sell gently.',
    };

    return `You are a world-class email copywriter specializing in ecommerce with a track record of 40%+ open rates.

## Email Brief
- Type: ${emailType}
- Goal: ${emailTypeGuide[emailType] || 'Drive engagement and conversion'}
${productName ? `- Product/Context: ${productName}` : ''}
${context ? `- Additional Context: ${context}` : ''}
${discountPercent ? `- Discount Offered: ${discountPercent}% off` : ''}

## Tone
Write in a ${TONE_DESCRIPTORS[tone]} tone.

## Requirements
- Subject Line: Under 50 characters. Curiosity or benefit-driven. No spam trigger words.
- Preview Text: 40-90 characters. Complements the subject without repeating it.
- Body: 80-120 words. Conversational, single focused message, one CTA.
- CTA Button Text: 2-5 words, action-oriented.

## Output Format
Return ONLY a valid JSON object:
{
  "subjectLine": "email subject line",
  "previewText": "preview text",
  "body": "full email body with line breaks as \\n",
  "ctaText": "CTA button text"
}

Do not include any explanation or text outside the JSON.`;
  }

  // ─── Ad Copy Prompt ───────────────────────────────────────────────────────────
  static buildAdCopyPrompt(params: {
    productTitle: string;
    productDescription?: string;
    platform: string;
    tone: ToneType;
    usps?: string[];
  }): string {
    const { productTitle, productDescription, platform, tone, usps = [] } = params;

    const platformGuide: Record<string, string> = {
      facebook: 'Facebook Feed Ad. Primary text up to 125 chars shown before truncation. Headline 27 chars max. Description 27 chars max.',
      instagram: 'Instagram Feed Ad. Caption-style primary text. Visual and lifestyle focused. Hashtag-friendly.',
      google: 'Google Responsive Search Ad. Headline 30 chars max (x3 variants). Description 90 chars max (x2 variants).',
      tiktok: 'TikTok Ad. Hook-first, energetic, native-feeling. Speaks to trend-aware Gen Z and Millennial audiences.',
    };

    return `You are an expert performance marketing copywriter specializing in paid social and search advertising.

## Product
- Name: ${productTitle}
${productDescription ? `- Description: ${productDescription}` : ''}
${usps.length > 0 ? `- Key Selling Points: ${usps.join(', ')}` : ''}

## Platform
${platformGuide[platform] || platform}

## Tone
${TONE_DESCRIPTORS[tone]}

## Requirements
Write 3 copy variants for A/B testing. Each variant should have a different angle:
1. Benefit-led (what it does for the customer)
2. Social proof / outcome-led (results or transformation)
3. Curiosity / pattern interrupt (stops the scroll)

## Output Format
Return ONLY a valid JSON object:
{
  "variants": [
    {
      "angle": "benefit-led",
      "headline": "headline text",
      "primaryText": "primary ad text",
      "description": "description text",
      "cta": "Shop Now"
    }
  ]
}

Do not include any explanation or text outside the JSON.`;
  }
}
