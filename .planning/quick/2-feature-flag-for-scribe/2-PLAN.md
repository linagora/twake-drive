---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/modules/views/OnlyOffice/View.jsx
autonomous: true
requirements: [SCRIBE-FLAG]

must_haves:
  truths:
    - "When drive.scribe.enabled flag is false (default), no Scribe UI appears and no bridge listener runs"
    - "When drive.scribe.enabled flag is true, Scribe works exactly as before (floating button, popover, bridge)"
  artifacts:
    - path: "src/modules/views/OnlyOffice/View.jsx"
      provides: "Feature flag gate for all Scribe functionality"
      contains: "flag('drive.scribe.enabled')"
  key_links:
    - from: "src/modules/views/OnlyOffice/View.jsx"
      to: "cozy-flags"
      via: "flag() call gating useCozyBridge + Scribe components"
      pattern: "flag\\('drive\\.scribe\\.enabled'\\)"
---

<objective>
Gate all Scribe functionality behind a `drive.scribe.enabled` cozy-flags feature flag so Scribe can be deployed to production OnlyOffice but only activated for instances with the flag enabled.

Purpose: Production safety -- Scribe stays invisible and inert unless explicitly enabled per-instance.
Output: View.jsx conditionally renders Scribe components and runs useCozyBridge only when flag is true.
</objective>

<execution_context>
@/home/ben/.claude/get-shit-done/workflows/execute-plan.md
@/home/ben/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/modules/views/OnlyOffice/View.jsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate Scribe behind drive.scribe.enabled flag</name>
  <files>src/modules/views/OnlyOffice/View.jsx</files>
  <action>
    1. Add `import flag from 'cozy-flags'` to the imports (follow alphabetical ordering with existing imports).

    2. At the top of the View component body, add:
       ```
       const isScribeEnabled = flag('drive.scribe.enabled')
       ```

    3. Gate the `useCozyBridge` call. The hook cannot be called conditionally (React rules of hooks), so keep the call but make the downstream usage conditional. Change the bridge usage:
       - Keep `const { pendingIntent, showScribeButton, respond } = useCozyBridge(allowedOrigins)` as-is (hooks must always be called).
       - But gate ALL Scribe-related rendering and callbacks on `isScribeEnabled`.

    4. Wrap the Scribe-dependent callbacks (`triggerScribe`, `handleReplace`, `handleInsert`, `handleCancel`) so they are no-ops when flag is off. The simplest approach: keep the callbacks as-is (they are only invoked from Scribe components which won't render).

    5. In the JSX return, wrap the ScribeFloatingButton and ScribePopover in the flag check:
       ```jsx
       {isScribeEnabled && (
         <>
           <ScribeFloatingButton
             visible={!!showScribeButton && !pendingIntent}
             onClick={triggerScribe}
           />
           <ScribePopover
             open={!!pendingIntent}
             selectedText={pendingIntent?.data?.text || ''}
             onReplace={handleReplace}
             onInsert={handleInsert}
             onCancel={handleCancel}
           />
         </>
       )}
       ```

    6. IMPORTANT: useCozyBridge sets up postMessage listeners. To avoid unnecessary listener overhead when Scribe is disabled, pass a sentinel to useCozyBridge that disables it. Check how useCozyBridge handles the allowedOrigins parameter -- if passing an empty array or null would skip the addEventListener, use that. Otherwise, the listener cost is negligible and acceptable as-is (messages are simply ignored since components don't render).

    Note: The OO plugin (code.js) is unchanged. When the flag is off, no bridge listens, so plugin messages are silently ignored. Ctrl+I in OO will fire postMessage but nothing receives it -- this is fine.
  </action>
  <verify>
    <automated>cd /home/ben/Dev-local/cozy-drive && grep -q "flag('drive.scribe.enabled')" src/modules/views/OnlyOffice/View.jsx && grep -q "isScribeEnabled" src/modules/views/OnlyOffice/View.jsx && grep -q "import flag from 'cozy-flags'" src/modules/views/OnlyOffice/View.jsx && echo "PASS"</automated>
  </verify>
  <done>
    - View.jsx imports cozy-flags and checks drive.scribe.enabled
    - When flag is false: no ScribeFloatingButton, no ScribePopover rendered
    - When flag is true: identical behavior to current code
    - No hooks-order violations (useCozyBridge always called)
  </done>
</task>

</tasks>

<verification>
- `grep "flag('drive.scribe.enabled')" src/modules/views/OnlyOffice/View.jsx` returns a match
- `grep "isScribeEnabled" src/modules/views/OnlyOffice/View.jsx` returns matches for declaration and JSX gate
- No ESLint errors on the file
</verification>

<success_criteria>
- Scribe UI is fully gated behind drive.scribe.enabled flag
- Default behavior (flag unset/false) shows no Scribe elements
- Setting flag to true restores full Scribe functionality
- No React hooks rules violations
</success_criteria>

<output>
After completion, create `.planning/quick/2-feature-flag-for-scribe/2-SUMMARY.md`
</output>
