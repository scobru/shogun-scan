import { get } from 'svelte/store';
import { userLikes, currentUser, useIndexer, indexerAvailable } from '../src/lib/shogunService';

/**
 * Checks if the current user has liked a specific post
 * @param postId The ID of the post to check
 * @returns A boolean indicating whether the post is liked
 */
export function hasLiked(postId: string): boolean {
  // If the userLikes store is missing, we need to reintroduce it first
  if (!userLikes) {
    return false;
  }
  
  const likes = get(userLikes);
  return likes.has(postId);
}

/**
 * Checks if one user follows another
 * @param followerPub The public key of the follower
 * @param followeePub The public key of the user being followed
 * @returns A promise resolving to a boolean indicating if the follower follows the followee
 */
export async function checkFollow(
  followerPub: string,
  followeePub: string
): Promise<boolean> {
  try {
    console.log(
      `[shogunService] Checking if ${followerPub} follows ${followeePub}`
    );

    // Get current user profile for local data
    const currentUserProfile = get(currentUser);

    // First check local cache
    let cacheResult = false;
    if (currentUserProfile && currentUserProfile.pub === followerPub) {
      cacheResult = currentUserProfile.following.includes(followeePub);
      console.log(
        `[shogunService] Cache check for follow status: ${
          cacheResult ? "is following" : "not following"
        }`
      );
    }

    // If indexer is enabled, try server-side checks
    if (get(useIndexer) && get(indexerAvailable)) {
      try {
        // Implement API call to check follow status
        // This would need to match the actual implementation in the main file
        return cacheResult;
      } catch (error) {
        console.warn(`[shogunService] Error checking follow using indexer:`, error);
      }
    }

    return cacheResult;
  } catch (error) {
    console.error(`[shogunService] Error in checkFollow:`, error);
    return false;
  }
} 