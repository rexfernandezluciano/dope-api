
export const extractMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1] ?? "");
  }
  
  return [...new Set(mentions)]; // Remove duplicates
};

export const extractHashtags = (content: string): string[] => {
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1]?.toLowerCase() ?? "");
  }
  
  return [...new Set(hashtags)]; // Remove duplicates
};

export const processContentForMentionsAndHashtags = async (content: string, prisma: any) => {
  const mentions = extractMentions(content);
  const hashtags = extractHashtags(content);
  
  // Validate mentioned users exist
  const validMentions: string[] = [];
  if (mentions.length > 0) {
    const users = await prisma.user.findMany({
      where: { username: { in: mentions } },
      select: { username: true },
    });
    validMentions.push(...users.map((u: any) => u.username));
  }
  
  return { mentions: validMentions, hashtags };
};
