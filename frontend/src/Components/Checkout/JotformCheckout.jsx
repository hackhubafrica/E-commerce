import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext';
import { JOTFORM_URL } from '../../config';
import './JotformCheckout.css';

const JotformCheckout = () => {
  const { cartItems, getTotalCartAmount } = useContext(ShopContext);
  const [pickupStation, setPickupStation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const orderTotal = getTotalCartAmount();

  const continueToPayment = (event) => {
    event.preventDefault();
    const station = pickupStation.trim();
    if (!station) {
      setErrorMessage('Enter the pickup station or area that is convenient for you.');
      return;
    }
    if (!JOTFORM_URL) {
      setErrorMessage('Checkout is not configured. Please contact the store.');
      return;
    }

    const orderId = `ORD_${crypto.randomUUID()}`;
    const items = Object.fromEntries(
      Object.entries(cartItems).filter(([, quantity]) => quantity > 0),
    );
    const params = new URLSearchParams({
      orderId,
      orderTotal: orderTotal.toFixed(2),
      currency: 'USD',
      pickupStation: station,
      items: JSON.stringify(items),
    });

    sessionStorage.setItem('shopper-last-order-id', orderId);
    window.location.assign(`${JOTFORM_URL}?${params.toString()}`);
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
        <p className="checkout-eyebrow">DELIVERY</p>
        <h1>Choose a pickup point</h1>
        <p>
          Tell us the pickup station or area that works for you. We’ll confirm
          the available delivery point before dispatch.
        </p>
        <label htmlFor="pickup-station">Preferred pickup station or area</label>
        <input
          id="pickup-station"
          name="pickupStation"
          autoComplete="street-address"
          value={pickupStation}
          onChange={(event) => {
            setPickupStation(event.target.value);
            setErrorMessage('');
          }}
          placeholder="For example, a station near your neighbourhood"
          maxLength={120}
          required
        />
        {errorMessage && <p className="checkout-error" role="alert">{errorMessage}</p>}
        <p className="checkout-total">Order total: ${orderTotal.toFixed(2)}</p>
        <button type="submit">Continue to payment</button>
        <Link className="checkout-back" to="/cart">Back to cart</Link>
      </form>
    </main>
  );
};

export default JotformCheckout;
