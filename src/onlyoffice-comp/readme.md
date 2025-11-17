# OnlyOffice Comp 使用文档

OnlyOffice Comp 是一个基于 OnlyOffice 的文档编辑器组件库，支持 Word、Excel、PowerPoint 等文档的在线编辑、查看和转换功能。

## 目录

- [快速开始](#快速开始)
- [核心 API](#核心-api)
- [事件系统](#事件系统)
- [完整示例](#完整示例)
- [API 参考](#api-参考)

## 快速开始

### 1. 初始化编辑器

在使用编辑器之前，需要先初始化 OnlyOffice 环境：

```typescript
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';

// 初始化 OnlyOffice（只需调用一次，会自动缓存）
await initializeOnlyOffice();
```

### 2. 创建编辑器视图

创建编辑器视图有两种方式：新建文档或打开现有文档。

```typescript
import { createEditorView } from '@/onlyoffice-comp/lib/x2t';

// 新建文档
await createEditorView({
  isNew: true,
  fileName: 'New_Document.docx',
});

// 打开现有文档
const file = new File([...], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
await createEditorView({
  isNew: false,
  fileName: 'document.docx',
  file: file,
});
```

### 3. 添加编辑器容器

在 React 组件中添加编辑器容器：

```tsx
import { ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';

export default function EditorPage() {
  return (
    <div className="flex-1 relative">
      <div id={ONLYOFFICE_ID} className="absolute inset-0" />
    </div>
  );
}
```

## 核心 API

### `initializeOnlyOffice()`

初始化 OnlyOffice 编辑器环境，包括加载脚本、API 和 X2T 转换器。

```typescript
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';

await initializeOnlyOffice();
```

**特点：**
- 使用单例模式，多次调用只会初始化一次
- 自动加载所有必需的资源
- 返回 Promise，支持异步等待

### `createEditorView(options)`

创建编辑器视图，支持新建或打开文档。

```typescript
import { createEditorView } from '@/onlyoffice-comp/lib/x2t';

await createEditorView({
  isNew: boolean;      // 是否新建文档
  fileName: string;    // 文件名（包含扩展名）
  file?: File;        // 文件对象（打开现有文档时必需）
});
```

**返回值：** `Promise<void>` - 文档准备就绪后 resolve

**支持的文件类型：**
- Word: `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`
- Excel: `.xlsx`, `.xls`, `.ods`, `.csv`
- PowerPoint: `.pptx`, `.ppt`, `.odp`

### `editorManager`

编辑器管理器，提供编辑器的操作和控制功能。

```typescript
import { editorManager } from '@/onlyoffice-comp/lib/editor-manager';
```

#### `editorManager.exists()`

检查编辑器是否存在。

```typescript
if (editorManager.exists()) {
  // 编辑器已创建
}
```

#### `editorManager.export()`

导出文档，返回文档的二进制数据。

```typescript
const binData = await editorManager.export();
// binData: { fileName: string, fileType: string, binData: Uint8Array }
```

**返回值：** `Promise<{ fileName: string, fileType: string, binData: Uint8Array }>`

#### `editorManager.setReadOnly(readOnly)`

设置编辑器为只读或可编辑模式。

```typescript
await editorManager.setReadOnly(true);  // 设置为只读
await editorManager.setReadOnly(false); // 设置为可编辑
```

#### `editorManager.getReadOnly()`

获取当前只读状态。

```typescript
const isReadOnly = editorManager.getReadOnly();
```

#### `editorManager.print()`



#### `editorManager.destroy()`

销毁编辑器实例。

```typescript
editorManager.destroy();
```

### `convertBinToDocument()`

将二进制数据转换为指定格式的文档。

```typescript
import { convertBinToDocument } from '@/onlyoffice-comp/lib/x2t';
import { FILE_TYPE } from '@/onlyoffice-comp/lib/const';

const result = await convertBinToDocument(
  binData.binData,      // Uint8Array
  binData.fileName,     // string
  FILE_TYPE.DOCX        // 'DOCX' | 'XLSX' | 'PPTX'
);

// result: { fileName: string, data: Uint8Array }
```

**支持的文件类型：**
- `FILE_TYPE.DOCX` - Word 文档
- `FILE_TYPE.XLSX` - Excel 表格
- `FILE_TYPE.PPTX` - PowerPoint 演示文稿

## 事件系统

OnlyOffice Comp 使用 EventBus 机制进行事件通信。

### 事件类型

```typescript
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT   // 'saveDocument' - 文档保存事件
ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY  // 'documentReady' - 文档准备就绪事件
ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE  // 'loadingChange' - Loading 状态变化事件
```

### 监听事件

```typescript
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

// 监听文档准备就绪事件
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, (data) => {
  console.log('文档已准备就绪:', data.fileName);
  // data: { fileName: string, fileType: string }
});

// 监听文档保存事件
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT, (data) => {
  console.log('文档已保存:', data.fileName);
  // data: { fileName: string, fileType: string, binData: Uint8Array }
});

// 监听 Loading 状态变化事件（用于导出等操作）
onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, (data) => {
  setLoading(data.loading);
  // data: { loading: boolean }
});
```

### 等待事件

使用 `waitFor` 方法等待事件触发，返回 Promise：

```typescript
// 等待文档准备就绪（30秒超时）
const readyData = await onlyofficeEventbus.waitFor(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, 30000);

// 等待文档保存（3秒超时）
const saveData = await onlyofficeEventbus.waitFor(ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT, 3000);
```

### Loading 状态管理

`LOADING_CHANGE` 事件会在导出文档等操作时自动触发，用于显示加载状态：

```typescript
import { useEffect, useState } from 'react';
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';
import { ONLYOFFICE_EVENT_KEYS } from '@/onlyoffice-comp/lib/const';

function EditorPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 监听 loading 状态变化
    const handleLoadingChange = (data: { loading: boolean }) => {
      setLoading(data.loading);
    };
    
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);

    return () => {
      // 清理监听器
      onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);
    };
  }, []);

  return (
    <div>
      {loading && <Loading />}
      {/* 编辑器内容 */}
    </div>
  );
}
```

**注意：** `editorManager.export()` 方法会自动触发 `LOADING_CHANGE` 事件，无需手动管理 loading 状态。

### 取消监听

```typescript
const handler = (data) => {
  console.log('事件触发:', data);
};

onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, handler);
// ...
onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, handler);
```

## 完整示例

### React 组件示例

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { convertBinToDocument, createEditorView } from '@/onlyoffice-comp/lib/x2t';
import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';
import { setDocmentObj, getDocmentObj } from '@/onlyoffice-comp/lib/document-state';
import { editorManager } from '@/onlyoffice-comp/lib/editor-manager';
import { ONLYOFFICE_EVENT_KEYS, FILE_TYPE, ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';

export default function EditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  // 创建或打开文档
  const handleView = async (fileName: string, file?: File) => {
    setLoading(true);
    setError(null);
    try {
      setDocmentObj({ fileName, file });
      await initializeOnlyOffice();
      const { fileName: currentFileName, file: currentFile } = getDocmentObj();
      await createEditorView({
        file: currentFile,
        fileName: currentFileName,
        isNew: !currentFile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出文档
  const handleExport = async () => {
    try {
      const binData = await editorManager.export();
      const result = await convertBinToDocument(
        binData.binData,
        binData.fileName,
        FILE_TYPE.DOCX
      );
      
      // 下载文件
      const blob = new Blob([result.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = binData.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initializeOnlyOffice();
        await handleView('New_Document.docx');
      } catch (err) {
        setError('无法加载编辑器组件');
      }
    };

    init();

    // 监听文档准备就绪事件
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, (data) => {
      console.log('文档已准备就绪:', data);
    });

    // 监听 loading 状态变化
    const handleLoadingChange = (data: { loading: boolean }) => {
      setLoading(data.loading);
    };
    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);

    return () => {
      onlyofficeEventbus.off(ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE, handleLoadingChange);
      editorManager.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 控制栏 */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4">
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              上传文档
            </button>
            <button
              onClick={() => handleView('New_Document.docx')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md"
            >
              新建文档
            </button>
            {editorManager.exists() && (
              <>
                <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md"
                >
                  💾 导出
                </button>
                <button
                  onClick={async () => {
                    const newReadOnly = !readOnly;
                    setReadOnly(newReadOnly);
                    await editorManager.setReadOnly(newReadOnly);
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md"
                >
                  {readOnly ? '🔒 只读' : '✏️ 编辑'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4">
          <p>{error}</p>
        </div>
      )}

      {/* 编辑器容器 */}
      <div className="flex-1 relative">
        <div id={ONLYOFFICE_ID} className="absolute inset-0" />
      </div>

      {/* 文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.doc"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleView(file.name, file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}
```

## API 参考

### 常量

#### `ONLYOFFICE_ID`
编辑器容器的 DOM ID，默认为 `'iframe2'`

#### `ONLYOFFICE_EVENT_KEYS`
事件名称常量：
- `ONLYOFFICE_EVENT_KEYS.SAVE_DOCUMENT` - 文档保存事件
- `ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY` - 文档准备就绪事件
- `ONLYOFFICE_EVENT_KEYS.LOADING_CHANGE` - Loading 状态变化事件

#### `FILE_TYPE`
文件类型常量：
- `FILE_TYPE.DOCX` - Word 文档
- `FILE_TYPE.XLSX` - Excel 表格
- `FILE_TYPE.PPTX` - PowerPoint 演示文稿

### 类型定义

#### `DocumentReadyData`
```typescript
type DocumentReadyData = {
  fileName: string;
  fileType: string;
};
```

#### `SaveDocumentData`
```typescript
type SaveDocumentData = {
  fileName: string;
  fileType: string;
  binData: Uint8Array;
};
```

#### `LoadingChangeData`
```typescript
type LoadingChangeData = {
  loading: boolean;
};
```

## 注意事项

1. **初始化顺序**：必须先调用 `initializeOnlyOffice()` 再创建编辑器
2. **容器元素**：确保页面中存在 ID 为 `ONLYOFFICE_ID` 的容器元素
3. **文件类型**：确保文件扩展名与文件内容匹配
4. **事件清理**：在组件卸载时记得取消事件监听和销毁编辑器
5. **异步操作**：所有 API 都是异步的，需要使用 `await` 或 `.then()` 处理

## 支持的文件格式

### Word 文档
- `.docx` - Word 2007+
- `.doc` - Word 97-2003
- `.odt` - OpenDocument Text
- `.rtf` - Rich Text Format
- `.txt` - 纯文本

### Excel 表格
- `.xlsx` - Excel 2007+
- `.xls` - Excel 97-2003
- `.ods` - OpenDocument Spreadsheet
- `.csv` - CSV 文件

### PowerPoint 演示文稿
- `.pptx` - PowerPoint 2007+
- `.ppt` - PowerPoint 97-2003
- `.odp` - OpenDocument Presentation

