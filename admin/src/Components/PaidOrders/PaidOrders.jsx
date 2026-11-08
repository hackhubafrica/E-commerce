import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { adminRequest } from '../../api';
import './PaidOrders.css';

const PaidOrders = ({ token }) => {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminRequest('/admin/orders/paid', token);
      setOrders(data.orders);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load paid orders.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <main className="paid-orders">
      <header>
        <div>
          <h1>Paid orders awaiting supplier review</h1>
          <p>Only orders confirmed by Stripe appear here. Review supplier variants, shipping costs, and destination before ordering.</p>
        </div>
        <button type="button" onClick={loadOrders} disabled={isLoading}>Refresh</button>
      </header>
      {isLoading && <p role="status">Loading paid orders...</p>}
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      {!isLoading && !error && !orders.length && <p>No paid orders are waiting for review.</p>}
      <div className="paid-orders-list">
        {orders.map((order) => (
          <article className="paid-order-card" key={order.orderId}>
            <div className="paid-order-heading">
              <h2>{order.orderId}</h2>
              <strong>{new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: order.currency || 'USD',
              }).format(Number(order.orderTotal))}</strong>
            </div>
            <p>Items: {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: order.currency || 'USD',
            }).format(Number(order.productSubtotal || 0))} · Shipping: {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: order.currency || 'USD',
            }).format(Number(order.shippingAmount || 0))}</p>
            <p>{order.customerName || 'Customer'} · {order.customerEmail} · {order.customerPhone || 'No phone provided'}</p>
            <p><strong>Ship to:</strong> {order.customerAddress || 'Address not returned by Stripe; verify in Stripe Dashboard.'}</p>
            <ul>
              {(Array.isArray(order.items) ? order.items : []).map((item) => (
                <li key={item.productId}>
                  {item.quantity} × {item.name}
                  {item.supplier === 'cj' ? ` · CJ product ${item.supplierProductId}` : ' · Manual product'}
                  {!item.supplierVariantId && item.supplier === 'cj' ? ' · Variant needs confirmation' : ''}
                </li>
              ))}
            </ul>
            <p className="paid-order-warning">Supplier submission is not automatic. Do not place an order until payment and delivery details are verified.</p>
          </article>
        ))}
      </div>
    </main>
  );
};

PaidOrders.propTypes = {
  token: PropTypes.string.isRequired,
};

export default PaidOrders;
