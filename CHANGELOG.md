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

### Friends Page Layout Visibility Fix
- Fixed the Friends DM view being rendered even while its `hidden` attribute was active, which caused the empty profile/action header and conversation controls to appear on top of the page.
- Added a page-scoped hidden-element guard so `hidden` UI cannot be forced visible by the Friends layout CSS.
- Fixed the sticker collection drawer appearing at the top-left of the Friends page when it was not open.
- Kept the sticker drawer available inside the emoji/sticker picker and synchronized its visibility with the active picker tab.
- Refreshed Friends CSS and JavaScript asset versions.

### Discord-Style Friends/Home UI Rebuild
- Rebuilt the Friends page CSS as a clean Discord-inspired three-panel interface instead of stacking additional overrides onto the previous design.
- Removed the oversized server rail and compacted the workspace into a Friends/conversations sidebar plus a focused DM panel, with the existing profile UI converted into a right-side profile panel.
- Added Discord-style spacing, rounded surfaces, hover states, message hover actions, date dividers, live status dots, unread badges, conversation previews, responsive mobile transitions, and lightweight open/close animations.
- Removed voice/video/search/more controls from the DM header so it only presents the conversation identity, matching the requested layout.
- Kept the existing GIF, emoji, sticker collection, reactions, message actions, friend requests, blocking, forwarding, and profile systems wired to the existing UI.
- Added blocked-user list/unblock controls and an inbox feed for unread DMs and friend requests.
- Added live presence information from active sessions and used it for online/offline status dots.
- Added optimistic DM sending with a temporary Sending state before the backend confirms delivery.
- Added date dividers and dynamic message previews without hardcoded users, messages, or images.
- Updated the backend so DMs can be started with users who are not yet friends while still respecting blocking.
- Added per-thread DM read state for inbox badges and notification clearing.
- Added live profile presence and Member Since metadata.
- Refreshed Friends page CSS/JavaScript asset versions.
