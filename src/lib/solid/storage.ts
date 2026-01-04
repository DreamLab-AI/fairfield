/**
 * Solid Pod Storage Operations
 * File upload/download and resource management
 */

import { SolidClient, getDefaultClient } from './client';
import { derivePodName } from './pods';
import type {
  SolidIdentity,
  FileMetadata,
  FileUploadOptions,
  FileUploadResult,
  FileDownloadResult,
  ResourceInfo,
  ContainerListResult,
  JsonLdResource,
  JsonLdResult,
} from './types';
import { SolidError, SolidErrorType } from './types';

/**
 * Common MIME types
 */
export const MimeTypes = {
  TEXT: 'text/plain',
  HTML: 'text/html',
  CSS: 'text/css',
  JS: 'application/javascript',
  JSON: 'application/json',
  JSON_LD: 'application/ld+json',
  TURTLE: 'text/turtle',
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
  SVG: 'image/svg+xml',
  PDF: 'application/pdf',
  BINARY: 'application/octet-stream',
} as const;

/**
 * Detect MIME type from filename
 */
export function detectMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeMap: Record<string, string> = {
    txt: MimeTypes.TEXT,
    html: MimeTypes.HTML,
    htm: MimeTypes.HTML,
    css: MimeTypes.CSS,
    js: MimeTypes.JS,
    mjs: MimeTypes.JS,
    json: MimeTypes.JSON,
    jsonld: MimeTypes.JSON_LD,
    ttl: MimeTypes.TURTLE,
    png: MimeTypes.PNG,
    jpg: MimeTypes.JPEG,
    jpeg: MimeTypes.JPEG,
    gif: MimeTypes.GIF,
    webp: MimeTypes.WEBP,
    svg: MimeTypes.SVG,
    pdf: MimeTypes.PDF,
  };

  return mimeMap[ext || ''] || MimeTypes.BINARY;
}

/**
 * Build resource path within pod
 */
export function buildResourcePath(identity: SolidIdentity, path: string): string {
  const podName = derivePodName(identity.npub);
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${podName}/${cleanPath}`;
}

/**
 * Upload a file to the pod
 */
export async function uploadFile(
  identity: SolidIdentity,
  file: File | Blob,
  options: FileUploadOptions,
  client?: SolidClient
): Promise<FileUploadResult> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, options.path);

  // Determine content type
  const contentType = options.contentType
    || (file instanceof File ? file.type : undefined)
    || detectMimeType(options.path);

  try {
    // Check if file exists and overwrite is false
    if (!options.overwrite) {
      const existsResponse = await solidClient.get(resourcePath, identity);
      if (existsResponse.ok) {
        return {
          success: false,
          error: 'File already exists and overwrite is false',
        };
      }
    }

    // Ensure parent container exists
    const parentPath = resourcePath.split('/').slice(0, -1).join('/') + '/';
    await ensureContainer(identity, parentPath, solidClient);

    // Upload the file
    const response = await solidClient.put(
      resourcePath,
      identity,
      file,
      {
        'Content-Type': contentType,
      }
    );

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      return {
        success: false,
        error: `Upload failed: ${response.statusText}`,
      };
    }

    const etag = response.headers.get('ETag') || undefined;
    const url = solidClient.buildUrl(resourcePath);

    return {
      success: true,
      url,
      etag,
      metadata: {
        name: options.path.split('/').pop() || 'file',
        contentType,
        size: file.size,
        lastModified: file instanceof File ? file.lastModified : Date.now(),
      },
    };
  } catch (error) {
    if (error instanceof SolidError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error',
    };
  }
}

/**
 * Upload a string as a file
 */
export async function uploadText(
  identity: SolidIdentity,
  content: string,
  path: string,
  contentType?: string,
  client?: SolidClient
): Promise<FileUploadResult> {
  const blob = new Blob([content], {
    type: contentType || detectMimeType(path)
  });

  return uploadFile(identity, blob, {
    path,
    contentType,
    overwrite: true
  }, client);
}

/**
 * Download a file from the pod
 */
export async function downloadFile(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<FileDownloadResult> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  try {
    const response = await solidClient.request({
      url: solidClient.buildUrl(resourcePath),
      method: 'GET',
      identity,
      headers: {
        Accept: '*/*',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'File not found',
        };
      }
      return {
        success: false,
        error: `Download failed: ${response.statusText}`,
      };
    }

    // Fetch the actual blob data
    const blobResponse = await fetch(solidClient.buildUrl(resourcePath), {
      method: 'GET',
      headers: {
        Accept: '*/*',
      },
    });

    if (!blobResponse.ok) {
      return {
        success: false,
        error: `Download failed: ${blobResponse.statusText}`,
      };
    }

    const data = await blobResponse.blob();
    const etag = blobResponse.headers.get('ETag') || undefined;
    const contentType = blobResponse.headers.get('Content-Type') || MimeTypes.BINARY;
    const contentLength = blobResponse.headers.get('Content-Length');
    const lastModified = blobResponse.headers.get('Last-Modified');

    return {
      success: true,
      data,
      etag,
      metadata: {
        name: path.split('/').pop() || 'file',
        contentType,
        size: contentLength ? parseInt(contentLength, 10) : data.size,
        lastModified: lastModified ? new Date(lastModified).getTime() : undefined,
      },
    };
  } catch (error) {
    if (error instanceof SolidError) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown download error',
    };
  }
}

/**
 * Download file as text
 */
export async function downloadText(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<{ success: boolean; text?: string; error?: string }> {
  const result = await downloadFile(identity, path, client);

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  try {
    const text = await result.data.text();
    return { success: true, text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file as text',
    };
  }
}

/**
 * Delete a file from the pod
 */
export async function deleteFile(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<{ success: boolean; error?: string }> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  try {
    const response = await solidClient.delete(resourcePath, identity);

    if (response.ok || response.status === 204 || response.status === 404) {
      return { success: true };
    }

    return {
      success: false,
      error: `Delete failed: ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error',
    };
  }
}

/**
 * Ensure a container (folder) exists
 */
export async function ensureContainer(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<{ success: boolean; error?: string }> {
  const solidClient = client || getDefaultClient();

  // Normalize path to end with /
  const containerPath = path.endsWith('/') ? path : `${path}/`;

  try {
    // Check if exists
    const checkResponse = await solidClient.get(containerPath, identity);

    if (checkResponse.ok) {
      return { success: true };
    }

    // Create container
    const response = await solidClient.put(
      containerPath,
      identity,
      undefined,
      {
        'Content-Type': 'text/turtle',
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
      }
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      return { success: true };
    }

    return {
      success: false,
      error: `Failed to create container: ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List resources in a container
 */
export async function listContainer(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<ContainerListResult> {
  const solidClient = client || getDefaultClient();
  const containerPath = buildResourcePath(identity, path.endsWith('/') ? path : `${path}/`);

  try {
    const response = await solidClient.get(containerPath, identity, {
      Accept: 'text/turtle',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Container not found',
        };
      }
      return {
        success: false,
        error: `Failed to list container: ${response.statusText}`,
      };
    }

    // Parse the Turtle response to extract resources
    // This is a simplified parser - in production you'd use a proper RDF library
    const resources = parseContainerListing(
      response.body as string,
      solidClient.buildUrl(containerPath)
    );

    return {
      success: true,
      containerUrl: solidClient.buildUrl(containerPath),
      resources,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown list error',
    };
  }
}

/**
 * Simple parser for Turtle container listings
 * Note: This is a basic implementation - use rdflib.js for production
 */
function parseContainerListing(turtle: string, containerUrl: string): ResourceInfo[] {
  const resources: ResourceInfo[] = [];

  // Look for ldp:contains relationships
  const containsPattern = /<([^>]+)>\s+a\s+(?:ldp:Resource|ldp:Container)/g;
  let match;

  while ((match = containsPattern.exec(turtle)) !== null) {
    const url = match[1];
    const name = url.split('/').filter(Boolean).pop() || '';
    const isContainer = url.endsWith('/');

    resources.push({
      url,
      name,
      isContainer,
    });
  }

  // Alternative pattern for ldp:contains
  const containsPattern2 = /ldp:contains\s+<([^>]+)>/g;
  while ((match = containsPattern2.exec(turtle)) !== null) {
    const url = match[1];
    const absoluteUrl = url.startsWith('http') ? url : containerUrl + url;
    const name = url.split('/').filter(Boolean).pop() || '';
    const isContainer = url.endsWith('/');

    // Avoid duplicates
    if (!resources.some(r => r.url === absoluteUrl)) {
      resources.push({
        url: absoluteUrl,
        name,
        isContainer,
      });
    }
  }

  return resources;
}

/**
 * Save JSON-LD resource to pod
 */
export async function saveJsonLd(
  identity: SolidIdentity,
  path: string,
  data: JsonLdResource,
  client?: SolidClient
): Promise<JsonLdResult> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  // Ensure default context
  const jsonLd: JsonLdResource = {
    '@context': data['@context'] || 'https://schema.org/',
    ...data,
  };

  try {
    const response = await solidClient.put(
      resourcePath,
      identity,
      JSON.stringify(jsonLd, null, 2),
      {
        'Content-Type': MimeTypes.JSON_LD,
      }
    );

    if (!response.ok && response.status !== 201 && response.status !== 204) {
      return {
        success: false,
        error: `Failed to save JSON-LD: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: jsonLd,
      url: solidClient.buildUrl(resourcePath),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load JSON-LD resource from pod
 */
export async function loadJsonLd(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<JsonLdResult> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  try {
    const response = await solidClient.get(resourcePath, identity, {
      Accept: MimeTypes.JSON_LD + ', ' + MimeTypes.JSON,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Resource not found',
        };
      }
      return {
        success: false,
        error: `Failed to load JSON-LD: ${response.statusText}`,
      };
    }

    const data = response.body as JsonLdResource;

    return {
      success: true,
      data,
      url: solidClient.buildUrl(resourcePath),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a resource exists
 */
export async function resourceExists(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<boolean> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  try {
    const response = await solidClient.request({
      url: solidClient.buildUrl(resourcePath),
      method: 'GET',
      identity,
      headers: {
        Accept: '*/*',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Copy a file within the pod
 */
export async function copyFile(
  identity: SolidIdentity,
  sourcePath: string,
  destPath: string,
  client?: SolidClient
): Promise<{ success: boolean; error?: string }> {
  const downloadResult = await downloadFile(identity, sourcePath, client);

  if (!downloadResult.success || !downloadResult.data) {
    return { success: false, error: downloadResult.error || 'Source file not found' };
  }

  const uploadResult = await uploadFile(
    identity,
    downloadResult.data,
    {
      path: destPath,
      contentType: downloadResult.metadata?.contentType,
      overwrite: true,
    },
    client
  );

  return { success: uploadResult.success, error: uploadResult.error };
}

/**
 * Move a file within the pod
 */
export async function moveFile(
  identity: SolidIdentity,
  sourcePath: string,
  destPath: string,
  client?: SolidClient
): Promise<{ success: boolean; error?: string }> {
  const copyResult = await copyFile(identity, sourcePath, destPath, client);

  if (!copyResult.success) {
    return copyResult;
  }

  return deleteFile(identity, sourcePath, client);
}

/**
 * Get resource metadata without downloading content
 */
export async function getResourceInfo(
  identity: SolidIdentity,
  path: string,
  client?: SolidClient
): Promise<ResourceInfo | null> {
  const solidClient = client || getDefaultClient();
  const resourcePath = buildResourcePath(identity, path);

  try {
    // Use HEAD request if server supports it, otherwise GET
    const response = await solidClient.get(resourcePath, identity, {
      Accept: '*/*',
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('Content-Type') || undefined;
    const contentLength = response.headers.get('Content-Length');
    const lastModified = response.headers.get('Last-Modified');
    const etag = response.headers.get('ETag') || undefined;

    return {
      url: solidClient.buildUrl(resourcePath),
      name: path.split('/').pop() || '',
      isContainer: path.endsWith('/'),
      contentType,
      size: contentLength ? parseInt(contentLength, 10) : undefined,
      modified: lastModified ? new Date(lastModified).getTime() : undefined,
      etag,
    };
  } catch {
    return null;
  }
}
