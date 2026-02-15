# Almanac Content Guide

## Overview

The Almanac is an in-game guide available at `/almanac`. It provides players with game mechanics explanations written in an in-game newspaper/guidebook tone — NOT technical documentation.

## Content Structure

All content lives in `apps/web/src/lib/almanac-data.ts`.

### Categories

| Category | Icon | Entries |
|---|---|---|
| Time & Actions | Clock | The City Clock, Action Queue, Circadian Rhythms |
| Vigor | Heart | What is Vigor?, Keeping Your Edge, Burnout & the Cascade, Meals & Nutrition |
| Economy | Wallet | Blueth Currency, Getting Paid, Bills & Housing, The Market |
| Queue & Strategy | Briefcase | Planning Your Day, Buff Stacking, Recovery Strategies |

### Entry Shape

```ts
interface AlmanacEntry {
  id: string;        // kebab-case unique ID
  title: string;     // Display title
  keywords: string[]; // Search keywords (lowercase)
  body: string;      // Multi-line body text (in-game tone)
}
```

## Adding New Entries

1. Open `apps/web/src/lib/almanac-data.ts`
2. Add a new entry to the appropriate category's `entries` array
3. Include relevant keywords for search discoverability
4. Write the body in-game tone (see Tone Guidelines below)

To add a new category:

```ts
{
  id: 'new-category',
  label: 'Category Label',
  icon: SomeLucideIcon,
  entries: [
    { id: 'entry-1', title: 'Entry Title', keywords: ['keyword'], body: '...' },
  ],
}
```

## Search Behavior

Search is case-insensitive substring match across `title + keywords + body`. When search is active, only matching entries (and their parent categories) are shown.

## Tone Guidelines

- Write as if you're a city newspaper or guidebook
- Use second person ("you", "your")
- Be practical and actionable — tell the player what to DO
- Include specific numbers where relevant (costs, regen rates, thresholds)
- Use bullet points for lists
- Avoid technical terms (say "your character" not "the client state")
- Keep entries focused — one concept per entry
