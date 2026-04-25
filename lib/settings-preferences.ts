import { Settings, User } from '@/lib/types'

/**
 * Applies a user's language preference over the shared settings fallback.
 * Scope: server-side settings reads and locale resolution.
 */
export function resolveSettingsForUser(baseSettings: Settings, user?: User): Settings {
  return {
    ...baseSettings,
    system: {
      ...baseSettings.system,
      language: user?.language || baseSettings.system.language,
    },
  }
}

/**
 * Splits effective settings into globally persisted settings and per-user language updates.
 * Scope: server-side settings writes that keep locale user-specific.
 */
export function splitSettingsPersistence(args: {
  baseSettings: Settings
  nextSettings: Settings
  user?: User
}): {
  settingsToPersist: Settings
  userLanguage?: string
} {
  const { baseSettings, nextSettings, user } = args

  return {
    settingsToPersist: {
      ...nextSettings,
      system: {
        ...nextSettings.system,
        language: baseSettings.system.language,
      },
    },
    userLanguage: user ? nextSettings.system.language : undefined,
  }
}