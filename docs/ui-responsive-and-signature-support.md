# Responsive UI and input compatibility

## Design baseline

Reviewroom serves workspace owners/admins, reviewers, and people responding through a public review link. The interface should keep the next action obvious, use the same vocabulary across roles, and let users complete tasks on a phone without precision tapping or forced horizontal scrolling.

- The workspace theme is stored per organization and passed into the shared shell and public review portal. Current user choices are safe accent colors and system font stacks; no remote font download is required.
- Forest green is the action color, white panels separate tasks, and muted text describes secondary information. Status always includes text, not color alone.
- Controls have visible keyboard focus. Motion honors `prefers-reduced-motion`.
- On phones, controls use at least 44px touch targets, inputs use a 16px font to avoid Safari's focus zoom, and safe-area insets protect notched screens.
- Workspace navigation collapses to a compact rail on tablet widths and a bottom navigation bar on narrow screens. Tables remain scrollable inside their own containers; content should not force the whole viewport wider.

## Shared authentication controls

`src/features/auth/password-input.tsx` is the shared password field for admin sign-in, reviewer sign-in, access-token acceptance, and reset. Its show/hide control uses accessible labels and a 44px target. Keep this component as the only source of password visibility behavior.

`Forgot password?` opens `/reset-password?audience=admin|reviewer`. The current product flow uses the separately issued, one-time reset token from the workspace admin; it does not send email. After success, the user is returned to the corresponding sign-in route.

## Signature field

`src/features/review/signature-input.tsx` records either a typed name or normalized drawing strokes. Drawing uses browser Pointer Events so mouse, finger, and stylus input share one event path. `normalizeSignaturePoint` maps pointer coordinates to 0–1 so the stored answer remains stable if the pad changes size. The reviewer can clear and redraw; the typed mode is an accessible fallback. Submission validation bounds stroke data server-side.

Current browser platform support: Pointer Events are widely available across modern browsers, and WebKit documents support in Safari. The CSS `touch-action` property is broadly available; the pad keeps pinch zoom available while using pointer input for drawing. Sources: [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [WebKit Pointer Events in Safari](https://webkit.org/blog/9674/new-webkit-features-in-safari-13/), [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

This is a captured typed/drawn acknowledgement, not a certificate-backed or qualified electronic-signature service. Do not describe it as meeting a particular jurisdiction's legal signature standard without separate legal/product review.

## Responsive breakpoints

- At 1100px and below, form-editor properties and workspace settings stack to use the available width.
- At 850px and below, the workspace sidebar becomes a compact icon rail and the form editor uses a two-column layout.
- At 760px and below, submission and form rows wrap their metadata and actions.
- At 620px and below, the app switches to the mobile navigation, single-column editor, full-width page actions, 16px inputs, and safe-area-aware spacing.

## Release QA matrix

The UI is built from standard HTML controls, CSS media queries, SVG, and Pointer Events rather than browser-specific drawing libraries. Automated validation for this change includes web tests, API tests (including normalized signature validation), lint, typecheck, and the optimized production build. This environment did not permit browser automation, so screenshots and actual device interaction were not run here. Before a production release, manually check current Safari on iPhone/iPad, Chrome on Android, and current Chrome, Firefox, Edge, and Safari on desktop; cover sign-in visibility toggling, keyboard navigation, phone layout, signature draw/clear/submit, pinch zoom, and submission rendering.
