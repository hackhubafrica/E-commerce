import { fireEvent, render, screen } from '@testing-library/react';
import ShopContextProvider, { ShopContext } from './Context/ShopContext';
import { useContext } from 'react';
import getImageSrc from './utils/getImageSrc';

function CartTestHarness() {
  const { addToCart, removeFromCart, getTotalCartAmount } = useContext(ShopContext);

  return (
    <div>
      <output aria-label="cart total">{getTotalCartAmount()}</output>
      <button onClick={() => addToCart(1)}>Add first item</button>
      <button onClick={() => addToCart(2)}>Add second item</button>
      <button onClick={() => removeFromCart(1)}>Remove first item</button>
    </div>
  );
}

test('cart totals include multiple products and removing the last item does not make quantities negative', () => {
  render(
    <ShopContextProvider>
      <CartTestHarness />
    </ShopContextProvider>
  );

  expect(screen.getByLabelText('cart total')).toHaveTextContent('0');
  fireEvent.click(screen.getByText('Add first item'));
  fireEvent.click(screen.getByText('Add second item'));
  expect(screen.getByLabelText('cart total')).toHaveTextContent('135');

  fireEvent.click(screen.getByText('Remove first item'));
  expect(screen.getByLabelText('cart total')).toHaveTextContent('85');
  fireEvent.click(screen.getByText('Remove first item'));
  expect(screen.getByLabelText('cart total')).toHaveTextContent('85');
});

test('image assets work as Astro metadata and regular URLs', () => {
  expect(getImageSrc('/assets/product.png')).toBe('/assets/product.png');
  expect(getImageSrc({ src: '/_astro/product.hash.png' })).toBe('/_astro/product.hash.png');
});
