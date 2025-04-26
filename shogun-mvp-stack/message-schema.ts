import crypto from 'crypto';

export enum MessageType {
  _TWEET = '@TWEET@',
  Post = 'POST',
  Moderation = 'MODERATION',
  Profile = 'PROFILE',
  Connection = 'CONNECTION',
  File = 'FILE',
}

export type MessageOption = {
  type: MessageType;
  creator?: string;
  createdAt?: Date;
};

export class Message {
  type: MessageType;
  creator: string;
  createdAt: Date;

  static getType(type: string): MessageType | null {
    switch (type.toUpperCase()) {
      case 'POST': return MessageType.Post;
      case 'CONNECTION': return MessageType.Connection;
      case 'FILE': return MessageType.File;
      case 'PROFILE': return MessageType.Profile;
      case 'MODERATION': return MessageType.Moderation;
      default: return null;
    }
  }

  constructor(opt: MessageOption) {
    this.type = opt.type;
    this.creator = opt.creator || '';
    this.createdAt = opt.createdAt || new Date();
  }

  toJSON() {
    throw new Error('toJSON is not implemented');
  }

  toHex() {
    throw new Error('toHex is not implemented');
  }
}

// Implementazioni di Post, Moderation, Connection e Profile...
