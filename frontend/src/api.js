const TOKEN_KEY = 'ons_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function message(detail) {
  if (!detail) return 'حدث خطأ غير متوقع'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return 'تحقق من البيانات المدخلة'
  return 'حدث خطأ غير متوقع'
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const t = getToken()
  if (auth && t) headers.Authorization = 'Bearer ' + t
  let res
  try {
    res = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, 'تعذر الاتصال بالخادم. تحقق من الإنترنت.')
  }
  let data = null
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) { setToken(null); window.dispatchEvent(new Event('ons-logout')) } // expired/invalid session: sign out cleanly so the login screen shows instead of an error
    throw new ApiError(res.status, message(data?.detail))
  }
  return data
}
export const get = (p) => api(p)
export const post = (p, body = {}) => api(p, { method: 'POST', body })
export const put = (p, body = {}) => api(p, { method: 'PUT', body })
export const patch = (p, body = {}) => api(p, { method: 'PATCH', body })
export const del = (p) => api(p, { method: 'DELETE' })
