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
