'use client';

import Script from 'next/script';

const VCONSOLE_SRC = 'https://unpkg.com/vconsole@latest/dist/vconsole.min.js';

/**
 * Mobile web console for browsers without DevTools (e.g. iOS QQ Browser).
 * Enable by appending `?debug=1` to any URL, then tap the green vConsole
 * icon in the bottom-right corner to view `console.*` output.
 */
export default function VConsoleClient() {
  return (
    <Script id="vconsole-loader" strategy="afterInteractive">
      {`
        (function () {
          try {
            var url = new URL(window.location.href);
            var enabled = url.searchParams.get('debug') === '1'
              || window.localStorage && window.localStorage.getItem('debug') === '1';
            if (!enabled) { return; }
            var s = document.createElement('script');
            s.src = ${JSON.stringify(VCONSOLE_SRC)};
            s.async = true;
            s.onload = function () { try { new window.VConsole(); } catch (e) {} };
            document.head.appendChild(s);
          } catch (e) {}
        })();
      `}
    </Script>
  );
}
