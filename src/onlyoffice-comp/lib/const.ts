export const ONLYOFFICE_ID = 'iframe2';
export const ONLUOFFICE_RESOURCE = {
    DOCUMENTS: '/web-apps/apps/api/documents/api.js',
    X2T: '/wasm/x2t/x2t.js',
}

// EventBus 事件名称
export const EVENT_KEYS = {
    SAVE_DOCUMENT: 'saveDocument',
    DOCUMENT_READY: 'documentReady',
    LOADING_CHANGE: 'loadingChange',
} as const;

export const FILE_TYPE = {
    DOCX: 'DOCX',
    XLSX: 'XLSX',
    PPTX: 'PPTX',
} as const;