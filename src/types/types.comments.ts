import type Author from "./types.author";

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  postId: string;
  author: Author;
};

export default Comment;
