# @heurist/client-core

Shared, framework-neutral infrastructure for independent Heurist Vite modules.

- `@heurist/client-core/api` — public API transport and structured errors;
- `@heurist/client-core/host` — generic host contract and bootstrap bridge access;
- `@heurist/client-core/config` — common bootstrap envelope normalization;
- `@heurist/client-core/contracts` — stable common constants and event names.

This package must not depend on `heurist-map`, another presentation module,
HAPI4, HRecordSet, jQuery, `window.hWin`, Leaflet or a UI framework.

Module-specific providers, settings schemas, host capabilities and UI remain in
their owning projects. The package currently exposes source ESM directly, so
Vite and Node do not require a separate library build step.
