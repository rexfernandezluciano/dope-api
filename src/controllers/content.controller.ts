
import { Request, Response } from 'express';
import { connect } from '../database/database';

let prisma: any;

(async () => {
  prisma = await connect();
})();

// Simple content moderation using keyword filtering
const moderateContent = (content: string): { isAppropriate: boolean; reason?: string } => {
  const inappropriateWords = [
    'spam', 'scam', 'hate', 'violence', 'drugs', 'illegal',
    'porn', 'sex', 'nude', 'naked', 'adult', 'gambling', 'gamble', 'casino', 'fuck', 'shit', 'bullshit', 'asshole', 'nigga', 'motherfucker', 'motherfuck'
  ];

  const lowerContent = content.toLowerCase();
  
  for (const word of inappropriateWords) {
    if (lowerContent.includes(word)) {
      return { isAppropriate: false, reason: `Contains inappropriate content: ${word}` };
    }
  }

  // Check for excessive repetition (spam)
  const words = content.split(' ');
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size < words.length * 0.3) {
    return { isAppropriate: false, reason: 'Detected spam-like repetition' };
  }

  return { isAppropriate: true };
};

// Simple image content check (placeholder for AI integration)
const moderateImage = async (imageUrl: string): Promise<{ isAppropriate: boolean; reason?: string }> => {
  // This is a placeholder - in production, you'd integrate with services like:
  // - Google Cloud Vision API
  // - Amazon Rekognition
  // - Microsoft Azure Computer Vision
  
  try {
    // For now, just check if the URL is accessible
    const response = await fetch(imageUrl, { method: 'HEAD' });
    if (!response.ok) {
      return { isAppropriate: false, reason: 'Image not accessible' };
    }
    
    // Placeholder logic - in real implementation, use AI service
    return { isAppropriate: true };
  } catch (error) {
    return { isAppropriate: false, reason: 'Failed to validate image' };
  }
};

export const moderatePost = async (req: Request, res: Response) => {
  try {
    const { content, imageUrls } = req.body;

    let contentResult = { isAppropriate: true };
    let imageResults: Array<{ url: string; result: any }> = [];

    // Moderate text content
    if (content) {
      contentResult = moderateContent(content);
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
    res.status(500).json({ error: 'Content moderation failed: ' + error.message });
  }
};

export { moderateContent, moderateImage };
