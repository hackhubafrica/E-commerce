import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginSignup from './LoginSignup';

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

test('signup sends the name expected by the API and stores the returned token', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, token: 'test-token' }),
  });
  render(
    <MemoryRouter>
      <LoginSignup />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Create one' }));
  fireEvent.change(screen.getByPlaceholderText('Your name'), {
    target: { value: 'Ada Lovelace' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'long-enough-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

  await waitFor(() => expect(localStorage.getItem('token')).toBe('test-token'));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  });
  expect(await screen.findByRole('status')).toHaveTextContent('Your account has been created.');
});

test('account service errors are shown to the customer', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({ success: false, errors: 'Account service is not configured.' }),
  });
  render(
    <MemoryRouter>
      <LoginSignup />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Account service is not configured.');
});

test('network failures show a helpful account-service message', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
  render(
    <MemoryRouter>
      <LoginSignup />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'ada@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to reach the account service. Please try again later.',
  );
});
