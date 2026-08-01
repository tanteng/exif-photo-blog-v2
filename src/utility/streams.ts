// Detect whether the browser supports ReadableStream.getReader().
// iOS QQ Browser and some older WebKit-based browsers may not support
// the Streams API, causing Server Action responses to fail when
// Next.js/React internally calls response.body.getReader().
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
    // Create a minimal stream and try getReader()
    const s = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    const reader = s.getReader();
    _supported = typeof reader?.read === 'function';
    reader.releaseLock();
    return _supported;
  } catch {
    _supported = false;
    return false;
  }
};
