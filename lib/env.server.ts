import { z } from "zod"

const zodEnv = z.object({
  AUTH_SECRET: z.string(),
  API_ADMIN_TOKEN: z.string().optional(),
  DEMO: z.string().optional(),
})

declare global {
  interface ProcessEnv extends z.TypeOf<typeof zodEnv> {
    AUTH_SECRET: string;
    API_ADMIN_TOKEN?: string;
    DEMO?: string;
  }
}

export function init() {
  try {
    zodEnv.parse(process.env)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const { fieldErrors } = err.flatten()
      const errorMessage = Object.entries(fieldErrors)
        .map(([field, errors]) =>
          errors ? `${field}: ${errors.join(", ")}` : field,
        )
        .join("\n ")

      throw new Error(
        `Missing environment variables:\n ${errorMessage}`,
      )
    }
  }
}