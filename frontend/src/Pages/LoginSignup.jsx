import React, { useState } from 'react';
import './CSS/LoginSignup.css';
import { API_URL } from '../config';
import {
  confirmPhoneCode,
  isFirebaseConfigured,
  requestPhoneCode,
  signInWithProvider,
} from '../auth-providers';

const LoginSignup = () => {
  const [state, setState] = useState('Login');
  const [authMethod, setAuthMethod] = useState('email');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [phoneVerifier, setPhoneVerifier] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleState = () => {
    setState((currentState) => (currentState === 'Login' ? 'Signup' : 'Login'));
    setFormData({ name: '', email: '', password: '' });
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleInputChange = (event) => {
    setFormData((currentData) => ({
      ...currentData,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (authMethod === 'phone') {
        if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
          throw new Error('Enter your phone number in international format, for example +254712345678.');
        }
        if (!phoneConfirmation) {
          const result = await requestPhoneCode(phone.trim());
          setPhoneConfirmation(result.confirmation);
          setPhoneVerifier(result.verifier);
          setSuccessMessage('A verification code has been sent to your phone.');
          return;
        }
        if (!/^\d{6}$/.test(verificationCode.trim())) {
          throw new Error('Enter the six-digit verification code.');
        }
        await confirmPhoneCode(phoneConfirmation, verificationCode.trim(), phoneVerifier);
        setSuccessMessage('You are now signed in.');
        return;
      }
      if (!API_URL) {
        throw new Error('Account service is not configured for this store.');
      }
      const response = await fetch(`${API_URL}/${state === 'Login' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: formData.email.trim().toLowerCase(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(data.errors || data.error || 'Unable to complete your request.');
      }

      localStorage.setItem('token', data.token);
      window.dispatchEvent(new Event('shopper-auth-change'));
      setSuccessMessage(state === 'Login' ? 'You are now logged in.' : 'Your account has been created.');
      setFormData((currentData) => ({ ...currentData, password: '' }));
    } catch (error) {
      setErrorMessage(
        error instanceof TypeError
          ? 'Unable to reach the account service. Please try again later.'
          : error instanceof Error ? error.message : 'Unable to reach the account service.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderSignIn = async (provider) => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);
    try {
      await signInWithProvider(provider);
      setSuccessMessage('You are now signed in.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in with that provider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="loginsignup">
      <div className="loginsignup-container">
        <h1>{state}</h1>
        <form onSubmit={handleSubmit}>
          <div className="loginsignup-fields">
            {authMethod === 'email' && state === 'Signup' && (
              <input
                type="text"
                name="name"
                placeholder="Your name"
                autoComplete="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            )}
            {authMethod === 'email' ? (
              <>
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  autoComplete={state === 'Login' ? 'current-password' : 'new-password'}
                  minLength={state === 'Signup' ? 8 : undefined}
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </>
            ) : (
              <>
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+254712345678"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={Boolean(phoneConfirmation)}
                  required
                />
                {phoneConfirmation && (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Six-digit SMS code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    required
                  />
                )}
                <div id="phone-recaptcha-container" />
              </>
            )}
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : authMethod === 'phone'
              ? phoneConfirmation ? 'Verify and sign in' : 'Send phone code'
              : state === 'Login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {isFirebaseConfigured() && (
          <div className="loginsignup-providers">
            <button type="button" disabled={isSubmitting} onClick={() => handleProviderSignIn('google')}>Continue with Google</button>
            <button type="button" disabled={isSubmitting} onClick={() => handleProviderSignIn('facebook')}>Continue with Facebook</button>
            <button type="button" disabled={isSubmitting} onClick={() => handleProviderSignIn('apple')}>Continue with Apple</button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                phoneVerifier?.clear();
                setAuthMethod((method) => method === 'phone' ? 'email' : 'phone');
                setPhoneConfirmation(null);
                setPhoneVerifier(null);
                setVerificationCode('');
                setErrorMessage('');
                setSuccessMessage('');
              }}
            >
              {authMethod === 'phone' ? 'Use email and password' : 'Continue with phone'}
            </button>
          </div>
        )}

        {errorMessage && <p className="loginsignup-message error-message" role="alert">{errorMessage}</p>}
        {successMessage && <p className="loginsignup-message success-message" role="status">{successMessage}</p>}

        <p className="loginsignup-login">
          {state === 'Login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button type="button" className="loginsignup-toggle" onClick={toggleState}>
            {state === 'Login' ? 'Create one' : 'Log in'}
          </button>
        </p>
        <p className="loginsignup-password-note">New passwords must be at least 8 characters.</p>
      </div>
    </main>
  );
};

export default LoginSignup;
