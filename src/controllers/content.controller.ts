import { Request, Response } from "express";
import { connect } from "../database/database";
import { GoogleGenerativeAI } from "@google/generative-ai";

let prisma: any;

(async () => {
  prisma = await connect();
})();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Enhanced content moderation using Google Gemini
const moderateContent = async (
  content: string,
): Promise<{ isAppropriate: boolean; reason?: string; categories?: any }> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Analyze the following content for appropriateness and safety. Check for:
    - Hate speech or harassment
    - Violence or threats
    - Sexual content
    - Spam or scam content
    - Illegal activities
    - Drug-related content
    - Gambling content

    Content to analyze: "${content}"

    Respond with a JSON object in this exact format:
    {
      "isAppropriate": boolean,
      "reason": "explanation if inappropriate, null if appropriate",
      "categories": {
        "hate": boolean,
        "violence": boolean,
        "sexual": boolean,
        "spam": boolean,
        "illegal": boolean,
        "drugs": boolean,
        "gambling": boolean
      }
    }
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
      const parsedResult = JSON.parse(text);
      return parsedResult;
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", text);
      return basicContentModeration(content);
    }
  } catch (error: any) {
    console.error("Gemini moderation error:", error);
    return basicContentModeration(content);
  }
};

// Fallback basic content moderation
const basicContentModeration = (
  content: string,
): { isAppropriate: boolean; reason?: string } => {
  const inappropriateWords = [
    "spam",
    "scam",
    "hate",
    "violence",
    "drugs",
    "illegal",
    "porn",
    "sex",
    "nude",
    "naked",
    "adult",
    "gambling",
    "gamble",
    "casino",
    "fuck",
    "shit",
    "bullshit",
    "asshole",
    "nigga",
    "motherfucker",
    "motherfuck",
  ];

  const lowerContent = content.toLowerCase();

  for (const word of inappropriateWords) {
    if (lowerContent.includes(word)) {
      return {
        isAppropriate: false,
        reason: `Contains inappropriate content: ${word}`,
      };
    }
  }

  return { isAppropriate: true };
};

// Enhanced image content moderation using Google Gemini
const moderateImage = async (
  imageUrl: string,
): Promise<{
  isAppropriate: boolean;
  reason?: string;
  confidence?: number;
  categories?: any;
}> => {
  try {
    // First check if image is accessible
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { isAppropriate: false, reason: "Image not accessible" };
    }

    const imageBuffer = await response.arrayBuffer();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Analyze this image for safety and appropriateness. Check for:
    - Sexual or adult content
    - Violence or graphic content
    - Hate symbols or offensive material
    - Illegal activities
    - Inappropriate content for general audiences

    Respond with a JSON object in this exact format:
    {
      "isAppropriate": boolean,
      "reason": "explanation if inappropriate, null if appropriate",
      "confidence": number between 0 and 1,
      "categories": {
        "sexual": boolean,
        "violence": boolean,
        "hate": boolean,
        "illegal": boolean,
        "inappropriate": boolean
      }
    }
    `;

    const imagePart = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString("base64"),
        mimeType: response.headers.get("content-type") || "image/jpeg"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const geminiResponse =  result.response;
    const text = geminiResponse.text();

    try {
      const parsedResult = JSON.parse(text);
      return {
        isAppropriate: parsedResult.isAppropriate,
        reason: parsedResult.reason,
        confidence: parsedResult.confidence || 0.8,
        categories: parsedResult.categories
      };
    } catch (parseError) {
      console.error("Failed to parse Gemini image response:", text);
      return {
        isAppropriate: true,
        reason: "Could not analyze image content - assuming safe",
        confidence: 0.5,
      };
    }
  } catch (error: any) {
    console.error("Gemini image moderation error:", error);

    // Fallback: just check if image is accessible
    try {
      const response = await fetch(imageUrl, { method: "HEAD" });
      if (!response.ok) {
        return { isAppropriate: false, reason: "Image not accessible" };
      }

      return {
        isAppropriate: true,
        reason: "Could not analyze image content - assuming safe",
        confidence: 0.5,
      };
    } catch (fetchError) {
      return { isAppropriate: false, reason: "Failed to validate image" };
    }
  }
};

export const moderatePost = async (req: Request, res: Response) => {
  try {
    const { content, imageUrls } = req.body;

    if (!content && (!imageUrls || imageUrls.length === 0)) {
      return res
        .status(400)
        .json({ error: "No content or images provided for moderation" });
    }

    let contentResult: any = { isAppropriate: true, reason: "", categories: {} };
    let imageResults: Array<{ url: string; result: any }> = [];

    // Moderate text content if provided
    if (content) {
      contentResult = await moderateContent(content);
    }

    // Moderate images if provided
    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        const result = await moderateImage(imageUrl);
        imageResults.push({ url: imageUrl, result });
      }
    }

    const hasInappropriateImages = imageResults.some(
      (img) => !img.result.isAppropriate,
    );
    const isAppropriate =
      contentResult.isAppropriate && !hasInappropriateImages;

    res.json({
      isAppropriate,
      content: contentResult,
      images: imageResults,
      recommendation: isAppropriate ? "approve" : "reject",
      categories: contentResult.categories,
    });
  } catch (error: any) {
    console.error("Content moderation error:", error);
    res
      .status(500)
      .json({ error: "Content moderation failed: " + error.message });
  }
};

// Export individual moderation functions
export { moderateContent, moderateImage };