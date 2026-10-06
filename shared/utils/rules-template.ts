// shared/utils/rules-template.ts
// Starter rules for a new group, filled in from its settings. The owner edits
// them freely; members accept the final version before activation.
import { formatKobo } from './money'

export interface RulesTemplateInput {
  name: string
  contributionAmount: number // kobo
  frequency: 'weekly' | 'monthly'
  plannedMemberCount: number
  recipientContributes: boolean
}

export function defaultRules(input: RulesTemplateInput): string {
  const amount = input.contributionAmount ? formatKobo(input.contributionAmount) : 'the agreed amount'
  const period = input.frequency === 'weekly' ? 'every week' : 'every month'
  const recipientLine = input.recipientContributes
    ? 'The member receiving the payout in a round also pays their own contribution for that round.'
    : 'The member receiving the payout in a round does not contribute in that round.'

  return [
    `Rules for ${input.name || 'our group'}`,
    '',
    `1. Each of the ${input.plannedMemberCount || 'agreed number of'} members contributes ${amount} ${period}, on or before the due date.`,
    '2. Pay the round\'s recipient directly by bank transfer (or another method the group agrees). Ajo Manager never holds money.',
    '3. After paying, tap "Mark as paid" and add the transfer reference or a screenshot.',
    '4. A payment counts only after the recipient or a group admin confirms it.',
    `5. ${recipientLine}`,
    '6. Each member receives one payout per cycle, in the agreed order. Positions cannot be changed once the group starts.',
    '7. If you cannot pay on time, tell the group admin before the due date.',
    '8. Disagreements are raised as a dispute in the app and handled respectfully by the group admins.'
  ].join('\n')
}
