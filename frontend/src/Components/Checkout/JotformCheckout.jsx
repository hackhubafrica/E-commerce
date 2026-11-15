import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext';
import { API_URL, WORKER_URL } from '../../config';
import './JotformCheckout.css';

const JotformCheckout = () => {
  const { cartItems, getTotalCartAmount } = useContext(ShopContext);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shippingCountries, setShippingCountries] = useState([]);
  const [countryCode, setCountryCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaInitiated, setMpesaInitiated] = useState(false);
  const [mpesaOrderId, setMpesaOrderId] = useState('');
  const [stablecoinInitiated, setStablecoinInitiated] = useState(false);
  const [stablecoinOrderId, setStablecoinOrderId] = useState('');
  const [stablecoinAddress, setStablecoinAddress] = useState('');
  const [stablecoinAmount, setStablecoinAmount] = useState(0);
  const [stablecoinCurrency, setStablecoinCurrency] = useState('USDC');
  const [stablecoinQrCode, setStablecoinQrCode] = useState(null);
  const [stablecoinCheckoutUrl, setStablecoinCheckoutUrl] = useState('');
  const [stablecoinExpiresAt, setStablecoinExpiresAt] = useState(null);
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

  const items = Object.fromEntries(
    Object.entries(cartItems).filter(([, quantity]) => quantity > 0),
  );

  const continueToStripe = async (event) => {
    event.preventDefault();
    if (!API_URL) {
      setErrorMessage('Card checkout is not connected to the store API.');
      return;
    }
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

  const continueToMpesa = async (event) => {
    event.preventDefault();
    if (!WORKER_URL) {
      setErrorMessage('M-Pesa checkout is not connected to the payment service.');
      return;
    }
    const phone = mpesaPhone.trim();
    if (!phone) {
      setErrorMessage('Please enter your M-Pesa phone number.');
      return;
    }
    const formattedPhone = phone.replace(/^\+/, '').replace(/^0/, '254');
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
      setErrorMessage('Please enter a valid Kenyan phone number (e.g. 0712345678).');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const orderId = `ORD-${Date.now()}`;
      const response = await fetch(`${WORKER_URL}/api/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderTotal,
          currency: 'KES',
          paymentMethod: 'M-Pesa STK Push',
          customerPhone: formattedPhone,
          customerName: 'Customer',
          customerEmail: '',
          customerAddress: '',
          pickupStation: countryCode === 'KE' ? 'Nairobi' : '',
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to start M-Pesa payment.');
      }
      setMpesaInitiated(true);
      setMpesaOrderId(orderId);
      setIsSubmitting(false);
    } catch (error) {
      setErrorMessage(error instanceof TypeError
        ? 'Unable to reach the payment service. Please try again later.'
        : error instanceof Error ? error.message : 'Unable to start M-Pesa payment.');
      setIsSubmitting(false);
    }
  };

  const continueToStablecoin = async (event) => {
    event.preventDefault();
    if (!API_URL) {
      setErrorMessage('Stablecoin checkout is not connected to the store API.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/checkout/stablecoin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, countryCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to create stablecoin payment.');
      }
      setStablecoinInitiated(true);
      setStablecoinOrderId(data.orderId);
      setStablecoinAddress(data.paymentAddress || '');
      setStablecoinAmount(data.amount || 0);
      setStablecoinCurrency(data.currency || 'USDC');
      setStablecoinQrCode(data.qrCode || null);
      setStablecoinCheckoutUrl(data.checkoutUrl || data.paymentUrl || '');
      setStablecoinExpiresAt(data.expiresAt || null);
      setIsSubmitting(false);
    } catch (error) {
      setErrorMessage(error instanceof TypeError
        ? 'Unable to reach the store API. Please try again later.'
        : error instanceof Error ? error.message : 'Unable to start stablecoin payment.');
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

  if (mpesaInitiated) {
    return (
      <main className="checkout-message">
        <h1>M-Pesa payment initiated</h1>
        <p>Check your phone for the M-Pesa STK Push prompt and complete the payment.</p>
        <p>Order reference: <strong>{mpesaOrderId}</strong></p>
        <p className="checkout-note">Once you complete the payment on your phone, your order status will be updated automatically. You can track your order using the reference above.</p>
        <Link className="checkout-back" to={`/track?orderId=${encodeURIComponent(mpesaOrderId)}`}>Track your order</Link>
        <br />
        <Link className="checkout-back" to="/cart">Back to cart</Link>
      </main>
    );
  }

  if (stablecoinInitiated) {
    return (
      <main className="checkout-message">
        <h1>Stablecoin payment initiated</h1>
        <p>Send <strong>{stablecoinAmount.toFixed(2)} {stablecoinCurrency}</strong> to the address below.</p>
        <p>Order reference: <strong>{stablecoinOrderId}</strong></p>
        {stablecoinAddress && (
          <div className="stablecoin-address">
            <label>Payment address</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ wordBreak: "break-all", flex: 1 }}>{stablecoinAddress}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(stablecoinAddress);
                  alert("Address copied to clipboard");
                }}
              >
                Copy
              </button>
            </div>
            {stablecoinQrCode && (
              <div>
                <img src={stablecoinQrCode} alt="Payment QR code" style={{ maxWidth: "200px", marginBottom: "8px" }} />
                <p className="checkout-note">Scan the QR code with your wallet</p>
              </div>
            )}
          </div>
        )}
        {stablecoinCheckoutUrl && (
          <p className="checkout-note">Or <a href={stablecoinCheckoutUrl} target="_blank" rel="noopener noreferrer">open payment page</a></p>
        )}
        {stablecoinExpiresAt && (
          <p className="checkout-note">Payment link expires: {new Date(stablecoinExpiresAt).toLocaleString()}</p>
        )}
        <p className="checkout-note">Once the blockchain confirms your payment, your order status will update automatically. Track your order using the reference above.</p>
        <Link className="checkout-back" to={`/track?orderId=${encodeURIComponent(stablecoinOrderId)}`}>Track your order</Link>
        <br />
        <Link className="checkout-back" to="/cart">Back to cart</Link>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="payment-methods">
        <button
          type="button"
          className={`payment-method-btn ${paymentMethod === 'card' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('card')}
          disabled={isSubmitting}
        >
          <span>Credit / Debit Card</span>
          <span className="method-desc">Pay securely with Stripe</span>
        </button>
        <button
          type="button"
          className={`payment-method-btn ${paymentMethod === 'mpesa' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('mpesa')}
          disabled={isSubmitting}
        >
          <span>M-Pesa</span>
          <span className="method-desc">Pay via Safaricom STK Push</span>
        </button>
        <button
          type="button"
          className={`payment-method-btn ${paymentMethod === 'stablecoin' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('stablecoin')}
          disabled={isSubmitting}
        >
          <span>Stablecoin</span>
          <span className="method-desc">Pay with USDC / USDT</span>
        </button>
      </div>

      {paymentMethod === 'card' && (
        <form className="checkout-card" onSubmit={continueToStripe}>
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
          <Link className="checkout-back" to="/cart">Back to cart</Link>
        </form>
      )}

      {paymentMethod === 'mpesa' && (
        <form className="checkout-card" onSubmit={continueToMpesa}>
          <p className="checkout-eyebrow">M-PESA STK PUSH</p>
          <h1>Pay with M-Pesa</h1>
          <p>
            Enter your Safaricom mobile number. You will receive an STK Push
            prompt on your phone to complete the payment.
          </p>
          <label htmlFor="mpesa-phone">Phone number</label>
          <input
            id="mpesa-phone"
            value={mpesaPhone}
            onChange={(event) => setMpesaPhone(event.target.value)}
            type="tel"
            placeholder="0712345678"
            maxLength="12"
            required
            disabled={isSubmitting}
          />
          {errorMessage && <p className="checkout-error" role="alert">{errorMessage}</p>}
          <p className="checkout-total">Amount to pay: KES {orderTotal.toFixed(0)}</p>
          <p className="checkout-note">Make sure your phone is nearby to accept the STK Push prompt.</p>
          <button type="submit" disabled={isSubmitting || !WORKER_URL}>
            {isSubmitting ? 'Sending STK Push...' : 'Send M-Pesa STK Push'}
          </button>
          {!WORKER_URL && (
            <p className="checkout-error" role="alert">M-Pesa payment service is not configured.</p>
          )}
          <Link className="checkout-back" to="/cart">Back to cart</Link>
        </form>
      )}

      {paymentMethod === 'stablecoin' && (
        <form className="checkout-card" onSubmit={continueToStablecoin}>
          <p className="checkout-eyebrow">STABLECOIN PAYMENT</p>
          <h1>Pay with Stablecoin</h1>
          <p>
            Pay using USDC or USDT on Ethereum. You will receive a payment
            address and QR code to send funds from your crypto wallet.
          </p>
          <label htmlFor="stablecoin-currency">Stablecoin</label>
          <select
            id="stablecoin-currency"
            value={stablecoinCurrency}
            onChange={(event) => setStablecoinCurrency(event.target.value)}
            required
            disabled={isSubmitting}
          >
            <option value="USDC">USD Coin (USDC)</option>
            <option value="USDT">Tether USD (USDT)</option>
          </select>
          {errorMessage && <p className="checkout-error" role="alert">{errorMessage}</p>}
          <p className="checkout-total">Amount to pay: {orderTotal.toFixed(2)} USD</p>
          <p className="checkout-note">The exact stablecoin amount and payment address will be generated after you submit.</p>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating payment...' : 'Generate Stablecoin Payment'}
          </button>
          {!API_URL && (
            <p className="checkout-error" role="alert">Stablecoin payment service is not configured.</p>
          )}
          <Link className="checkout-back" to="/cart">Back to cart</Link>
        </form>
      )}
    </main>
  );
};

export default JotformCheckout;
