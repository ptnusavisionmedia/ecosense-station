# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing: static HTML/CSS/vanilla JS (`web/`) served by an Express backend (`backend/`), SQLite via `node:sqlite`. Kept as-is per explicit user instruction ("gunakan sqlite untuk sementara").

## Users

Primary: a small operator/admin team monitoring a physical water reservoir (tinggi air, pH, turbidity, flow/volume, suhu, kelembapan) via an ESP32 device. Multi-user with roles (admin vs viewer) confirmed by the user for the Account feature — admins manage thresholds/users, viewers monitor only. [Inferred: team size is small, single site/device (`ecosense-01`).]

## Product Purpose

Real-time + historical monitoring dashboard for a reservoir's water quality/level sensors, with configurable alert thresholds and Telegram-based alarm notifications. Success: operators can see live state at a glance, drill into daily/weekly trends, review past alerts, and tune alert thresholds without touching code.

## Positioning

Single-device, self-hosted monitoring stack (no cloud dependency) purpose-built for this reservoir's exact sensor set, with device-level alarm flags and a Telegram bot as the out-of-band notification channel.

## Operating Context

- Backend exposes `/api/latest`, `/api/status`, `/api/history`, `/api/ingest` (device-authenticated), `/api/config/thresholds` (admin-authenticated).
- Device posts readings every ~10s; dashboard polls on the same cadence.
- Telegram bot (`backend/src/telegram.js`) broadcasts alarm state to subscribed chats.
- No existing user-auth system before this feature — only shared `DEVICE_API_KEY` / `ADMIN_API_KEY` secrets.

## Capabilities and Constraints

- New requirement: multi-user accounts with roles (admin, viewer), backed by a new SQLite `users` table (password hashed), session-based login (httpOnly cookie), and role-gated routes/UI.
- New dashboard IA: Home (sensor chart overview), Monitoring (live data), Data (daily/weekly history + alert log), Peringatan (dynamic alert threshold settings, wired to existing `/api/config/thresholds`), Account (user management), Settings (dashboard settings).
- Keep existing API contracts for device ingest and Telegram untouched.

## Brand Commitments

Visual world pinned by explicit user request: Sprout Social's "Seeds" design system (https://seeds.sproutsocial.com/) — flat/minimal, bordered containers over heavy shadows, emerald-green brand accent on neutral grays, 8px spacing grid, 8px/6px/pill border-radius scale, system font stack at 16px body minimum.

## Evidence on Hand

No existing user-facing screenshots beyond the current (soon-to-be-replaced) liquid-glass dashboard in `web/`. No real user list, device fleet, or historical incident data beyond what SQLite already holds.

## Product Principles

1. Operate mode: this is a working tool, not a marketing surface — scanability and consistency over expression.
2. Preserve every existing API contract and Telegram/MQTT behavior; this is a UI + auth restructure, not a backend rewrite.
3. Role boundaries are real: viewers never see user-management or threshold-editing controls, enforced server-side too, not just hidden in CSS.
4. SQLite stays the single source of truth for now; no new external services.
