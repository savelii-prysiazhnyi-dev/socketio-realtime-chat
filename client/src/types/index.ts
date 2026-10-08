export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  role?: MemberRole;
  _count?: {
    members: number;
    channels: number;
  };
  members?: Array<{
    role: MemberRole;
  }>;
  channels?: Channel[];
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: MemberRole;
  joinedAt: string;
  user: User;
}

export interface Channel {
  id: string;
  name: string;
  topic: string | null;
  groupId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAuthor {
  id: string;
  name: string;
  avatar: string | null;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: MessageAuthor;
}

export interface MessagesResponse {
  messages: Message[];
  nextCursor?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
