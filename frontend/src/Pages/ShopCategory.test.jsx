import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShopContext } from '../Context/ShopContext';
import ShopCategory from './ShopCategory';

test('office collection makes imported desk products visible to shoppers', () => {
  const product = {
    id: 'mongo-product-1',
    name: 'Compact desk organizer',
    image: 'https://images.example/organizer.jpg',
    category: 'office',
    new_price: 19.99,
    old_price: 19.99,
  };

  render(
    <MemoryRouter>
      <ShopContext.Provider value={{ all_product: [product], catalogError: '' }}>
        <ShopCategory category="office" title="Office & desk" />
      </ShopContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: 'Office & desk' })).toBeInTheDocument();
  expect(screen.getByText('Compact desk organizer')).toBeInTheDocument();
});
