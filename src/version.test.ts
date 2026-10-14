import { describe, expect, it } from 'vitest'
import { libelleVersion } from './version.ts'

describe('libelleVersion', () => {
  it('préfixe la version du nom de l’application', () => {
    expect(libelleVersion('1.2.3')).toBe('AlgoWeb 1.2.3')
  })
})
