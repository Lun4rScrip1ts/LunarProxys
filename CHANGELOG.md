# LunarProxys Update Log

## 2026-09-29

### Friends Page UI Redesign
- Rebuilt the Friends page visual system with a new glassmorphic Lunar interface.
- Redesigned the server rail, Friends sidebar, friend list, tabs, search area, DM header, profile introduction, message list, message hover controls, reactions, and composer.
- Added consistent borders, depth, spacing, gradients, hover states, responsive behavior, and mobile layouts.
- Preserved the existing Friends page HTML structure and JavaScript behavior so conversations, DM history, friend requests, blocking/reporting, reactions, GIFs, emoji, stickers, message actions, forwarding, profiles, and other existing functionality continue using the same elements and handlers.
- Refreshed the Friends stylesheet cache version to ensure the new UI is loaded after deployment.

### Friends Page Compact Refinement
- Reduced the overall Friends workspace width and height so it no longer fills as much of the viewport.
- Reduced the server rail, Friends sidebar, navigation controls, friend rows, DM header, message sizing, and composer.
- Reworked the DM profile header into a much shorter compact frame so it no longer pushes/clips the conversation.
- Reduced popup and profile-modal dimensions while preserving their existing functionality.
- Added responsive compact sizing for tablet and mobile layouts.
