import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, ApiError, setToken, getToken } from './api'

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })
describe('api client', () => {
  it('sends bearer token and parses json', async () => {
    setToken('abc')
    const f = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) })
    expect(await api('/me')).toEqual({ ok: 1 })
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
    expect(f.mock.calls[0][0]).toBe('/api/me')
  })
  it('turns server errors into ApiError with Arabic message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: 'هذا البريد مسجل من قبل' }) })
    await expect(api('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 409, message: 'هذا البريد مسجل من قبل' })
  })
  it('clears token on 401', async () => {
    setToken('abc')
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: 'x' }) })
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
  })
  it('reports network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('down'))
    await expect(api('/x')).rejects.toMatchObject({ status: 0 })
  })
})
