
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

    // Prepare input array for omni-moderation API
    const input: any[] = [];
    
    // Add text content if provided
    if (content) {
      input.push({ type: "text", text: content });
    }
    
    // Add images if provided
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        input.push({
          type: "image_url",
          image_url: { url: imageUrl }
        });
      }
    }

    if (input.length === 0) {
      return res.status(400).json({ error: 'No content or images provided for moderation' });
    }

    // Use omni-moderation API for combined text and image analysis
    const moderation = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: input,
    });

    const result = moderation.results[0];
    let contentResult = { isAppropriate: true, reason: '', categories: {} };
    let imageResults: Array<{ url: string; result: any }> = [];

    if (result && result.flagged) {
      const flaggedCategories = Object.keys(result.categories).filter(
        category => result.categories[category as keyof typeof result.categories]
      );
      
      // Check which input types triggered each category
      const textFlags = Object.keys(result.category_applied_input_types).filter(
        category => result.category_applied_input_types[category as keyof typeof result.category_applied_input_types]?.includes('text')
      );
      
      const imageFlags = Object.keys(result.category_applied_input_types).filter(
        category => result.category_applied_input_types[category as keyof typeof result.category_applied_input_types]?.includes('image')
      );

      // Set content result
      if (textFlags.length > 0) {
        contentResult = {
          isAppropriate: false,
          reason: `Text flagged for: ${textFlags.join(', ')}`,
          categories: result.categories
        };
      }

      // Set image results
      if (imageUrls && imageUrls.length > 0) {
        for (const imageUrl of imageUrls) {
          if (imageFlags.length > 0) {
            imageResults.push({
              url: imageUrl,
              result: {
                isAppropriate: false,
                reason: `Image flagged for: ${imageFlags.join(', ')}`,
                categories: result.categories
              }
            });
          } else {
            imageResults.push({
              url: imageUrl,
              result: {
                isAppropriate: true,
                categories: result.categories
              }
            });
          }
        }
      }
    } else {
      // Not flagged - all content is appropriate
      contentResult = {
        isAppropriate: true,
        reason: '',
        categories: result?.categories || {}
      };

      if (imageUrls && imageUrls.length > 0) {
        for (const imageUrl of imageUrls) {
          imageResults.push({
            url: imageUrl,
            result: {
              isAppropriate: true,
              categories: result?.categories || {}
            }
          });
        }
      }
    }

    const hasInappropriateImages = imageResults.some(img => !img.result.isAppropriate);
    const isAppropriate = contentResult.isAppropriate && !hasInappropriateImages;

    res.json({
      isAppropriate,
      content: contentResult,
      images: imageResults,
      recommendation: isAppropriate ? 'approve' : 'reject',
      categories: result?.categories || {}
    });
  } catch (error: any) {
    console.error('Content moderation error:', error);
    
    // Fallback to individual moderation if omni-moderation fails
    try {
      const { content, imageUrls } = req.body;
      let contentResult = { isAppropriate: true };
      let imageResults: Array<{ url: string; result: any }> = [];

      if (content) {
        contentResult = await moderateContent(content);
      }

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
        recommendation: isAppropriate ? 'approve' : 'reject',
        fallback: true
      });
    } catch (fallbackError: any) {
      res.status(500).json({ error: 'Content moderation failed: ' + fallbackError.message });
    }
  }
};

// Export individual moderation functions
export { moderateContent, moderateImage };
