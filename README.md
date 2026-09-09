# @heurist/client-core

Shared, framework-neutral infrastructure for independent Heurist Vite modules.

- `@heurist/client-core/api` — public API transport and structured errors;
- `@heurist/client-core/host` — generic host contract and bootstrap bridge access;
- `@heurist/client-core/config` — common bootstrap envelope normalization;
- `@heurist/client-core/contracts` — stable common constants and event names;
- `@heurist/client-core/ui` — plain-DOM localization (`$HR`/`applyI18n`/`initLocale`),
  the `InlineHelp` and `PublishedDialog` overlay components, and the generic
  persisted-configuration envelope/value-normalizer helpers reused by each
  module's own configuration schema.

This package must not depend on `heurist-map`, another presentation module,
HAPI4, HRecordSet, jQuery, `window.hWin`, Leaflet or a UI framework — `ui`
components are plain DOM, no framework, and take any module-specific value
(format string, module name, manual content) as a parameter from the caller.

Module-specific providers, settings schemas, host capabilities, and
module-specific UI (configuration dialogs, control panels, engine adapters)
remain in their owning projects. The package currently exposes source ESM
directly, so Vite and Node do not require a separate library build step.

## Shared widgets and UI

Reusable framework-independent widgets are exported from `@heurist/client-core/widgets`.
Current shared widgets are `HBaseWidget` and `HRecordList`. Shared visual tokens and UI
primitives live in `src/ui/heurist-ui.css` and are exported as
`@heurist/client-core/ui/heurist-ui.css`. `HMsg` is exported from
`@heurist/client-core/ui` and uses the native HTML `<dialog>` element rather than Bootstrap.

## Reusable widgets

Shared widgets are exported from `@heurist/client-core/widgets`.
They use the framework-independent stylesheet `@heurist/client-core/ui/heurist-ui.css`.

### HFilter V1

`HFilter` is a compact DataSource selector for direct Heurist queries and saved filters.
It validates a source with `/records?detail=count` before emitting `datasourcechange`.
It deliberately does not perform layout/module synchronization.

```js
import { HeuristApiClient } from '@heurist/client-core';
import { HFilter } from '@heurist/client-core/widgets';
import '@heurist/client-core/ui/heurist-ui.css';

const apiClient = new HeuristApiClient({ apiBaseUrl, database });
const filter = new HFilter({ apiClient }).attach(container, {
  onSearchTools: ({ query }) => openExistingSearchTools(query),
  onDataSource: (dataSource) => useDataSource(dataSource)
});
await filter.render();
```

V1 supports direct input, saved-filter search, owner-group filtering, simple/parametrized type filtering, active-row display, lazy saved-filter loading, and result-count validation. `filterIds` and `activeFilterId` are already accepted as options so module-level "available filters / active filter" configuration can be added later without changing the widget contract.

The persisted schema for parametrized filter inputs is not yet defined. `HFilterForm` is therefore present as the core form container, and `HFilter` exposes `resolveParameterizedFilter` plus the `parameterizedfilter` event rather than inventing a storage format.
