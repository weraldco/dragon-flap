import type { Metadata, Viewport } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flappy Dragon: Volcanic Ascent',
  description: 'Guide your dragon through the volcanic rocks.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a0d0a',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={pixelFont.variable}>
      <body className="bg-ember-950 font-pixel text-amber-50 antialiased">{children}</body>
    </html>
  );
}
