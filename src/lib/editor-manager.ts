// 编辑器管理器，使用 Proxy 管理编辑器实例和静态资源
interface DocEditor {
  sendCommand: (params: {
    command: string;
    data: Record<string, any>;
  }) => void;
  destroyEditor: () => void;
}

// DocsAPI 类型定义在 document.d.ts 中

class EditorManager {
  private editor: DocEditor | null = null;
  private apiLoaded = false;
  private apiLoadingPromise: Promise<void> | null = null;

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
        // 其他属性直接返回 editor 的对应属性
        return this.editor ? (this.editor as any)[prop] : undefined;
      },
      set: () => {
        // Proxy 不允许直接设置属性
        return false;
      },
    });
  }

  // 创建编辑器实例
  create(editor: DocEditor): DocEditor {
    this.destroy();
    this.editor = editor;
    return this.createProxy();
  }

  // 销毁编辑器
  destroy(): void {
    if (this.editor) {
      this.editor.destroyEditor();
      this.editor = null;
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
      script.src = '/web-apps/apps/api/documents/api.js';
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

  // 检查 API 是否已加载
  isAPILoaded(): boolean {
    return this.apiLoaded && !!window.DocsAPI;
  }

  // 切换只读/可编辑模式
  setReadOnly(readOnly: boolean): void {
    const editor = this.get();
    if (!editor) return;

    editor.sendCommand({
      command: 'asc_setPermissions',
      data: {
        edit: !readOnly,
      },
    });
  }

  // 打印文档
  print(): void {
    const editor = this.get();
    if (!editor) return;

    editor.sendCommand({
      command: 'asc_print',
      data: {},
    });
  }
}

// 导出单例实例
export const editorManager = new EditorManager();

// 导出类型
export type { DocEditor };

