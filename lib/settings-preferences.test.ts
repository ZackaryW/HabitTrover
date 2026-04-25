import { describe, expect, test } from 'bun:test'
import { getDefaultSettings, User } from '@/lib/types'
import { resolveSettingsForUser, splitSettingsPersistence } from '@/lib/settings-preferences'

describe('settings preferences', () => {
  test('resolves effective settings using the user language override', () => {
    const baseSettings = getDefaultSettings()
    baseSettings.system.language = 'en'

    const user: User = {
      id: 'user-1',
      username: 'alice',
      isAdmin: false,
      language: 'fr',
    }

    expect(resolveSettingsForUser(baseSettings, user).system.language).toBe('fr')
    expect(resolveSettingsForUser(baseSettings).system.language).toBe('en')
  })

  test('persists language as a user-specific setting while keeping the global fallback intact', () => {
    const baseSettings = getDefaultSettings()
    baseSettings.system.language = 'en'

    const nextSettings = {
      ...baseSettings,
      system: {
        ...baseSettings.system,
        timezone: 'America/New_York',
        language: 'de',
      },
    }

    const result = splitSettingsPersistence({
      baseSettings,
      nextSettings,
      user: {
        id: 'user-1',
        username: 'alice',
        isAdmin: false,
      },
    })

    expect(result.settingsToPersist.system.timezone).toBe('America/New_York')
    expect(result.settingsToPersist.system.language).toBe('en')
    expect(result.userLanguage).toBe('de')
  })
})