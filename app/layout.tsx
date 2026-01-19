import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RELIALIMO | Professional Transportation Services',
  description: 'Premium limousine and transportation services for all your professional needs. Reliable, luxurious, and always on time.',
  keywords: 'limousine, transportation, professional, luxury, chauffeur, airport transfer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
