# Fix: Pasting Multi-Line Text Should Not Auto-Execute

## Problem

Cmd+V pasting multi-line text (e.g. from a code block) sends the text directly to the
PTY, where `\n` is interpreted as Enter. Each line executes as a separate command
before the user has a chance to review or edit.

## Root Cause

`frontend/src/components/xterm-wrapper.tsx` lines 158-182:
The Cmd+V handler reads clipboard text and sends it verbatim to the PTY via
`ws.send({ type: 'input', text })`. Newlines in the text are treated by the shell
as command separators.

## Solution: Bracketed Paste

Wrap pasted text in the standard bracketed-paste control sequences when it contains
newlines. This tells the shell (bash/zsh, which enable bracketed-paste mode by
default) to treat the entire pasted content as a single paste operation, buffering
intermediate newlines without executing them until the final Enter.

### Implementation (xterm-wrapper.tsx, Cmd+V handler)

Replace the current paste path with bracketed-paste wrapping:

```typescript
if (e.metaKey && e.key === 'v') {
  e.preventDefault();
  navigator.clipboard.readText().then((text) => {
    if (text) {
      const ws = useTerminalStore.getState().ws;
      if (ws?.readyState === WebSocket.OPEN) {
        // Wrap multi-line pastes in bracketed-paste sequences
        // so the shell treats them as input, not as individual commands
        const hasNewline = text.includes('\n') || text.includes('\r');
        const pasteText = hasNewline
          ? `\x1b[200~${text}\x1b[201~`
          : text;
        ws.send(JSON.stringify({ type: 'input', sessionId, text: pasteText }));
      }
    }
  }).catch(() => {
    const api = (window as any).electronAPI;
    if (api?.readClipboard) {
      const text = api.readClipboard();
      if (text) {
        const ws = useTerminalStore.getState().ws;
        if (ws?.readyState === WebSocket.OPEN) {
          const hasNewline = text.includes('\n') || text.includes('\r');
          const pasteText = hasNewline
            ? `\x1b[200~${text}\x1b[201~`
            : text;
          ws.send(JSON.stringify({ type: 'input', sessionId, text: pasteText }));
        }
      }
    }
  });
}
```

### Why this works

- `\x1b[200~` = "begin bracketed paste" (DECSET 2004)
- `\x1b[201~` = "end bracketed paste"
- Modern shells (bash 4.4+, zsh 5.1+) automatically enable bracketed-paste mode
- Inside bracketed paste, newlines and tabs are literal input, not command separators
- The entire paste is inserted at once; user reviews before pressing Enter

### What doesn't change

- Single-line text (no newlines) is pasted directly as before
- The `\x03` (SIGINT) path on Cmd+C without selection is unaffected
- Drag-and-drop pasting of file paths (no newlines) is unaffected
- The electronAPI fallback path is updated identically

### Verification

1. Copy a multi-line command: `echo "line1"\necho "line2"`
2. Cmd+V in sterm → text appears as input, lines NOT executed
3. Press Enter → all lines execute as a single paste
4. Single-line paste (no newlines) → pastes directly as before
