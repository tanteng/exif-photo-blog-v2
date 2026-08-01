// Detect whether the browser can handle the full pipeline that
// Next.js/React uses internally for Server Action responses:
//   fetch() → Response.body → ReadableStream → getReader() → read()
//
// iOS QQ Browser and some older WebKit-based browsers may have the
// ReadableStream constructor but Response.body.getReader() still
// returns undefined or throws. This is the exact path Next.js hits
// inside react-server-dom-webpack's createFromFetch().
let _checked = false;
let _supported = false;

export const supportsReadableStream = (): boolean => {
  if (_checked) return _supported;
  _checked = true;
  try {
    if (typeof ReadableStream === 'undefined') {
      _supported = false;
      return false;
    }
    // Test the exact path Next.js uses: Response.body.getReader()
    if (typeof Response !== 'undefined') {
      const response = new Response('x', {
        headers: { 'content-type': 'text/plain' },
      });
      const body = response.body;
      if (!body || typeof body !== 'object') {
        _supported = false;
        return false;
      }
      const reader = body.getReader();
      if (typeof reader?.read !== 'function') {
        _supported = false;
        return false;
      }
      reader.cancel?.();
    } else {
      // SSR / Node.js environment: just test ReadableStream
      const s = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      const reader = s.getReader();
      if (typeof reader?.read !== 'function') {
        _supported = false;
        return false;
      }
      reader.releaseLock();
    }
    _supported = true;
    return true;
  } catch {
    _supported = false;
    return false;
  }
};
