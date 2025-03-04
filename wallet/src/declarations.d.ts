declare module 'lonewolf-protocol' {
  import Gun from 'gun';
  
  export const authentication: any;
  export const certificates: any;
  export const friends: any;
  export const messaging: any;
  export const gun: any;
  export const user: any;
  
  export function externalGunInstance(gun: any): void;
} 

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string): any;
}
