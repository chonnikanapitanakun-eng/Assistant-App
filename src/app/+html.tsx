import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web document shell: visible keyboard focus ring for accessibility. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
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
input:focus-visible, textarea:focus-visible { outline: none; }
`;
