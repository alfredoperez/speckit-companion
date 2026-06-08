# Bench prompt — EASY ("Rename the app title")

A trivial, one-area change — updating the title/branding. Paste everything between the rules into the specify step. The **Required affordance** pins the exact text so the bench can grade it.

---

Rename the app from "Todo App" to "Task Manager".

**Behavior**

- The main heading shown in the app header reads "Task Manager".
- The browser tab title (`<title>` in `index.html`) also reads "Task Manager".

**Required affordance (the bench grades this — match exactly)**

- The header `<h1>` (in `src/components/Header.tsx`) renders the exact text `Task Manager`.

Change nothing else — no new routes, components, or behavior.

---
