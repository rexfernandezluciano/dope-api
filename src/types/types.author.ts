type Author = {
  uid: string;
  name: string;
  username: string;
  photoURL: string;
  hasBlueCheck: boolean;
  isFollowedByCurrentUser: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    posts: number;
    followers: number;
    following: number;
    likes: number;
  };
};

export default Author;
