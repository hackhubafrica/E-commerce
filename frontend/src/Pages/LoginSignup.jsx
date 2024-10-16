import React, { useState } from 'react';
import './CSS/LoginSignup.css';

const LoginSignup = () => {
  const [state, setState] = useState("Login");
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [errorMessage, setErrorMessage] = useState('');

  // Toggle between Login and Signup states
  const toggleState = () => {
    setState(prevState => (prevState === "Login" ? "Signup" : "Login"));
    setFormData({ name: '', email: '', password: '' }); // Clear form data on toggle
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = state === 'Login' ? '/login' : '/signup';

    try {
      const response = await fetch(`http://localhost:4000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      const data = await response.json();
      console.log(`${state} successful`, data);

      // Assuming the JWT token is returned in data.token
        if (data.token) {
            localStorage.setItem('token', data.token); // Save token to local storage
            alert(`${state} successful!`);
        } else {
            console.log('No token received.');
        }
      // Handle success response
      console.log(`${state} successful!`);
    } catch (error) {
      console.error(`Error during ${state}:`, error);
      setErrorMessage(`Failed to ${state.toLowerCase()}. Please try again.`);
    }
  };

  return (
    <div className="loginsignup">
      <div className="loginsignup-container">
        <h1>{state}</h1>
        <form onSubmit={handleSubmit}>
          <div className="loginsignup-fields">
            {/* Display name input only for Signup */}
            {state === "Signup" && (
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleInputChange}
              />
            )}
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>
          <button type="submit">Continue</button>
        </form>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {/* Toggle between Login and Signup */}
        {state === "Login" ? (
          <p className="loginsignup-login">
            Don't have an account? <span onClick={toggleState}>Click Here</span>
          </p>
        ) : (
          <p className="loginsignup-login">
            Already have an account? <span onClick={toggleState}>Login</span>
          </p>
        )}

        <div className="loginsignup-agree">
          <input type="checkbox" name="" id="" />
          <p>By Continuing, I agree to the terms of use...</p>
        </div>
      </div>
    </div>
  );
};

export default LoginSignup;
