import { connect } from "../database/database";

let prisma: any;

(async () => {
  prisma = await connect();
})();

export const extractMentions = (content: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1] ?? "Unknown User");
  }

  return mentions;
};

export const saveMentions = async (
  mentions: string[],
  postId?: string,
  commentId?: string,
) => {
  if (mentions.length === 0) return;

  const mentionPromises = mentions.map((username) =>
    prisma.mention.create({
      data: {
        username,
        postId: postId || null,
        commentId: commentId || null,
      },
    }),
  );

  await Promise.all(mentionPromises);
};

export const parseMentionsToNames = async (
  content: string,
): Promise<string> => {
  // Updated regex to match @[displayName](userId) format
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let parsedContent = content;
  const matches = [...content.matchAll(mentionRegex)];

  if (!matches.length) return content;

  // Extract user IDs from mentions (from the parentheses part)
  const userIds = matches.map((match) => match[2]); // match[2] is the userId in parentheses

  // Fetch users by IDs
  const users = await prisma.user.findMany({
    where: { uid: { in: userIds } },
    select: { uid: true, name: true, username: true },
  });

  // Replace mentions with actual names
  users.forEach((user: any) => {
    // Find the original mention pattern for this user
    const mentionPattern = new RegExp(`@\\[([^\\]]+)\\]\\(${user.uid}\\)`, "g");
    parsedContent = parsedContent.replace(
      mentionPattern,
      `${user.name || "@" + user.username}`,
    );
  });

  return parsedContent;
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

export const processContentForMentionsAndHashtags = async (
  content: string,
  prisma: any,
) => {
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
