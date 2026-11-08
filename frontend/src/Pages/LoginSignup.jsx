import React, { useState } from 'react';
import './CSS/LoginSignup.css';
import { API_URL } from '../config';

const LoginSignup = () => {
  const [state, setState] = useState('Login');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
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

  return (
    <main className="loginsignup">
      <div className="loginsignup-container">
        <h1>{state}</h1>
        <form onSubmit={handleSubmit}>
          <div className="loginsignup-fields">
            {state === 'Signup' && (
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
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : state === 'Login' ? 'Log in' : 'Create account'}
          </button>
        </form>

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
