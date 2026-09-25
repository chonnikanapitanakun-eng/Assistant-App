import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web document shell: visible keyboard focus ring, plus installable-app (PWA) tags.
 * On iPhone, "Add to Home Screen" runs Veyra standalone, which Safari evicts less
 * and exempts from its 7-day wipe of site storage (where the on-device database lives).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Veyra" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#F8FAFC" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0B1020" media="(prefers-color-scheme: dark)" />
        <title>Veyra — Your life, handled.</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
body { background-color: #F8FAFC; }
@media (prefers-color-scheme: dark) { body { background-color: #0B1020; } }
:focus-visible { outline: 2px solid #6366F1; outline-offset: 2px; border-radius: 12px; }
/* Text fields draw their own focus border (primary) instead of the browser outline. */
input:focus, textarea:focus, input:focus-visible, textarea:focus-visible { outline: none; }
`;
