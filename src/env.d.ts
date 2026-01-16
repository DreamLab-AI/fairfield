/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_URL?: string;
  readonly VITE_ADMIN_PUBKEY?: string;
  readonly VITE_NDK_DEBUG?: string;
  readonly VITE_IMAGE_API_URL?: string;
  readonly VITE_IMAGE_BUCKET?: string;
  /** Enable client-side encryption for private channel/DM images */
  readonly VITE_IMAGE_ENCRYPTION_ENABLED?: string;
  readonly PUBLIC_DEFAULT_RELAYS?: string;
  readonly PUBLIC_AI_ENABLED?: string;
  readonly PUBLIC_APP_NAME?: string;
  readonly PUBLIC_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
