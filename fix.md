## Individual Comments

### Comment 1
<location path="app/kie/page.tsx" line_range="30-39" />
<code_context>
+        const pollInterval = setInterval(async () => {
</code_context>
<issue_to_address>
**issue (bug_risk):** Avoid polling interval running after component unmount to prevent setState on unmounted component.

Because this `setInterval` is not tied to the component lifecycle, it will keep calling `setResult`/`setLoading` even after unmount, causing React warnings and leaking the timer. Store the interval id in a `useRef` and clear it in a `useEffect` cleanup (and when starting a new upload) so polling stops on unmount or resubmission.
</issue_to_address>