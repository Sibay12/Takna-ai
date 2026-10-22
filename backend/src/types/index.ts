import type { Db, ObjectId } from "mongodb";

export type Role = "USER" | "SUPPORT" | "ADMIN" | "SUPER_ADMIN";
export type AccountStatus = "active" | "suspended";

export interface UserDoc {
  _id?: ObjectId;
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified: boolean;
  role: Role;
  status: AccountStatus;
  provider?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export interface ProjectDoc {
  _id: ObjectId;
  ownerId: string;
  name: string;
  type: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectFileDoc {
  _id?: ObjectId;
  ownerId: string;
  projectId: ObjectId;
  path: string;
  content: string;
  language: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDoc {
  _id: ObjectId;
  ownerId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface MessageDoc {
  _id: ObjectId;
  ownerId: string;
  conversationId: ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthContext {
  uid: string;
  role: Role;
  email?: string;
  emailVerified: boolean;
  user: UserDoc;
}

export interface VerifiedToken {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  provider?: string;
}

export type TokenVerifier = (idToken: string) => Promise<VerifiedToken>;

export interface DbProvider {
  isReady(): boolean;
  getDb(): Db;
  ping(): Promise<boolean>;
}

export interface UsageDoc {
  _id?: ObjectId;
  ownerId: string;
  day: string; // UTC YYYY-MM-DD
  count: number;
  createdAt: Date;
  updatedAt: Date;
}
