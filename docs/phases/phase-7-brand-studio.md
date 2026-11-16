# Phase 7: Brand Studio

**Status: IN PROGRESS**

## Objective

One place to define and reuse the TaskForge brand and the personal brand (visual identity, voice, assets), with help for LinkedIn and GitHub presentation.

## Why it matters

Consistent branding makes the portfolio and the public presence look intentional and professional.

## Scope

TaskForge brand, personal brand, colors, fonts, logos, brand voice, writing style, image prompts, generated assets, and LinkedIn/GitHub presentation support.

## Planned capabilities

- TaskForge brand and personal brand profiles
- Colors, fonts, logos
- Brand voice and writing style
- Image prompts and generated assets
- LinkedIn/GitHub presentation support

## Dependencies

- Phase 2 (agents, for drafting in the brand voice)
- Phase 3 (knowledge, to store brand guidelines)

## Definition of done

Brand profiles are stored and editable. Agents can draft content in the defined voice. Assets are organized and exportable.

## Portfolio/career value

Shows design-system thinking and practical content tooling.

## Cost constraints

$0. Store assets within free-tier limits. Image generation is opt-in only and must not create recurring cost.

## Shipped

- Brand profiles API (KAN-73): one TaskForge and one personal profile per user, each with a name, tagline, colors, fonts, logo links, brand voice, writing style and image prompts. Text only, with no uploads, image generation or AI.

- Brand Studio page (KAN-74): `/brand`, in the sidebar. Pick the TaskForge or personal profile and edit and save every field, with repeatable rows for colors, fonts, logos and image prompts; unsaved edits stay when switching profiles. Each valid color shows a swatch and a rule-based WCAG contrast check against white and black text, in words. Site-path logos are previewed; https logos are links. "Download brand guide" saves the saved profile as Markdown, built in the browser.

## Notes/decisions

- The existing TaskForge logos live in `client/public/`.
