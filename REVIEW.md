# Review rules for twake-drive

Read this file only when performing a code review, not for ordinary implementation,
debugging or explanation tasks.

These rules supplement the applicable `twake-guidelines` skills and [AGENTS.md](AGENTS.md).
Repository-specific decisions take precedence over generic guidelines. E2E reviews
also follow [e2e/AGENTS.md](e2e/AGENTS.md).

Review the changed code and its affected callers, not unrelated legacy code. These
rules are not a request for repository-wide rewrites or changes to external APIs.

## JSX and component APIs

- Do not store JSX elements in local variables (`const actions = <Actions />`).
  Write the JSX where it is rendered, even when the same small fragment appears
  in two places. This does not prohibit variables holding component types.
- Custom hooks return state and handlers, never JSX. The component owns the
  conditional rendering.
- For conditional rendering, use an actual boolean named `is…` or `has…`, not
  the truthiness of an object, string or number. Keep the rendering condition
  separate from the data passed to the rendered component:

  ```jsx
  const hasSelectedFile = selectedFile !== null;

  return <>{hasSelectedFile && <FileDetails file={selectedFile} />}</>;
  ```

- Keep the JSX return focused on rendering. Compute derived data, helper results
  and data mappings in named variables before the return, rather than inline in
  props. Rendering a list with `.map()` is still JSX, not a data transformation
  that must be moved into a JSX variable.
- Pass props explicitly instead of using prop spreads, so the component contract
  is visible at the call site.
- Group callback props (`on*`) last, consistently in parameter destructuring,
  JSDoc, `propTypes` and JSX call sites.
- Use semantic styling utilities rather than palette-specific classes such as
  `u-bg-paleGrey`. Follow the existing design-system constraints in `AGENTS.md`;
  a missing semantic variant is not permission to introduce an inline style.

## Logic and responsibilities

- Extract business decisions from hooks into pure helpers outside the hook,
  unless doing so would require a long list of arguments. Keep React lifecycle
  and state management in the hook.
- Separate data loading from presentation: a `…Wrapper` component runs the
  queries, handles loading states and passes data to a view component. The view
  prepares what its UI needs, including callbacks required by library components.
  Do not introduce a hook used by only one component merely to wrap the query API.
  Query definitions still belong in `src/queries`; this rule does not move them
  into wrappers or replace `cozy-client`.
- Write transformation logic top to bottom, using named intermediate results
  rather than nested helper calls. Do not introduce a local context-capturing
  adapter just to pass it to `.map()` (such as
  `const toMember = x => makeMember(x, { t })`). Instead:

  ```js
  const matchingContacts = contacts.filter(isMatchingContact);
  return makeMembersFromContacts({
    contacts: matchingContacts,
    t,
    instanceUri,
  });
  ```

  Prefer a plural helper taking the collection and its context explicitly.
  Ordinary event handlers and callbacks remain valid; this is not a ban on all
  closures.

- For functions whose signature this repository owns, use a single object when
  there are three or more arguments: `fn(a)`, `fn(a, b)` or `fn({ a, b, c })`.
  Do not mix positional arguments and an options object (`fn(a, b, { c, d })`).
  Preserve signatures required by React, browser APIs and third-party libraries.

## Menus and reference stability

- Build fixed menus explicitly with `ActionsMenuWrapper` and `ActionsMenuItem`.
  Do not use `makeActions` or create component types during each render for a
  fixed set of entries. This is not a ban on the existing dynamic action system.
- For reference stability, justify `useCallback` / `useMemo` by their consumer:
  a memoized child, an effect or hook dependency, or a context value. Avoiding
  function creation on each render is not a justification on its own. Other
  measured performance needs remain governed by `AGENTS.md` and the guidelines;
  do not duplicate their general memoization rules here.
