<!-- Managed by One Small Engineering (one-small-engineering/ai-standards 1.0.0). Do not edit: put project rules in .ai/project.md. ose ai sync refreshes this file only while it is unmodified. -->

# Accessibility

## Core rules

- UI targets WCAG 2.2 AA unless the project sets a stricter bar: semantic HTML first, ARIA only when needed.
- Full keyboard operation, logical focus order, visible focus; labels and accessible names for every control; text alternatives; errors described in text.
- Contrast 4.5:1 for text and 3:1 for large text and UI parts; respect reduced motion; work at 320 px wide and 200% zoom.
- Automated checks cover only part of WCAG: never claim compliance from them alone, and list the manual checks still needed.

## Details

- Manual checks to list when they were not done: a keyboard-only pass and a screen reader pass of the changed flows.
- Interaction states (hover, focus, active, disabled, selected, expanded) are conveyed by more than color and exposed to assistive technology.
- Dialogs trap and restore focus; dynamic updates use live regions where users need to hear them.
- Touch targets are at least 24 by 24 CSS px.
- Headings form an outline; landmarks identify page regions; link text makes sense out of context.
- Forms keep entered data on error and describe how to fix each problem.
