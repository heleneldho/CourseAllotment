import axios from 'axios';

// The local FastAPI process is bound to IPv4. Using the explicit loopback
// address avoids browsers resolving `localhost` to IPv6 (::1) and reporting
// a generic Axios "Network Error" for mutation requests.
const fallbackBaseUrl = 'http://127.0.0.1:8000';

const normalizeBaseUrl = (url) => String(url || fallbackBaseUrl).replace(/\/+$/, '');

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
});

export default api;
