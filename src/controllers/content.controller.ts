
import { Request, Response } from 'express';
import { connect } from '../database/database';
import OpenAI from 'openai';

let prisma: any;

(async () => {
  prisma = await connect();
})();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced content moderation using OpenAI
const moderateContent = async (content: string): Promise<{ isAppropriate: boolean; reason?: string; categories?: any }> => {
  try {
    // Use OpenAI moderation API
    const moderation = await openai.moderations.create({
      input: content,
      model: "omni-moderation-latest"
    });

    const result = moderation.results[0];
    
    if (result && result.flagged) {
      const flaggedCategories = Object.keys(result.categories).filter(
        category => result.categories[category as keyof typeof result.categories]
      );
      
      return {
        isAppropriate: false,
        reason: `Content flagged for: ${flaggedCategories.join(', ')}`,
        categories: result.categories
      };
    }

    // Fallback to keyword filtering for additional protection
    const inappropriateWords = [
      'spam', 'scam', 'hate', 'violence', 'drugs', 'illegal',
      'porn', 'sex', 'nude', 'naked', 'adult', 'gambling', 'gamble', 'casino'
    ];

    const lowerContent = content.toLowerCase();
    
    for (const word of inappropriateWords) {
      if (lowerContent.includes(word)) {
        return { 
          isAppropriate: false, 
          reason: `Contains inappropriate content: ${word}` 
        };
      }
    }

    // Check for excessive repetition (spam)
    const words = content.split(' ');
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size < words.length * 0.3) {
      return { 
        isAppropriate: false, 
        reason: 'Detected spam-like repetition' 
      };
    }

    return { isAppropriate: true };
  } catch (error: any) {
    console.error('OpenAI moderation error:', error);
    // Fallback to basic keyword filtering if OpenAI fails
    return basicContentModeration(content);
  }
};

// Fallback basic content moderation
const basicContentModeration = (content: string): { isAppropriate: boolean; reason?: string } => {
  const inappropriateWords = [
    'spam', 'scam', 'hate', 'violence', 'drugs', 'illegal',
    'porn', 'sex', 'nude', 'naked', 'adult', 'gambling', 'gamble', 'casino', 
    'fuck', 'shit', 'bullshit', 'asshole', 'nigga', 'motherfucker', 'motherfuck'
  ];

  const lowerContent = content.toLowerCase();
  
  for (const word of inappropriateWords) {
    if (lowerContent.includes(word)) {
      return { isAppropriate: false, reason: `Contains inappropriate content: ${word}` };
    }
  }

  return { isAppropriate: true };
};

// Enhanced image content moderation using OpenAI omni-moderation
const moderateImage = async (imageUrl: string): Promise<{ isAppropriate: boolean; reason?: string; confidence?: number; categories?: any }> => {
  try {
    // First check if image is accessible
    const response = await fetch(imageUrl, { method: 'HEAD' });
    if (!response.ok) {
      return { isAppropriate: false, reason: 'Image not accessible' };
    }

    // Use OpenAI omni-moderation API for image analysis
    const moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: [
        {
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        }
      ],
    });

    const result = moderation.results[0];
    
    if (result && result.flagged) {
      const flaggedCategories = Object.keys(result.categories).filter(
        category => result.categories[category as keyof typeof result.categories]
      );
      
      // Calculate confidence based on highest category score
      const maxScore = Math.max(...Object.values(result.category_scores));
      
      return {
        isAppropriate: false,
        reason: `Image flagged for: ${flaggedCategories.join(', ')}`,
        confidence: maxScore,
        categories: result.categories
      };
    }

    // If not flagged, consider it safe
    return { 
      isAppropriate: true, 
      confidence: 0.95,
      categories: result?.categories 
    };

  } catch (error: any) {
    console.error('OpenAI image moderation error:', error);
    
    // Fallback: just check if image is accessible
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (!response.ok) {
        return { isAppropriate: false, reason: 'Image not accessible' };
      }
      
      // If we can't analyze with AI, be more conservative
      return { 
        isAppropriate: true, 
        reason: 'Could not analyze image content - assuming safe',
        confidence: 0.5 
      };
    } catch (fetchError) {
      return { isAppropriate: false, reason: 'Failed to validate image' };
    }
  }
};

export const moderatePost = async (req: Request, res: Response) => {
  try {
    const { content, imageUrls } = req.body;

    let contentResult = { isAppropriate: true };
    let imageResults: Array<{ url: string; result: any }> = [];

    // Moderate text content
    if (content) {
      contentResult = await moderateContent(content);
    }

    // Moderate images
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const result = await moderateImage(imageUrl);
        imageResults.push({ url: imageUrl, result });
      }
    }

    const hasInappropriateImages = imageResults.some(img => !img.result.isAppropriate);
    const isAppropriate = contentResult.isAppropriate && !hasInappropriateImages;

    res.json({
      isAppropriate,
      content: contentResult,
      images: imageResults,
      recommendation: isAppropriate ? 'approve' : 'reject'
    });
  } catch (error: any) {
    console.error('Content moderation error:', error);
    res.status(500).json({ error: 'Content moderation failed: ' + error.message });
  }
};

// Export individual moderation functions
export { moderateContent, moderateImage };
