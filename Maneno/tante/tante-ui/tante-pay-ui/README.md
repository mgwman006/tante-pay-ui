# Tante Pay UI

## Development-only simulated top-ups

To enable the simulated top-up control during local development, set
`VITE_ENABLE_SIMULATED_TOP_UP=true` when starting the Vite development server.
The simulation is not included in production builds; the Load funds dialog
instead explains that a payment-provider integration is required.

The backend's top-up endpoint directly credits its configured database without
collecting funds. Use this option only with an isolated development backend and
test accounts; never point it at real account data. A real top-up requires a
payment-provider integration.
