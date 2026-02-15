import type { LucideIcon } from 'lucide-react';
import { Clock, Heart, Wallet, Briefcase } from 'lucide-react';

export interface AlmanacEntry {
  id: string;
  title: string;
  keywords: string[];
  body: string;
}

export interface AlmanacCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  entries: AlmanacEntry[];
}

export const ALMANAC_CATEGORIES: AlmanacCategory[] = [
  {
    id: 'time',
    label: 'Time & Actions',
    icon: Clock,
    entries: [
      {
        id: 'city-clock',
        title: 'The City Clock',
        keywords: ['time', 'hour', 'day', 'reset', 'midnight', 'real-time'],
        body: `Blueth City runs on its own clock — one real-world hour is one city hour. The day resets every 24 hours at midnight local time. Your daily bills are charged, meal counters reset, and a fresh cycle begins. Plan ahead: time keeps moving whether you're watching or not.`,
      },
      {
        id: 'action-queue',
        title: 'Action Queue',
        keywords: ['queue', 'actions', 'schedule', 'timer', 'pending', 'duration'],
        body: `Everything you do in Blueth City goes through the Action Queue. Eat a meal, work a shift, take a nap — each action takes real time. You can queue up to 12 actions at once, and each one takes at least 5 minutes. The queue shows you a live countdown with an estimated end time, so you always know when your next action wraps up.`,
      },
      {
        id: 'circadian',
        title: 'Circadian Rhythms',
        keywords: ['morning', 'afternoon', 'evening', 'night', 'peak', 'regen', 'bonus'],
        body: `Your body follows a natural rhythm. Each of Blueth City's time periods carries different regen bonuses:\n\n• Morning (06:00–12:00): Physical Vigor peaks at ×1.5\n• Afternoon (12:00–18:00): Social and Creative Vigor thrive at ×1.5\n• Evening (18:00–00:00): Spiritual Vigor gets its ×1.5 boost\n• Night (00:00–06:00): Everything slows to ×0.5\n\nTime your activities wisely. Working physical jobs in the morning or socializing in the afternoon makes a real difference.`,
      },
    ],
  },
  {
    id: 'vigor',
    label: 'Vigor',
    icon: Heart,
    entries: [
      {
        id: 'what-is-vigor',
        title: 'What is Vigor?',
        keywords: ['pv', 'mv', 'sv', 'cv', 'spv', 'physical', 'mental', 'social', 'creative', 'spiritual', 'dimensions', 'cap'],
        body: `Vigor is the lifeblood of your character. It tracks how sharp and ready you are across five dimensions:\n\n• PV (Physical Vigor) — Your body's stamina. Drained by manual labor, restored by rest and food.\n• MV (Mental Vigor) — Your mental edge. Used for thinking-heavy jobs, boosted by sleep (MV gets a ×1.2 bonus while sleeping!).\n• SV (Social Vigor) — Your social battery. Depleted by isolation, recharged by social calls and leisure.\n• CV (Creative Vigor) — Your creative spark. Needed for creative work, restored by leisure activities.\n• SPV (Spiritual Vigor) — Your inner peace. The hidden multiplier: when SPV drops below 50, ALL regen rates slow down.\n\nEach dimension has a cap (starts at 100) that sets the maximum. Vigor regenerates hourly based on your current modifiers.`,
      },
      {
        id: 'keeping-edge',
        title: 'Keeping Your Edge',
        keywords: ['meals', 'sleep', 'housing', 'buffs', 'regen', 'bonuses', 'upgrade'],
        body: `There are several ways to boost your vigor regen:\n\n• Meals: Eating grants temporary buffs that boost specific vigor dimensions. Higher-quality meals give stronger buffs. You can eat up to 3 meals per day before penalties kick in.\n\n• Sleep: Resting regenerates all dimensions. Mental Vigor gets a special ×1.2 bonus while you're asleep.\n\n• Housing: Upgrading your housing tier adds a flat hourly regen bonus to all dimensions. Even a small studio apartment helps.\n\nClick any vigor stat in the HUD to see your exact regen breakdown — base rate, circadian multiplier, active buffs, and more.`,
      },
      {
        id: 'burnout',
        title: 'Burnout & the Cascade',
        keywords: ['cascade', 'drain', 'critical', 'low', 'penalty', 'threshold', 'burnout'],
        body: `When any vigor dimension drops below 20, it's considered "critical." Critical dimensions drain other dimensions — this is the cascade effect. The lower your critical dimensions, the harder the drain hits.\n\nSpiritual Vigor (SPV) is especially important: when SPV drops below 50, all your other vigor dimensions regenerate slower. Think of it as inner burnout that affects everything.\n\nIf you find yourself in a cascade spiral, prioritize rest and meals to recover. Don't try to push through.`,
      },
      {
        id: 'meals-nutrition',
        title: 'Meals & Nutrition',
        keywords: ['eat', 'food', 'street', 'fine dining', 'home cooking', 'penalty', 'buff', 'meals per day'],
        body: `You can eat up to 3 meals per day at no penalty. Each meal beyond the 3rd applies an increasing regen penalty:\n\n• 4th meal: ×0.75 penalty on all regen\n• 5th meal: ×0.50 penalty\n• 6th+ meal: ×0.25 penalty\n\nMeal quality matters. Street food is cheap but gives modest buffs. Home cooking is free (if you have a kitchen) and solid. Fine dining costs more but provides the strongest boosts — and even grants instant SV gains.\n\nThe penalty counter resets at midnight, so plan your meals carefully.`,
      },
    ],
  },
  {
    id: 'economy',
    label: 'Economy',
    icon: Wallet,
    entries: [
      {
        id: 'currency',
        title: 'Blueth Currency',
        keywords: ['money', 'cash', 'balance', 'blueth', 'cents', 'format'],
        body: `The official currency of Blueth City is displayed as ₿ (Blueth). All amounts are tracked in cents internally, so ₿1.00 = 100 cents. You start with a modest balance — enough to get by for a few days if you're careful.\n\nKeep an eye on your balance in the HUD. Click it to see your daily burn rate and how many days you can survive at current spending.`,
      },
      {
        id: 'getting-paid',
        title: 'Getting Paid',
        keywords: ['jobs', 'work', 'shift', 'pay', 'salary', 'skill', 'performance', 'income'],
        body: `Jobs are your main source of income. Each job falls into a family — physical, administrative, service, or management. You can take short or full shifts:\n\n• Short shifts: Less time, less pay, less vigor cost\n• Full shifts: More time, more pay, more vigor cost\n\nYour pay depends on your skill level in that job family. Skills improve every time you work, so sticking with one family pays off over time. Performance also matters — working with higher vigor means better pay.`,
      },
      {
        id: 'bills-housing',
        title: 'Bills & Housing',
        keywords: ['rent', 'utilities', 'housing', 'tier', 'upgrade', 'daily', 'burn', 'cost', 'apartment', 'studio'],
        body: `Every day at midnight, your bills are due. You pay rent plus utilities based on your housing tier:\n\n• Tier 0 (Shelter): Free, but no regen bonus\n• Tier 1 (Studio): Low rent, small regen bonus\n• Tier 2 (1-Bedroom): Moderate rent, better regen\n• Tier 3 (2-Bedroom): Comfortable, even better regen\n• Tier 4 (Penthouse): Premium living, maximum regen bonuses\n\nHigher housing costs more daily but the regen bonus saves you money on meals and recovery time. Check your Bills page to see your exact daily burn rate and how many days of runway you have.`,
      },
      {
        id: 'market',
        title: 'The Market',
        keywords: ['market', 'trade', 'buy', 'sell', 'order', 'exchange', 'day trade', 'limit'],
        body: `The Blueth Market is where citizens trade goods. You can place limit orders to buy or sell at specific prices, and they'll fill when a matching order exists.\n\nDay trading is available for the ambitious, but be careful — each trade session costs Mental Vigor, and doing more than 3 per day applies a Spiritual stress penalty. The market rewards patience more than speed.`,
      },
    ],
  },
  {
    id: 'strategy',
    label: 'Queue & Strategy',
    icon: Briefcase,
    entries: [
      {
        id: 'planning-day',
        title: 'Planning Your Day',
        keywords: ['plan', 'schedule', 'priority', 'order', 'efficient', 'routine'],
        body: `A well-planned day makes all the difference. Here's a solid routine:\n\n1. Eat breakfast first — the meal buff boosts your regen for hours\n2. Work during your peak hours (physical jobs in the morning, mental work all day)\n3. Take a leisure break in the afternoon for SV/CV recovery\n4. Eat dinner, then queue a sleep action for the night\n\nThe Action Queue shows scheduled times for each pending action, so you can plan your sequence before committing.`,
      },
      {
        id: 'buff-stacking',
        title: 'Buff Stacking',
        keywords: ['buff', 'stack', 'combo', 'synergy', 'meal', 'leisure', 'bonus'],
        body: `Buffs from different sources stack additively. A meal buff and a leisure buff running at the same time means your regen rate gets both bonuses added together.\n\nThe key insight: eat a good meal BEFORE doing anything else. The buff lasts for hours and boosts all your subsequent regen. Then add a leisure activity for extra dimension-specific boosts.\n\nCheck the vigor detail modal (click any stat in the HUD) to see exactly what buffs are active and how much time they have left.`,
      },
      {
        id: 'recovery',
        title: 'Recovery Strategies',
        keywords: ['broke', 'recovery', 'low', 'emergency', 'help', 'stuck'],
        body: `Fell on hard times? Here's how to recover:\n\n• Low on cash: Take short shifts in your highest-skilled job family. Short shifts cost less vigor per ₿ earned. Downgrade housing if you need to cut costs.\n\n• Low on vigor: Eat a meal (street food is cheap) and queue a long sleep. Don't try to work through exhaustion — the performance penalty means you earn less anyway.\n\n• In cascade: Focus on the critical dimension first. One meal buff targeting the right dimension can break the cascade spiral.\n\n• Completely stuck: You can always eat street food for ₿2 and take a shelter nap. It's slow, but it's a path forward.`,
      },
    ],
  },
];
