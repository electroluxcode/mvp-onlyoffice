export const ONLYOFFICE_ID = 'iframe2';

// 编辑器容器挂载配置
export const ONLYOFFICE_CONTAINER_CONFIG = {
    // 容器元素 ID
    ID: ONLYOFFICE_ID,
    // 容器父元素选择器（用于自动挂载）
    PARENT_SELECTOR: '.flex-1.relative',
    // 容器样式配置
    STYLE: {
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
    },
} as const;

export const ONLYOFFICE_RESOURCE = {
    DOCUMENTS: '/web-apps/apps/api/documents/api.js',
    X2T: '/wasm/x2t/x2t.js',
}

// EventBus 事件名称
export const ONLYOFFICE_EVENT_KEYS = {
    SAVE_DOCUMENT: 'saveDocument',
    DOCUMENT_READY: 'documentReady',
    LOADING_CHANGE: 'loadingChange',
} as const;

export const FILE_TYPE = {
    DOCX: 'DOCX',
    XLSX: 'XLSX',
    PPTX: 'PPTX',
} as const;

// 超时和延迟配置（单位：毫秒）
export const READONLY_TIMEOUT_CONFIG = {
    // X2T 初始化超时时间（10秒）
    X2T_INIT: 10000,
    // 文档保存事件等待超时时间（10秒）
    SAVE_DOCUMENT: 10000,
    // 文档准备就绪事件等待超时时间（10秒）
    DOCUMENT_READY: 10000,
    // 只读模式切换最小延迟时间，防止切换过快导致界面闪烁
    READONLY_SWITCH_MIN_DELAY: 100,
} as const;

// 向后兼容：保留旧的导出名称
export const READONLY_SWITCH_MIN_DELAY = READONLY_TIMEOUT_CONFIG.READONLY_SWITCH_MIN_DELAY;