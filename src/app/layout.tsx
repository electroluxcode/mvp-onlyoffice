'use client'

import { usePathname } from 'next/navigation';
import StudioLayout from '@/components/StudioLayout';
import "./globals.css";

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
      <body className="antialiased">
        {needsStudioLayout ? (
          <StudioLayout>{children}</StudioLayout>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
