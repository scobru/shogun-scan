# Fix Instructions for shogunService.ts

The file has several issues that need to be fixed:

## 1. Fix duplicate declarations

There are duplicate store declarations that need to be removed:

- Remove duplicate declarations of `indexerAvailable` (keep only the one at line 59)
- Remove duplicate declarations of `userLikes` (keep only the one at line 64)
- Remove duplicate declarations of `privateMessages`, `privateChats`, and `unreadMessageCounts` (keep only the ones at lines 67-69)

## 2. Fix the `postsByTag` type

Change the type of `postsByTag` from `Record<string, Message[]>` to `Record<string, any>` at around line 100 to fix the type issue.

## 3. Ensure the export of required functions

Make sure that these functions are properly exported:
- `hasLiked(postId: string): boolean`
- `checkFollow(followerPub: string, followeePub: string): Promise<boolean>`

## 4. Remove duplicate function implementations

The following functions appear to be duplicated in the file:
- `getUserCounts`
- `createGroupMessage`
- `dispatchUserUpdateEvent`
- `updateTargetUserCounts` 

Keep only the first declaration of each function.

## Implementation Approach

The simplest approach to fix these issues is:

1. Keep only the first declarations of all stores at the top of the file
2. Make sure the `postsByTag` type is `Record<string, any>`
3. Ensure `hasLiked` and `checkFollow` functions are properly exported
4. Remove any duplicate function declarations later in the file

After these changes, there should be no redeclaration errors, and the UserList.svelte component should be able to import and use the required functions. 