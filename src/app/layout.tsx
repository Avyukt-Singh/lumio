import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

// Brand lock (master prompt 6.1): Plus Jakarta Sans for headings, Inter for body.
// next/font bundles both at build time: self-hosted, no runtime Google Fonts request,
// works offline after first load (master prompt gap table: "Fonts").
// Chunk 4B: Noto Sans Devanagari pairs with both so Hindi (hi) renders with crisp
// line height and zero clipping — Devanagari needs taller ascenders/descenders.
const jakarta = Plus_Jakarta_Sans({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

const devanagari = Noto_Sans_Devanagari({
  variable: '--font-devanagari',
  subsets: ['devanagari', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumio — Learn · Practice · Grow',
  description:
    'Lumio is an offline-first gamified learning app for Indian school students, droppers and beyond-Class-12 learners. Sample content, honestly labelled; optional AI help is opt-in and clearly marked.',
  applicationName: 'Lumio',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/mascot/owl-icon.webp', type: 'image/webp' }],
    apple: [{ url: '/mascot/owl-icon.webp' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lumio',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4F46E5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${inter.variable} ${devanagari.variable} antialiased`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Skip to main content
        </a>
        {children}
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
