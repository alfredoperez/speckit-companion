# Quickstart: Validate Dark Mode Toggle

Proves the feature end to end. Contracts: [theme-storage](contracts/theme-storage.md), [theme-store-api](contracts/theme-store-api.md), [toggle-ui](contracts/toggle-ui.md). Entity and transitions: [data-model.md](data-model.md).

## Prerequisites

- Node 20+ (for `node --test`). No `npm install` needed; there are no dependencies.
- Any current desktop browser. Chrome DevTools helps for steps 5 and 6.

## 1. Automated checks

```bash
npm test
```

Expect all tests pass, including `src/theme-store.test.js` (store functions, key parity, init-script parity under `node:vm`). The existing `src/store.test.js` still passes (FR-009).

## 2. Serve the app

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. ES modules need `http://`, not `file://`.

## 3. Switch (User Story 1)

1. Clear site data, reload. Add two todos, complete one.
2. Click **Dark mode**. Header, input, button and both todos turn dark at once, no reload.
3. The completed todo is still struck through and readable. Click again: everything returns to light.

Expect: light looks identical to before the feature. Take a screenshot of the light page before implementing and compare.

## 4. Remember (User Story 2)

1. Choose dark, reload. Expect dark with no light flash.
2. Choose light, reload. Expect light.
3. Throttle CPU 6x in DevTools Performance and reload in dark. Expect no light frame (the blocking head script sets the theme before paint).

## 5. First visit follows the system (FR-005, FR-006)

1. In DevTools, Rendering panel, set "Emulate CSS prefers-color-scheme" to dark. Clear site data, reload. Expect dark, toggle `aria-pressed="true"`.
2. Click the toggle. Expect light, saved as `light`. Reload with emulation still dark. Expect light (explicit choice wins).

## 6. Keyboard and screen reader (User Story 3)

1. Tab from the page start: the toggle is reached after the title, before the add input, with a visible focus ring in both themes.
2. Press Enter, then Space. Each flips the theme.
3. With VoiceOver (macOS, Cmd+F5): focus announces "Dark mode, toggle button" plus pressed or not pressed, and the name stays "Dark mode" after switching.

## 7. Failure modes

| Check | How | Expect |
|---|---|---|
| Corrupt value | Console: `localStorage.setItem('tiny-todo.theme','blue')`, reload | System default, no error |
| Blocked storage | Console: `Storage.prototype.setItem = () => { throw new Error() }`, click toggle | Page still switches, no error |
| Rapid toggling | Click 11 times quickly | Final state matches the 11th click, `localStorage` value matches what is shown |
| 500 todos | Console: `localStorage.setItem('tiny-todo.items', JSON.stringify(Array.from({length:500},(_, i)=>({id:i,title:'t'+i,done:i%2===0}))))`, reload, toggle | Change visible in under 100 ms (Performance panel: input to next paint) |
| Network | DevTools Network panel while toggling | No request (FR-010) |

## 8. Contrast (FR-007, SC-004)

Palette values and ratios are recorded in [research.md](research.md) D10. To re-check a pair:

```bash
node -e "const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const [a,b]=[L(process.argv[1]),L(process.argv[2])].sort((x,y)=>y-x);console.log(((a+.05)/(b+.05)).toFixed(2))" '#9a9a9a' '#121212'
```

Expect at least 4.5 for text pairs and 3 for borders and focus rings, in both themes. Cross-check with the DevTools color picker contrast readout on the rendered page.

## Done when

- `npm test` passes.
- Steps 3 to 8 behave as stated.
- `index.html` and `src/` import nothing from the network (constitution I).
