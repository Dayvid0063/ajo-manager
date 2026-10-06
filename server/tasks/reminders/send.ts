// server/tasks/reminders/send.ts
// Hourly (see nitro.scheduledTasks in nuxt.config.ts). Safe to re-run: each
// reminder is sent once. In development you can trigger it manually at
// /_nitro/tasks/reminders:send
import { runReminders } from '../../services/reminders'

export default defineTask({
  meta: {
    name: 'reminders:send',
    description: 'Send due-soon, due-today, overdue and payout reminders'
  },
  async run() {
    const result = await runReminders(new Date())
    return { result }
  }
})
