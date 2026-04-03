// HTTP client for communicating with the backend server
// Replaces local SQLite + Claude API calls

const DEFAULT_SERVER_URL = 'http://77.42.78.9:3100';

let serverUrl = process.env.MONG_SERVER_URL || DEFAULT_SERVER_URL;
let apiToken = process.env.MONG_API_TOKEN || '';

export function setServerUrl(url: string) {
  serverUrl = url;
}

export function setApiToken(token: string) {
  apiToken = token;
}

export function getServerUrl(): string {
  return serverUrl;
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const url = `${serverUrl}/api${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const options: RequestInit = { method, headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Server error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
  put: (path: string, body: any) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
};
