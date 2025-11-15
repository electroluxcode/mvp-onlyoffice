
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