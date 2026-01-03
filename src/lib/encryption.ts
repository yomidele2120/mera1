// E2E Encryption utilities using Web Crypto API

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

// Generate a new key pair for a user
export const generateKeyPair = async (): Promise<CryptoKeyPair> => {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
};

// Export public key to base64 string
export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Export private key to base64 string (for local storage)
export const exportPrivateKey = async (privateKey: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Import public key from base64 string
export const importPublicKey = async (keyString: string): Promise<CryptoKey> => {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
};

// Import private key from base64 string
export const importPrivateKey = async (keyString: string): Promise<CryptoKey> => {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

// Derive a shared secret key from private and public keys
export const deriveSharedKey = async (
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> => {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
};

// Encrypt a message
export const encryptMessage = async (
  message: string,
  sharedKey: CryptoKey
): Promise<{ encrypted: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    sharedKey,
    data
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
};

// Decrypt a message
export const decryptMessage = async (
  encryptedData: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> => {
  const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    sharedKey,
    encryptedBytes
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
};

// Store keys in localStorage
const PRIVATE_KEY_STORAGE = 'e2e_private_key';
const PUBLIC_KEY_STORAGE = 'e2e_public_key';

export const storeKeys = async (keyPair: CryptoKeyPair): Promise<void> => {
  const privateKeyStr = await exportPrivateKey(keyPair.privateKey);
  const publicKeyStr = await exportPublicKey(keyPair.publicKey);
  localStorage.setItem(PRIVATE_KEY_STORAGE, privateKeyStr);
  localStorage.setItem(PUBLIC_KEY_STORAGE, publicKeyStr);
};

export const getStoredPrivateKey = async (): Promise<CryptoKey | null> => {
  const keyStr = localStorage.getItem(PRIVATE_KEY_STORAGE);
  if (!keyStr) return null;
  try {
    return await importPrivateKey(keyStr);
  } catch {
    return null;
  }
};

export const getStoredPublicKey = (): string | null => {
  return localStorage.getItem(PUBLIC_KEY_STORAGE);
};

// Initialize or get user's key pair
export const initializeEncryption = async (): Promise<{ privateKey: CryptoKey; publicKeyString: string }> => {
  let privateKey = await getStoredPrivateKey();
  let publicKeyString = getStoredPublicKey();
  
  if (!privateKey || !publicKeyString) {
    const keyPair = await generateKeyPair();
    await storeKeys(keyPair);
    privateKey = keyPair.privateKey;
    publicKeyString = await exportPublicKey(keyPair.publicKey);
  }
  
  return { privateKey, publicKeyString };
};
