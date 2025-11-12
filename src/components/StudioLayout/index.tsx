'use client'

import { usePathname, useRouter } from 'next/navigation'
import './styles.css'

interface MenuItem {
    key: string
    label: string
    icon: string
    path: string
}

const menuItems: MenuItem[] = [
    { key: 'excel', label: 'Excel', icon: '', path: '/excel' },
    { key: 'docs', label: 'Docs', icon: '', path: '/docs' },
    { key: 'ppt', label: 'PPT', icon: '', path: '/ppt' },
]

interface StudioLayoutProps {
    children: React.ReactNode
}

export default function StudioLayout({ children }: StudioLayoutProps) {
    const pathname = usePathname()
    const router = useRouter()

    const handleMenuClick = (path: string) => {
        router.push(path)
    }

    // 获取当前激活的菜单项
    const getActiveKey = () => {
        if (pathname.startsWith('/excel')) return 'excel'
        if (pathname.startsWith('/docs')) return 'docs'
        if (pathname.startsWith('/ppt')) return 'ppt'
        return ''
    }

    return (
        <div className="studio-layout">
            {/* 左侧边栏 */}
            <aside className="studio-sidebar">
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Univer Studio</h2>
                </div>
                
                <nav className="sidebar-nav">
                    {menuItems.map(item => (
                        <button
                            key={item.key}
                            className={`nav-item ${getActiveKey() === item.key ? 'active' : ''}`}
                            onClick={() => handleMenuClick(item.path)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-info">
                        <p>Powered by Univer</p>
                        <p className="version">v1.0.0</p>
                    </div>
                </div>
            </aside>

            {/* 右侧内容区域 */}
            <main className="studio-main-content">
                {children}
            </main>
        </div>
    )
}

