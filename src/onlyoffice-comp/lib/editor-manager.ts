// 编辑器管理器，使用 Proxy 管理编辑器实例和静态资源
interface DocEditor {
  sendCommand: (params: {
    command: string;
    data: Record<string, any>;
  }) => void;
  destroyEditor: () => void;
}
import { ONLUOFFICE_RESOURCE, ONLYOFFICE_ID } from './const';
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
  // 当从只读切换到可编辑时，重新加载编辑器实例
  async setReadOnly(readOnly: boolean): Promise<void> {
    console.log(this.editor)
    // 如果从只读切换到可编辑，重新加载编辑器
    // if (this.readOnly && !readOnly) {
    //   console.log('Switching from read-only to edit mode, reloading editor...');
    //   if (!this.editorConfig) {
    //     throw new Error('Editor config not found, cannot reload editor');
    //   }
      
    //   // 销毁当前编辑器
    //   if (this.editor) {
    //     try {
    //       this.editor.destroyEditor();
    //     } catch (error) {
    //       console.warn('Error destroying editor:', error);
    //     }
    //     this.editor = null;
    //   }
      
    //   // 使用保存的配置重新创建编辑器
    //   const { fileName, fileType, binData, media } = this.editorConfig;
    //   createEditorInstance({
    //     fileName,
    //     fileType,
    //     binData,
    //     media,
    //   });
      
    //   this.readOnly = false;
    //   return;
    // }
    
    // // 如果从可编辑切换到只读，使用命令切换
    // const editor = this.get();
    // if (!editor) {
    //   console.warn('Editor not available, cannot set read-only mode');
    //   return;
    // }
    
    // try {
    //   const message = '文档已设置为只读模式';
    //   const rawEditor = this.editor as any;
      
    //   // 只读模式：使用 processRightsChange 命令
    //   if (rawEditor && typeof rawEditor.processRightsChange === 'function') {
    //     rawEditor.processRightsChange(false, message);
    //   } else {
    //     editor.sendCommand({
    //       command: 'processRightsChange',
    //       data: {
    //         enabled: false,
    //         message: message,
    //       },
    //     });
    //   }
      
    //   this.readOnly = true;
    // } catch (error) {
    //   console.error('Failed to set read-only mode:', error);
    //   throw error;
    // }
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
  export(): void {
    const editor = this.get();
    if (!editor) {
      console.error('Editor not available for export');
      return;
    }

    console.log('Triggering export via asc_save command');
    
    // 尝试多种方式触发保存
    try {
      // 方式3: 如果编辑器有 downloadAs 方法，尝试使用
      if ((editor as any).downloadAs) {
        console.log('Trying downloadAs method');
        const config = this.editorConfig;
        if (config) {
          const fileExt = config.fileType.toLowerCase();
          (editor as any).downloadAs(fileExt);
        }
      }
    } catch (error) {
      console.error('Failed to send asc_save command:', error);
    }
  }
}

// 导出单例实例
export const editorManager = new EditorManager();

// 导出类型
export type { DocEditor };

