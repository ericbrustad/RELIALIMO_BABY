# Copilot Instructions for RELIALIMO

## Big Picture Architecture
- This is a monolithic JavaScript codebase for a business application (likely dispatch, reservation, and resource management for transportation).
- Major components are organized by feature: reservations, dispatch, accounts, quotes, memos, files, etc. Each feature typically has its own `.js`, `.html`, and `.css` files.
- Service files (e.g., `AffiliateService.js`, `AirlineService.js`, `MapboxService.js`) encapsulate external API integrations and business logic.
- Data flows are mostly client-side, with some files (e.g., `db.json`, `api-service.js`) suggesting local data storage and API communication.

## Developer Workflows
- No build system detected; code is likely run directly in the browser or a simple server environment.
- No test framework or test files found; manual testing via HTML pages is likely.
- Debugging is typically done using browser dev tools.
- To add features, create or update the relevant `.js`, `.html`, and `.css` files for the feature/module.

## Project-Specific Conventions
- Each feature/module is split into three files: `[feature].js`, `[feature].html`, `[feature].css`.
- Service files are named `[ServiceName]Service.js` and handle external integrations or business logic.
- Data/config files use `.json` or `.md` extensions and are referenced by service or manager files.
- No frameworks (React, Angular, etc.) detected; code is plain JavaScript and HTML/CSS.
- Use descriptive filenames and keep logic modular by feature.

## Integration Points & Dependencies
- External APIs: Mapbox, airline/affiliate services, possibly SMS/email providers.
- Data is managed locally or via API calls in `api-service.js`.
- No package manager or dependency manifest detected; all dependencies are likely loaded via CDN or direct script tags.

## Cross-Component Communication
- Shared logic is placed in service files or manager files (e.g., `ReservationManager.js`, `AccountManager.js`).
- UI updates are handled by manipulating the DOM in feature `.js` files.
- Common styles are in `global.css`.

## Examples
- To add a new feature, create `[feature].js`, `[feature].html`, `[feature].css` and link them in `index.html`.
- To integrate a new API, add a `[ServiceName]Service.js` and reference it from the relevant manager or feature file.

## Key Files
- `main.js`: Likely the entry point for app logic.
- `api-service.js`: Handles API communication.
- `ReservationManager.js`, `AccountManager.js`: Core business logic for reservations/accounts.
- `global.css`: Shared styles.

---

For questions or unclear patterns, ask for clarification or examples from the user before making assumptions.
