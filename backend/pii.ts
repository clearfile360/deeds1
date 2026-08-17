import crypto from 'crypto';

// Use environment key if provided, or secure fallback key for development/local mode
const rawKey = process.env.PII_ENCRYPTION_KEY || 'unikorn360_default_dev_pii_encryption_key_2026_aes256';

// Derive a 32-byte key from the key entropy
const PII_KEY = crypto.createHash('sha256').update(rawKey).digest();

export function encryptGCM(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith('v1:')) return plaintext; // already encrypted
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', PII_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGCM(encryptedString: string): string {
  if (!encryptedString) return '';
  if (!encryptedString.startsWith('v1:')) {
    return encryptedString; // Return legacy plaintext as-is
  }
  
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 4) {
      return encryptedString;
    }
    
    const [, ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', PII_KEY, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed, returning fallback plaintext or error:', err);
    return '[DECRYPTION_ERROR]';
  }
}

export function getDeterministicHash(value: string): string {
  if (!value) return '';
  const plaintext = value.startsWith('v1:') ? decryptGCM(value) : value;
  const normalized = plaintext.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!normalized) return '';
  return crypto.createHmac('sha256', PII_KEY).update(normalized).digest('hex');
}

export function maskAadhaar(val: string): string {
  if (!val) return '';
  const clean = val.replace(/[^0-9]/g, '');
  if (clean.length < 4) {
    return 'XXXXXXXX' + clean;
  }
  return 'XXXXXXXX' + clean.slice(-4);
}

export function maskPAN(val: string): string {
  if (!val) return '';
  const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 10) {
    if (clean.length <= 5) return 'XXXXX' + clean;
    return 'XXXXX' + clean.slice(5);
  }
  return 'XXXXX' + clean.slice(5, 9) + clean.slice(-1);
}

export function maskPIIInText(text: string): string {
  if (!text) return '';
  
  let result = text.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, (match) => {
    const digitsOnly = match.replace(/[^0-9]/g, '');
    return 'XXXXXXXX' + digitsOnly.slice(-4);
  });

  result = result.replace(/\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g, (match) => {
    const upper = match.toUpperCase();
    return 'XXXXX' + upper.slice(5, 9) + upper.slice(-1);
  });

  return result;
}

export interface UserContext {
  role: string;
  email: string;
  id?: string;
  phone?: string;
  elevatedReview?: boolean;
  reasonCode?: string;
}

export function serializeClient(client: any, user: UserContext): any {
  if (!client) return null;
  const serialized = { ...client };
  
  let shouldMask = true;
  const role = user.role;
  const userEmail = user.email?.toLowerCase();
  const isElevated = !!user.elevatedReview;
  
  if (role === 'Super Admin') {
    shouldMask = false;
  } else if (role === 'Admin') {
    shouldMask = !isElevated;
  } else if (role === 'Auditor') {
    shouldMask = !isElevated;
  } else if (role === 'Client') {
    const isOwn = (client.email && client.email.toLowerCase() === userEmail) ||
                  (client.id && client.id === user.id) ||
                  (client.phone && client.phone === user.phone);
    if (isOwn) {
      shouldMask = false;
    }
  }
  
  if (shouldMask) {
    serialized.pan = maskPAN(client.pan);
    serialized.aadhaar = maskAadhaar(client.aadhaar);
  }
  
  return serialized;
}

export function serializeDocument(doc: any, user: UserContext): any {
  if (!doc) return null;
  const serialized = JSON.parse(JSON.stringify(doc));
  
  const role = user.role;
  const userEmail = user.email?.toLowerCase();
  const isElevated = !!user.elevatedReview;
  
  if (serialized.state && Array.isArray(serialized.state.parties)) {
    serialized.state.parties = serialized.state.parties.map((p: any) => {
      let shouldMask = true;
      
      if (role === 'Super Admin') {
        shouldMask = false;
      } else if (role === 'Admin') {
        shouldMask = !isElevated;
      } else if (role === 'Auditor') {
        shouldMask = !isElevated;
      } else if (role === 'Client') {
        const isOwn = (p.email && p.email.toLowerCase() === userEmail) ||
                      (p.phone && p.phone === user.phone);
        if (isOwn) {
          shouldMask = false;
        }
      }
      
      if (shouldMask) {
        if (p.pan) p.pan = maskPAN(p.pan);
        if (p.aadhaar) p.aadhaar = maskAadhaar(p.aadhaar);
      }
      return p;
    });
  }
  
  return serialized;
}
