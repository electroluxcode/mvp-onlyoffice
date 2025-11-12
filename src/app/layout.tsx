'use client'

import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from 'next/navigation';
import StudioLayout from '@/components/StudioLayout';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // 判断是否需要显示 StudioLayout（侧边栏）
  const needsStudioLayout = 
    pathname.startsWith('/excel') || 
    pathname.startsWith('/docs') || 
    pathname.startsWith('/ppt');

  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {needsStudioLayout ? (
          <StudioLayout>{children}</StudioLayout>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
