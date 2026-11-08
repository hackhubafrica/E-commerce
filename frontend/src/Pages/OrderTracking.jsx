import React, { useEffect, useState } from 'react';
import './CSS/OrderTracking.css';
import { WORKER_URL } from '../config';

const OrderTracking = () => {
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [newPickupStation, setNewPickupStation] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setOrderId(
      new URLSearchParams(window.location.search).get('orderId')
        || sessionStorage.getItem('shopper-last-order-id')
        || '',
    );
  }, []);

  const request = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Unable to find this order.');
    }
    return data;
  };

  const findOrder = async (event) => {
    event.preventDefault();
    if (!WORKER_URL) {
      setErrorMessage('Order tracking is not configured for this store yet.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');
    setOrder(null);
    try {
      const params = new URLSearchParams({ email: email.trim().toLowerCase() });
      const data = await request(
        `${WORKER_URL}/api/order/${encodeURIComponent(orderId.trim())}?${params}`,
      );
      setOrder(data.order);
      setNewPickupStation(data.order.pickup_station || '');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reach order tracking.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePickupStation = async (event) => {
    event.preventDefault();
    if (!WORKER_URL) {
      setErrorMessage('Order tracking is not configured for this store yet.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    setMessage('');
    try {
      const data = await request(
        `${WORKER_URL}/api/order/${encodeURIComponent(orderId.trim())}/pickup`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            pickupStation: newPickupStation.trim(),
          }),
        },
      );
      setOrder(data.order);
      setNewPickupStation(data.order.pickup_station);
      setMessage('Your preferred pickup point has been updated.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update the pickup point.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="order-tracking">
      <section className="tracking-card">
        <p className="tracking-eyebrow">YOUR ORDER</p>
        <h1>Track an order</h1>
        <p>Enter your order reference and checkout email to see payment and delivery updates.</p>
        <form className="tracking-search" onSubmit={findOrder}>
          <label htmlFor="tracking-order-id">Order reference</label>
          <input
            id="tracking-order-id"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
          />
          <label htmlFor="tracking-email">Checkout email</label>
          <input
            id="tracking-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Checking…' : 'Find my order'}
          </button>
        </form>

        {errorMessage && <p className="tracking-error" role="alert">{errorMessage}</p>}
        {message && <p className="tracking-success" role="status">{message}</p>}

        {order && (
          <section className="tracking-result" aria-live="polite">
            <h2>Order {order.order_id}</h2>
            <dl>
              <div><dt>Payment</dt><dd>{order.status}</dd></div>
              <div><dt>Delivery</dt><dd>{order.delivery_status || 'pending'}</dd></div>
              <div><dt>Preferred pickup point</dt><dd>{order.pickup_station || 'Not selected'}</dd></div>
            </dl>
            {!['ready', 'collected', 'delivered', 'cancelled'].includes(order.delivery_status) && (
              <form className="tracking-change" onSubmit={changePickupStation}>
                <label htmlFor="new-pickup-station">Change preferred pickup point</label>
                <input
                  id="new-pickup-station"
                  value={newPickupStation}
                  onChange={(event) => setNewPickupStation(event.target.value)}
                  maxLength={120}
                  required
                />
                <button type="submit" disabled={isLoading}>
                  Update pickup point
                </button>
              </form>
            )}
          </section>
        )}
      </section>
    </main>
  );
};

export default OrderTracking;
