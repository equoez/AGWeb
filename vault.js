/* ============================================================
   Vault — password-protected content, entirely in the browser.
   ------------------------------------------------------------
   Used by the site (to unlock) and the content editor (to lock).
   AES-256-GCM with a key derived from the password by PBKDF2-SHA256.
   Nothing but the ciphertext is ever stored in the repo, so the
   password is the only way to read the text.

   Locked blob shape (stored in journal.json):
     { v: 1, iter: 600000, salt: <base64>, iv: <base64>, data: <base64> }
   ============================================================ */
const Vault = (() => {
    const ITER = 600000;
    const enc = new TextEncoder(), dec = new TextDecoder();

    const b64 = u8 => {
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
    };
    const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

    const available = () => !!(globalThis.crypto && crypto.subtle);

    async function deriveKey(password, salt, iter) {
        const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
            base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }

    /* Derive once, encrypt many times (the editor keeps this while a book is unlocked). */
    async function open(password, blob) {
        const salt = blob ? unb64(blob.salt) : crypto.getRandomValues(new Uint8Array(16));
        const iter = blob ? blob.iter : ITER;
        const key = await deriveKey(password, salt, iter);
        return { key, salt, iter };
    }

    async function encryptWith(handle, obj) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, handle.key, enc.encode(JSON.stringify(obj)));
        return { v: 1, iter: handle.iter, salt: b64(handle.salt), iv: b64(iv), data: b64(new Uint8Array(ct)) };
    }

    async function decryptWith(handle, blob) {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, handle.key, unb64(blob.data));
        return JSON.parse(dec.decode(pt));
    }

    async function encrypt(password, obj) { return encryptWith(await open(password), obj); }

    /* Resolves to the object, or rejects (wrong password / tampered data). */
    async function decrypt(password, blob) {
        const handle = await open(password, blob);
        return { handle, value: await decryptWith(handle, blob) };
    }

    return { available, open, encrypt, encryptWith, decrypt, decryptWith };
})();
