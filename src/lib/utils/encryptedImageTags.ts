/**
 * Encrypted Image Tag Utilities
 * Parse and create Nostr event tags for encrypted images
 *
 * Tag format:
 * ["image", "<url>", "<content-type>", "encrypted"]
 * ["image-key", "<recipient-pubkey>", "<nip44-encrypted-aes-key>"]
 * ["image-iv", "<base64-iv>"]
 * ["image-salt", "<base64-salt>"]
 * ["image-sender", "<sender-pubkey>"]
 */

import type { MediaType, MediaEncryptionData } from './linkPreview';
import type { RecipientKey, EncryptedImageMetadata } from './imageUpload';

/**
 * Encrypted image info extracted from event tags
 */
export interface EncryptedImageInfo {
	url: string;
	contentType: string;
	iv: string;
	salt: string;
	senderPubkey: string;
	recipientKeys: Map<string, string>; // pubkey -> encrypted AES key
}

/**
 * Create event tags for an encrypted image
 * @param url - The uploaded encrypted image URL
 * @param encryptionData - Encryption metadata from upload
 * @param senderPubkey - Sender's public key
 * @param contentType - Content type (default: application/octet-stream)
 * @returns Array of tag arrays to add to event
 */
export function createEncryptedImageTags(
	url: string,
	encryptionData: EncryptedImageMetadata,
	senderPubkey: string,
	contentType: string = 'application/octet-stream'
): string[][] {
	const tags: string[][] = [];

	// Main image tag with encrypted flag
	tags.push(['image', url, contentType, 'encrypted']);

	// IV and salt for decryption
	tags.push(['image-iv', encryptionData.iv]);
	tags.push(['image-salt', encryptionData.salt]);

	// Sender pubkey for key derivation
	tags.push(['image-sender', senderPubkey]);

	// Per-recipient encrypted AES keys
	for (const recipientKey of encryptionData.recipientKeys) {
		tags.push(['image-key', recipientKey.pubkey, recipientKey.encryptedKey]);
	}

	return tags;
}

/**
 * Parse encrypted image info from event tags
 * @param tags - Event tags array
 * @returns Array of encrypted image info, or empty if none found
 */
export function parseEncryptedImageTags(tags: string[][]): EncryptedImageInfo[] {
	const images: EncryptedImageInfo[] = [];

	// Find all encrypted image tags
	const imageTags = tags.filter(
		(t) => t[0] === 'image' && t.length >= 4 && t[3] === 'encrypted'
	);

	if (imageTags.length === 0) {
		return [];
	}

	// Get shared encryption data (IV, salt, sender)
	const ivTag = tags.find((t) => t[0] === 'image-iv');
	const saltTag = tags.find((t) => t[0] === 'image-salt');
	const senderTag = tags.find((t) => t[0] === 'image-sender');

	if (!ivTag || !saltTag || !senderTag) {
		console.warn('Missing encryption metadata tags for encrypted image');
		return [];
	}

	const iv = ivTag[1];
	const salt = saltTag[1];
	const senderPubkey = senderTag[1];

	// Collect all recipient keys
	const recipientKeys = new Map<string, string>();
	for (const tag of tags) {
		if (tag[0] === 'image-key' && tag.length >= 3) {
			recipientKeys.set(tag[1], tag[2]);
		}
	}

	// Create info for each image
	for (const imageTag of imageTags) {
		images.push({
			url: imageTag[1],
			contentType: imageTag[2] || 'application/octet-stream',
			iv,
			salt,
			senderPubkey,
			recipientKeys,
		});
	}

	return images;
}

/**
 * Get encrypted key for a specific recipient
 * @param info - Encrypted image info
 * @param recipientPubkey - Recipient's public key
 * @returns Encrypted AES key or null if not found
 */
export function getRecipientKey(
	info: EncryptedImageInfo,
	recipientPubkey: string
): string | null {
	return info.recipientKeys.get(recipientPubkey) || null;
}

/**
 * Convert encrypted image info to MediaType with encryption data
 * @param info - Encrypted image info
 * @param recipientPubkey - Current user's public key to find their key
 * @returns MediaType with encryption data, or null if user has no access
 */
export function encryptedImageToMediaType(
	info: EncryptedImageInfo,
	recipientPubkey: string
): MediaType | null {
	const encryptedKey = getRecipientKey(info, recipientPubkey);

	if (!encryptedKey) {
		// User is not a recipient - they cannot decrypt this image
		return null;
	}

	const encryption: MediaEncryptionData = {
		encrypted: true,
		encryptedKey,
		senderPubkey: info.senderPubkey,
	};

	return {
		type: 'image',
		url: info.url,
		encryption,
	};
}

/**
 * Extract all media (encrypted and regular) from message content and tags
 * @param content - Message content text
 * @param tags - Event tags
 * @param userPubkey - Current user's public key (for encrypted images)
 * @param extractUrlsFn - Function to extract URLs from text
 * @param getMediaTypeFn - Function to convert URL to MediaType
 * @returns Array of MediaType objects
 */
export function extractAllMedia(
	content: string,
	tags: string[][],
	userPubkey: string | undefined,
	extractUrlsFn: (text: string) => string[],
	getMediaTypeFn: (url: string) => MediaType
): MediaType[] {
	const mediaList: MediaType[] = [];
	const processedUrls = new Set<string>();

	// First, handle encrypted images from tags
	const encryptedImages = parseEncryptedImageTags(tags);
	for (const encImg of encryptedImages) {
		if (userPubkey) {
			const media = encryptedImageToMediaType(encImg, userPubkey);
			if (media) {
				mediaList.push(media);
				processedUrls.add(encImg.url);
			}
		}
	}

	// Then, handle regular URLs from content (skip already processed encrypted URLs)
	const urls = extractUrlsFn(content);
	for (const url of urls) {
		if (!processedUrls.has(url)) {
			mediaList.push(getMediaTypeFn(url));
			processedUrls.add(url);
		}
	}

	return mediaList.slice(0, 5); // Limit to 5 media items
}

export default {
	createEncryptedImageTags,
	parseEncryptedImageTags,
	getRecipientKey,
	encryptedImageToMediaType,
	extractAllMedia,
};
