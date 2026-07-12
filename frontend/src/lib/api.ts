const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code: string;
  field?: string;
  meta?: any;

  constructor(status: number, errorData: { code: string; message: string; field?: string; meta?: any }) {
    super(errorData.message);
    this.status = status;
    this.code = errorData.code;
    this.field = errorData.field;
    this.meta = errorData.meta;
    this.name = 'ApiError';
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData;
    try {
      const resJson = await response.json();
      errorData = resJson.error || { code: 'unknown_error', message: resJson.message || 'An error occurred' };
    } catch {
      errorData = { code: 'network_error', message: 'Network error or invalid response' };
    }
    throw new ApiError(response.status, errorData);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}
