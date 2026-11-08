const config = typeof window !== 'undefined' ? window.SHOPPER_CONFIG || {} : {};
const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');

export const API_URL = normalizeBaseUrl(config.apiUrl || (
  typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:4000'
    : ''
));
export const WORKER_URL = normalizeBaseUrl(config.workerUrl || '');
export const JOTFORM_URL = config.jotformUrl || '';
