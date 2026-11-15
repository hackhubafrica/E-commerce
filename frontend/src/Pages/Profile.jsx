import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/me`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Unable to load profile.');
        }
        setUser(data.user);
        setErrorMessage('');
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, API_URL]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch(`${API_URL}/api/user/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: document.getElementById('profile-name')?.value || '',
          email: document.getElementById('profile-email')?.value || '',
          phone: document.getElementById('profile-phone')?.value || '',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to update profile.');
      }
      setUser(data.user);
      setSuccessMessage('Profile updated successfully.');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API_URL}/api/user/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to delete account.');
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
      window.dispatchEvent(new Event('shopper-auth-change'));
      navigate('/login');
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  if (loading) {
    return (
      <main className="checkout-message" role="status">
        <p>Loading profile...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="checkout-message" role="alert">
        <h1>Profile not found</h1>
        <p>You are not logged in or your session has expired.</p>
        <Link to="/login">Log in to view your profile</Link>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <div className="profile-header">
        <h1>My Profile</h1>
        <p className="profile-status" role="status">{successMessage}</p>
        <p className="profile-status" role="alert">{errorMessage}</p>
      </div>

      <div className="profile-card">
        <div className="profile-info">
          <div className="profile-field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={user.email || ''}
              disabled
              placeholder="Enter your email"
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-phone">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              value={user.phone || ''}
              placeholder="Enter your phone number"
            />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              value={user.name || ''}
              placeholder="Enter your name"
            />
          </div>
        </div>

        <div className="profile-actions">
          <button
            type="button"
            className="profile-btn profile-btn-save"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="profile-btn profile-btn-delete"
            onClick={handleDeleteAccount}
          >
            Delete Account
          </button>
        </div>
      </div>

      <div className="profile-info-box">
        <h2>Account Details</h2>
        <dl className="profile-details">
          <dt>Token expiry</dt>
          <dd>{labelTimestamp(new Date((typeof window !== 'undefined' && localStorage?.token ? (JSON.parse(atob(localStorage.token.split('.')[1])).exp * 1000) : Date.now())))}</dd>
        </dl>
      </div>
    </main>
  );
};

function labelTimestamp(date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} minutes ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} hours ago`;
  return date.toLocaleString();
}

export default Profile;