import { loadSettings, saveSettings } from '@/app/actions/data'
import { Settings } from '@/lib/types'
import { ok, parseJsonBody, withApiRoute } from '@/utils/api'

type UpdateSettingsBody = Partial<Settings>

/**
 * Returns the current application settings for the authenticated caller.
 * Scope: API v1 settings endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async () => {
    const settings = await loadSettings()
    return ok({ settings })
  })
}

/**
 * Applies a partial settings update for the authenticated caller.
 * Scope: API v1 settings endpoint.
 */
export async function PATCH(request: Request) {
  return withApiRoute(request, async () => {
    const body = await parseJsonBody<UpdateSettingsBody>(request)
    const currentSettings = await loadSettings()
    const nextSettings: Settings = {
      ...currentSettings,
      ui: {
        ...currentSettings.ui,
        ...(body.ui ?? {}),
      },
      system: {
        ...currentSettings.system,
        ...(body.system ?? {}),
      },
      profile: {
        ...currentSettings.profile,
        ...(body.profile ?? {}),
      },
    }

    await saveSettings(nextSettings)
    return ok({ settings: nextSettings })
  })
}