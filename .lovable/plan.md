## Goal

Produce two downloadable WordPress artifacts in `/mnt/documents/` that mirror the Ikeja LGA Nexus Sync architecture. The existing Lovable React/Supabase app is not modified.

- `ikeja-nexus-sync-theme.zip` — WordPress theme (UI, portals, templates)
- `ikeja-nexus-sync-core.zip` — Companion plugin (CPTs, REST API, geofence, device binding, chat backend, role mapping)

Why split: WordPress best practice — themes handle presentation, plugins own data + behaviour so the user can switch themes later without losing CPTs, attendance records, or chat history.

## Deliverable structure

```text
ikeja-nexus-sync-theme/
├── style.css              # Theme header + Tailwind-compatible base
├── functions.php          # Enqueue scripts, theme supports, nav menus
├── header.php             # <head>, wp_head(), top wrapper
├── footer.php             # Mobile Bottom Nav Bar, wp_footer()
├── front-page.php         # Public landing + Impact Metrics loop
├── index.php              # 4-portal router by current_user_can()
├── page-portal-hub.php    # Inner dashboard shell
├── template-parts/
│   ├── portal-lgi.php           # Super-Admin control panel
│   ├── portal-admin.php         # Admin Nerve Center
│   ├── portal-corporate.php     # Synergy Hub (+ KYC gate)
│   ├── portal-corps.php         # User Utility Hub
│   ├── chat-room.php            # Polling chat UI
│   ├── club-picker.php          # Advocacy club selection
│   ├── absence-form.php
│   └── notification-bell.php
├── assets/
│   ├── js/app.js                # Framer Motion init, polling, fingerprint
│   ├── js/chat.js               # AJAX poll loop
│   ├── js/geofence.js           # Geolocation + Haversine check
│   └── css/theme.css            # Green/white tokens
└── screenshot.png

ikeja-nexus-sync-core/  (companion plugin)
├── ikeja-nexus-sync-core.php    # Plugin bootstrap
├── includes/
│   ├── cpt-outreach-reports.php
│   ├── cpt-absence-requests.php
│   ├── cpt-corporate-jobs.php
│   ├── taxonomies.php           # status: submitted/pending/approved
│   ├── rest-api.php             # /wp-json/ikeja/v1/{chat,notifications,attendance,device}
│   ├── roles.php                # Map roles: Subscriber/Contributor/Editor/Administrator → Corps/Corporate/Admin/LGI
│   ├── device-binding.php       # Fingerprint storage in user_meta
│   ├── geofence.php             # Server-side coordinate validation
│   └── chat-store.php           # Custom table wp_ikeja_chat_messages
└── readme.txt
```

## Role mapping

| WP Role | GRP Role | Capability check |
|---|---|---|
| Administrator | LGI Super-Admin | `manage_options` |
| Editor | Admin | `edit_others_posts` |
| Contributor | Corporate Firm | `edit_posts` + `corporate_approved` meta |
| Subscriber | Corps Member | `read` |

## Routing logic (index.php)

```text
if !is_user_logged_in() → front-page.php
elseif current_user_can('manage_options') → portal-lgi.php
elseif current_user_can('edit_others_posts') → portal-admin.php
elseif current_user_can('edit_posts')
    if get_user_meta(corporate_approved) → portal-corporate.php
    else → kyc-upload.php
else → portal-corps.php
```

Every template begins with a `current_user_can()` guard before rendering.

## Realtime strategy

Per your choice: **polling**. `assets/js/chat.js` calls `GET /wp-json/ikeja/v1/chat?since={id}` every 4s; new messages POST to the same endpoint. Notification bell polls `/wp-json/ikeja/v1/notifications` every 15s. No external service or API key needed.

## Feature scope honesty

Fully working out of the box:
- Theme styling (green/white Tailwind palette, Framer Motion via CDN, Lucide icons)
- All CPTs + taxonomies + admin meta boxes
- Role-based portal routing
- Public landing with dynamic Impact Metrics loop
- Absence request form + Editor approval workflow
- Corporate KYC gate
- Club picker stored in user meta
- Polling chat + notifications
- Device fingerprint binding (FingerprintJS via CDN, stored in user_meta, "new device" alert email)
- Geofenced attendance (browser geolocation → server validates lat/lng against event radius)

Caveats:
- Rotating QR is implemented as a 30s-rotating token in the plugin (cron-driven); not as cryptographically equivalent to the React app's original — good enough for NYSC roll-call.
- Chat is polled not push; fine for an LGA-sized cohort but not WhatsApp-scale.
- No Supabase data is migrated — the WP install starts empty. Users re-register on WP.

## Build process

1. Scaffold the two folders under `/tmp/wp-build/`.
2. Write all PHP/JS/CSS files using the exact header you specified in `style.css`.
3. Zip both into `/mnt/documents/ikeja-nexus-sync-theme.zip` and `/mnt/documents/ikeja-nexus-sync-core.zip`.
4. Emit `<presentation-artifact>` tags for both zips so you can download.
5. Provide a short install guide (upload theme, upload plugin, activate, create the LGI Administrator user).

## What I will NOT do

- Touch any file in this React project.
- Migrate Supabase data to WordPress (separate task if you want it).
- Configure a live WordPress host — you install on your own WP site.

Approve to build, or tell me to adjust scope (e.g. skip the plugin and put everything in the theme, or add a Supabase→WP data migration script).