import { loadHabitsData, saveHabitsData } from '@/app/actions/data'
import { getNowInMilliseconds } from '@/lib/utils'
import {
  getListLimit,
  getRequestedUserId,
  limitItems,
  normalizeOwnedUserIds,
  ok,
  requireNumber,
  requireOptionalBoolean,
  requirePermission,
  requireString,
  resolveTargetUserId,
  filterHabitsByUserId,
  parseJsonBody,
  withApiRoute,
} from '@/utils/api'

type CreateHabitBody = {
  name: unknown
  description?: unknown
  frequency: unknown
  coinReward: unknown
  targetCompletions?: unknown
  isTask?: unknown
  archived?: unknown
  pinned?: unknown
  drawing?: unknown
  userId?: unknown
  userIds?: unknown
}

/**
 * Lists the visible habits for the authenticated API caller.
 * Scope: API v1 habits collection endpoint.
 */
export async function GET(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    const limit = getListLimit(request)
    const targetUserId = await resolveTargetUserId(user, getRequestedUserId(request))
    const habitsData = filterHabitsByUserId(await loadHabitsData(), targetUserId)

    return ok({ habits: limitItems(habitsData.habits, limit), limit })
  })
}

/**
 * Creates a new habit for the authenticated user or an admin-selected owner set.
 * Scope: API v1 habits collection endpoint.
 */
export async function POST(request: Request) {
  return withApiRoute(request, async ({ user }) => {
    requirePermission(user, 'habit', 'write')

    const body = await parseJsonBody<CreateHabitBody>(request)
    const currentHabits = await loadHabitsData()
    const ownerUserIds = await normalizeOwnedUserIds(
      user,
      typeof body.userId === 'string' ? body.userId : undefined,
      body.userIds
    )
    const habit = {
      id: getNowInMilliseconds().toString(),
      name: requireString(body.name, 'name'),
      description: typeof body.description === 'string' ? body.description : '',
      frequency: requireString(body.frequency, 'frequency'),
      coinReward: requireNumber(body.coinReward, 'coinReward'),
      targetCompletions: typeof body.targetCompletions === 'number' ? body.targetCompletions : undefined,
      completions: [],
      isTask: requireOptionalBoolean(body.isTask, 'isTask'),
      archived: requireOptionalBoolean(body.archived, 'archived'),
      pinned: requireOptionalBoolean(body.pinned, 'pinned'),
      drawing: typeof body.drawing === 'string' ? body.drawing : undefined,
      userIds: ownerUserIds,
    }

    await saveHabitsData({ habits: [...currentHabits.habits, habit] })
    return ok({ habit }, 201)
  })
}