import { initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  getAuth,
  signInWithPhoneNumber,
  signInWithPopup,
} from 'firebase/auth';
import { API_URL } from './config';

const firebaseConfig = typeof window !== 'undefined'
  ? window.SHOPPER_CONFIG?.firebase
  : null;
const firebaseConfigured = Boolean(
  firebaseConfig?.apiKey && firebaseConfig?.authDomain
  && firebaseConfig?.projectId && firebaseConfig?.appId,
);
const firebaseAuth = firebaseConfigured
  ? getAuth(initializeApp(firebaseConfig))
  : null;

export function isFirebaseConfigured() {
  return Boolean(firebaseAuth && API_URL);
}

async function exchangeFirebaseUser(user) {
  if (!API_URL) throw new Error('The account API is not configured.');
  const idToken = await user.getIdToken();
  const response = await fetch(`${API_URL}/auth/firebase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.token) {
    throw new Error(data.error || 'Unable to complete sign-in.');
  }
  localStorage.setItem('token', data.token);
  window.dispatchEvent(new Event('shopper-auth-change'));
}

export async function signInWithProvider(name) {
  if (!firebaseAuth) throw new Error('Phone and social sign-in are not configured.');
  const providers = {
    google: () => new GoogleAuthProvider(),
    facebook: () => new FacebookAuthProvider(),
    apple: () => {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      return provider;
    },
  };
  const createProvider = providers[name];
  if (!createProvider) throw new Error('This sign-in provider is not supported.');
  const result = await signInWithPopup(firebaseAuth, createProvider());
  await exchangeFirebaseUser(result.user);
}

export async function requestPhoneCode(phone) {
  if (!firebaseAuth) throw new Error('Phone and social sign-in are not configured.');
  const verifier = new RecaptchaVerifier(firebaseAuth, 'phone-recaptcha-container', {
    size: 'normal',
  });
  try {
    const confirmation = await signInWithPhoneNumber(firebaseAuth, phone, verifier);
    return { confirmation, verifier };
  } catch (error) {
    verifier.clear();
    throw error;
  }
}

export async function confirmPhoneCode(confirmation, code, verifier) {
  const result = await confirmation.confirm(code);
  verifier.clear();
  await exchangeFirebaseUser(result.user);
}
