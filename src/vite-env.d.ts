/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POCKET_ID_URL?: string;
  readonly VITE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ENV__?: {
    POCKET_ID_URL?: string;
    CLIENT_ID?: string;
  };
}
