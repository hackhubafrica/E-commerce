import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext';
import { API_URL } from '../../config';
import './JotformCheckout.css';

const JotformCheckout = () => {
  const { cartItems, getTotalCartAmount } = useContext(ShopContext);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingCountries, setShippingCountries] = useState([]);
  const [countryCode, setCountryCode] = useState('');
  const orderTotal = getTotalCartAmount();

  useEffect(() => {
    if (!API_URL) return;
    let active = true;
    fetch(`${API_URL}/api/shipping/countries`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error('Shipping destinations are not configured.');
        return data.countries;
      })
      .then((countries) => {
        if (active) {
          setShippingCountries(countries);
          setCountryCode((current) => current || (countries.includes('KE') ? 'KE' : countries[0] || ''));
        }
      })
      .catch(() => {
        if (active) setErrorMessage('Shipping destinations are not configured for this store.');
      });
    return () => { active = false; };
  }, []);

  const continueToPayment = async (event) => {
    event.preventDefault();
    if (!API_URL) {
      setErrorMessage('Card checkout is not connected to the store API.');
      return;
    }

    const items = Object.fromEntries(
      Object.entries(cartItems).filter(([, quantity]) => quantity > 0),
    );
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/checkout/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, countryCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.checkoutUrl) {
        throw new Error(data.error || 'Unable to start secure card checkout.');
      }
      if (!data.checkoutUrl.startsWith('https://')) {
        throw new Error('The payment service returned an invalid checkout link.');
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setErrorMessage(error instanceof TypeError
        ? 'Unable to reach the store API. Please try again later.'
        : error instanceof Error ? error.message : 'Unable to start checkout.');
      setIsSubmitting(false);
    }
  };

  if (orderTotal <= 0) {
    return (
      <main className="checkout-message">
        <h1>Your cart is empty</h1>
        <p>Add an item to your cart before checking out.</p>
        <Link to="/">Continue shopping</Link>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <form className="checkout-card" onSubmit={continueToPayment}>
        <p className="checkout-eyebrow">SECURE CHECKOUT</p>
        <h1>Pay by card</h1>
        <p>
          Continue to Stripe’s secure checkout to enter your email, phone
          number, and shipping address. Your card details are handled by Stripe,
          not stored by this store.
        </p>
        <label htmlFor="shipping-country">Shipping country</label>
        <select
          id="shipping-country"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
          required
          disabled={!shippingCountries.length || isSubmitting}
        >
          <option value="">Choose a country</option>
          {shippingCountries.map((country) => <option key={country} value={country}>{country}</option>)}
        </select>
        {errorMessage && <p className="checkout-error" role="alert">{errorMessage}</p>}
        <p className="checkout-total">Estimated item subtotal: ${orderTotal.toFixed(2)} USD</p>
        <p className="checkout-note">Shipping is added using the store’s configured rate. The final amount is calculated from the store catalog before payment.</p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Connecting to Stripe...' : 'Continue to secure card checkout'}
        </button>
        <p className="checkout-note">M-Pesa checkout is not enabled on this page until server-side order pricing is connected.</p>
        <Link className="checkout-back" to="/cart">Back to cart</Link>
      </form>
    </main>
  );
};

export default JotformCheckout;
