
## todo

只读 切换到 编辑的逻辑，目前是销毁 only office 实例，然后重新挂载，目前有闪烁问题，后面再看着解决吧

## 说明
ref: https://api.onlyoffice.com/docs/plugin-and-macros/interacting-with-editors/text-document-api/Enumeration/DocumentEditingRestrictions/
用于测试 onlyoffice文件编辑功能
- excel ✅
- docs
- ppt

https://api.onlyoffice.com/zh-CN/docs/docs-api/usage-api/config/document/

## api

apps/api/documents/api.js

## 多语言
public/web-apps/apps/spreadsheeteditor/main/app.js

## 只读 / 可编辑
注意：根据源码分析，恢复编辑时可能无法生效，因为 onProcessRightsChange 只处理 enabled === false 的情况

## 文件保存 设计

文档保存使用 EventBus 机制进行通知。

### 工作原理

1. **保存事件触发**：当用户保存文档时，`onSaveInEditor` 处理数据并通过 `eventBus.emit('saveDocument', data)` 发送
2. **监听保存**：`editorManager.export()` 通过 `eventBus.waitFor('saveDocument')` 等待事件
3. **返回数据**：事件触发后，Promise resolve，返回文档数据

### 使用示例

```typescript
// 导出文档，返回 Promise
const data = await editorManager.export();
// data 包含: { fileName, fileType, binData }
// 应用层可以自行处理导出操作（如下载、上传等）

// 监听文档准备就绪事件
await createEditorView({ isNew: true, fileName: 'New_Document.docx' });
// 此时文档已经完全准备就绪
```

### 数据格式

```typescript
type SaveDocumentData = {
  fileName: string;    // 文件名
  fileType: string;    // 文件类型（如 'xlsx', 'docx'）
  binData: Uint8Array; // 二进制数据
}

type DocumentReadyData = {
  fileName: string;   // 文件名
  fileType: string;   // 文件类型
}
```

### EventBus API

支持多个事件类型，当前支持：
- `saveDocument` - 保存文档事件
- `documentReady` - 文档准备就绪事件

```typescript
// 监听事件
eventBus.on('saveDocument', (data) => { ... });
eventBus.on('documentReady', (data) => { ... });

// 取消监听
eventBus.off('saveDocument', callback);

// 触发事件
eventBus.emit('saveDocument', data);
eventBus.emit('documentReady', data);

// 等待事件（返回 Promise）
const data = await eventBus.waitFor('saveDocument', 3000); // 3秒超时
const readyData = await eventBus.waitFor('documentReady', 30000); // 30秒超时
```
