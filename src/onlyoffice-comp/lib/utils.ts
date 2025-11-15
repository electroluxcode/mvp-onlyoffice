// 简单的工具函数，替代 ranuts/utils
import { editorManager } from './editor-manager';
/**
 * 从 MIME 类型获取文件扩展名
 */
export function getExtensions(mimeType: string): string[] {
  const mimeToExt: Record<string, string[]> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/msword': ['doc'],
    'application/vnd.oasis.opendocument.text': ['odt'],
    'application/rtf': ['rtf'],
    'text/plain': ['txt'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
    'text/csv': ['csv'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'application/vnd.ms-powerpoint': ['ppt'],
    'application/vnd.oasis.opendocument.presentation': ['odp'],
  };

  return mimeToExt[mimeType] || [];
}


// 加载编辑器 API（已移至 editorManager）
export function loadEditorApi(): Promise<void> {
  return editorManager.loadAPI();
}

// 简化的文档状态管理
interface DocumentState {
  fileName: string;
  file?: File;
  url?: string | URL;
}

let documentState: DocumentState = {
  fileName: '',
  file: undefined,
  url: undefined,
};

export const getDocmentObj = (): DocumentState => {
  return { ...documentState };
};

export const setDocmentObj = (state: Partial<DocumentState>): void => {
  documentState = { ...documentState, ...state };
};

