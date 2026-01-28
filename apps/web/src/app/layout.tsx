import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/providers/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AirShare - Instant File & Content Sharing',
  description: 'Share files, text, code, and links instantly with room-based sharing. Local network P2P or internet mode with end-to-end encryption.',
  keywords: ['file sharing', 'p2p', 'encrypted', 'local network', 'webrtc'],
  authors: [{ name: 'AirShare' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AirShare',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'AirShare',
    title: 'AirShare - Instant File & Content Sharing',
    description: 'Share files, text, code, and links instantly with room-based sharing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AirShare - Instant File & Content Sharing',
    description: 'Share files, text, code, and links instantly with room-based sharing.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
