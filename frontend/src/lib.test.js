import { describe, it, expect } from 'vitest'
import { toAr, ayahShareText, greeting, hijriDate, surahLabel } from './lib'

describe('lib', () => {
  it('converts digits to Arabic-Indic', () => { expect(toAr(604)).toBe('٦٠٤'); expect(toAr('2:255')).toBe('٢:٢٥٥') })
  it('builds share text with surah and ayah', () => {
    const t = ayahShareText({ text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', surah_name: 'ٱلْإِخْلَاصِ', n: 1 })
    expect(t).toContain('﴿قُلْ هُوَ ٱللَّهُ أَحَدٌ﴾'); expect(t).toContain(': 1]'); expect(t).toContain('أُنس | ONS')
  })
  it('greets by time of day', () => {
    expect(greeting(new Date('2026-01-01T08:00:00'))).toBe('صباح النور')
    expect(greeting(new Date('2026-01-01T21:00:00'))).toBe('مساء الخير')
  })
  it('formats a hijri date', () => { expect(hijriDate(new Date('2026-11-25T12:00:00Z'))).toMatch(/١٤٤٨/) })
  it('strips tashkeel from surah label', () => { expect(surahLabel('ٱلْفَاتِحَةِ')).toBe('ٱلفاتحة'.replace('ٱ', 'ٱ')) })
})
