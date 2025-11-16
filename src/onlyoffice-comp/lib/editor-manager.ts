// 编辑器管理器，使用 Proxy 管理编辑器实例和静态资源
interface DocEditor {
  sendCommand: (params: {
    command: string;
    data: Record<string, any>;
  }) => void;
  destroyEditor: () => void;
}
import { ONLUOFFICE_RESOURCE, ONLYOFFICE_ID, EVENT_KEYS, READONLY_SWITCH_MIN_DELAY } from './const';
import { eventBus } from './eventbus';
import { createEditorInstance } from './x2t';
// DocsAPI 类型定义
declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: any) => DocEditor;
    };
  }
}

// DocsAPI 类型定义在 document.d.ts 中

class EditorManager {
  private editor: DocEditor | null = null;
  private apiLoaded = false;
  private apiLoadingPromise: Promise<void> | null = null;
  private editorConfig: {
    fileName: string;
    fileType: string;
    binData: ArrayBuffer | string;
    media?: any;
    readOnly?: boolean;
    events?: {
      onSave?: (event: any) => void;
    };
  } | null = null;
  private readOnly = false;
  
  // 编辑器容器配置
  private containerId = ONLYOFFICE_ID;
  private containerParentSelector = '.flex-1.relative';
  
  // 获取容器 ID
  getContainerId(): string {
    return this.containerId;
  }
  
  // 获取容器父元素选择器
  getContainerParentSelector(): string {
    return this.containerParentSelector;
  }

  // 使用 Proxy 提供安全的访问接口
  private createProxy(): DocEditor {
    return new Proxy({} as DocEditor, {
      get: (_target, prop) => {
        if (prop === 'destroyEditor') {
          return () => this.destroy();
        }
        if (prop === 'sendCommand') {
          return (params: Parameters<DocEditor['sendCommand']>[0]) => {
            if (this.editor) {
              this.editor.sendCommand(params);
            }
          };
        }
        // 其他属性直接返回 editor 的对应属性（包括 processRightsChange, denyEditingRights 等）
        return this.editor ? (this.editor as any)[prop] : undefined;
      },
      set: () => {
        // Proxy 不允许直接设置属性
        return false;
      },
    });
  }

  // 创建编辑器实例
  create(editor: DocEditor, config?: {
    fileName: string;
    fileType: string;
    binData: ArrayBuffer | string;
    media?: any;
    readOnly?: boolean;
    events?: {
      onSave?: (event: any) => void;
    };
  }): DocEditor {

    (window as any).ONLY_OFFICE_INSTANCE = editor;
    // 先销毁旧的编辑器
    if (this.editor) {
      try {
        this.editor.destroyEditor();
      } catch (error) {
        console.warn('Error destroying old editor:', error);
      }
      this.editor = null;
    }
    
    // 确保容器元素存在（OnlyOffice 可能会删除它）
    const container = document.getElementById(ONLYOFFICE_ID);
    if (!container) {
      console.warn('Container element not found, OnlyOffice may have removed it');
    }
    
    this.editor = editor;
    if (config) {
      this.editorConfig = config;
      // 同步只读状态
      this.readOnly = config.readOnly ?? false;
    }
    return this.createProxy();
  }

  // 销毁编辑器
  destroy(): void {
    if (this.editor) {
    //   this.editor.destroyEditor();
    //   this.editor = null;
    }
  }

  // 获取编辑器实例（只读）
  get(): DocEditor | null {
    return this.editor ? this.createProxy() : null;
  }

  // 检查编辑器是否存在
  exists(): boolean {
    return this.editor !== null;
  }

  // 加载 OnlyOffice API 脚本
  async loadAPI(): Promise<void> {
    if (this.apiLoaded && window.DocsAPI) {
      return;
    }

    if (this.apiLoadingPromise) {
      return this.apiLoadingPromise;
    }

    this.apiLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ONLUOFFICE_RESOURCE.DOCUMENTS;
      script.onload = () => {
        this.apiLoaded = true;
        this.apiLoadingPromise = null;
        resolve();
      };
      script.onerror = (error) => {
        this.apiLoadingPromise = null;
        console.error('Failed to load OnlyOffice API:', error);
        reject(new Error('无法加载编辑器组件。请确保已正确安装 OnlyOffice API。'));
      };
      document.head.appendChild(script);
    });

    return this.apiLoadingPromise;
  }


  // 切换只读/可编辑模式
  // 当从只读切换到可编辑时，先导出数据，然后重新加载编辑器实例
  async setReadOnly(readOnly: boolean): Promise<void> {
    
    eventBus.emit(EVENT_KEYS.LOADING_CHANGE, { loading: true });
    await new Promise(resolve => setTimeout(resolve, READONLY_SWITCH_MIN_DELAY));
    // 可编辑，先导出数据，然后重新加载编辑器
    if (this.readOnly && !readOnly) {
      console.log('Switching from read-only to edit mode, exporting and reloading editor...');
      
      const editor = this.get();
      if (!editor) {
        throw new Error('Editor not available for export');
      }

      // 先导出当前文档数据
      let exportedData = this.editorConfig;
      
      // 销毁当前编辑器
      if (this.editor) {
        try {
          this.editor.destroyEditor();
        } catch (error) {
          console.warn('Error destroying editor:', error);
        }
        this.editor = null;
      }
      
      // 使用导出的数据重新创建编辑器（可编辑模式）
      createEditorInstance({
        fileName: exportedData.fileName,
        fileType: exportedData.fileType,
        binData: exportedData.binData,
        media: this.editorConfig?.media,
        readOnly: false, // 明确设置为可编辑模式
      });
      eventBus.on(EVENT_KEYS.DOCUMENT_READY, () => {
        eventBus.emit(EVENT_KEYS.LOADING_CHANGE, { loading: false });
      });
      this.readOnly = false;
      return;
    }
    
    // 如果从可编辑切换到只读，使用命令切换
    const editor = this.get();
    if (!editor) {
      console.warn('Editor not available, cannot set read-only mode');
      return;
    }
    
    try {
      const exportedData = await this.export();
      this.editorConfig = {
        ...this.editorConfig,
        fileName: exportedData.fileName,
        fileType: exportedData.fileType,
        binData: exportedData.binData,
      };
      const message = '文档已设置为只读模式';
      // rawEditor.processRightsChange(false, message);
      editor.sendCommand({
        command: 'processRightsChange',
        data: {
          enabled: false,
          message: message
        },
      });
      eventBus.emit(EVENT_KEYS.LOADING_CHANGE, { loading: false });
      this.readOnly = true;
    } catch (error) {
      console.error('Failed to set read-only mode:', error);
      eventBus.emit(EVENT_KEYS.LOADING_CHANGE, { loading: false });
      throw error;
    }
  }

  // 获取当前只读状态
  getReadOnly(): boolean {
    return this.readOnly;
  }

  // 打印文档
  print(): void {
    const editor = this.get();
    if (!editor) return;
    console.log('Printing document');
  }

  // 导出文档（通过保存事件触发下载）
  async export(): Promise<any> {
    const editor = this.get();
    if (!editor) {
      throw new Error('Editor not available for export');
    }
    
    // 触发保存
    try {
      
      console.log('Trying downloadAs method');
      (editor as any).downloadAs();
      
      // 等待保存事件，使用 eventBus.waitFor
      const result = await eventBus.waitFor(EVENT_KEYS.SAVE_DOCUMENT, 3000); // 3秒超时
      
      // 触发 loading 结束事件
      
      return result;
    } catch (error) {
      // 发生错误时也要关闭 loading
      console.error('Failed to send asc_save command:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const editorManager = new EditorManager();
(window as any).editorManager = editorManager;
// 导出类型
export type { DocEditor };

