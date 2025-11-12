# UniverComponent

一个基于 Univer 的 Excel 文件查看和编辑组件，支持多工作表和样式导入。

## install

```
pnpm add ahooks react-i18next antd nanoid lodash-es xlsx-js-style @xmldom/xmldom
```


## 最新更新

### v2.0 - Excel 样式支持修复 ✨

- **🔧 修复样式读取问题**：替换标准 `xlsx` 库为 `xlsx-js-style` 库
- **🎨 增强样式转换**：支持完整的 Excel 样式信息读取和转换
- **🌈 颜色支持**：支持 RGB、索引和主题颜色格式
- **✅ 向后兼容**：保持与旧格式的完全兼容性

## 功能特性

- ✅ 支持多个工作表的 Excel 文件解析
- ✅ 支持完整的 Excel 样式导入（字体、颜色、边框、对齐等）
- ✅ 支持 CSV 文件导入
- ✅ 向后兼容旧格式
- ✅ 完整的 TypeScript 类型支持

## 支持的样式类型

### 字体样式
- 粗体、斜体、下划线、删除线
- 字体大小和字体名称
- 字体颜色

### 填充样式
- 背景颜色

### 对齐样式
- 水平对齐（左、中、右）
- 垂直对齐（上、中、下）
- 文本换行

### 边框样式
- 四边边框（上、下、左、右）
- 边框样式（细线、中线、粗线、虚线、点线）
- 边框颜色

### 数字格式
- 自定义数字格式

## 使用方法

### 基本用法

```tsx
import { UniverComponent } from './UniverComponent'

function App() {
  const handleFileUpload = (file: File) => {
    // 文件将自动解析多个工作表和样式
  }

  return (
    <UniverComponent
      onFileUpload={handleFileUpload}
      // 其他props...
    />
  )
}
```

### 数据格式

组件现在支持两种数据格式：

#### 旧格式（纯数据）
```typescript
const oldFormatData = {
  'Sheet1': [
    ['Name', 'Age', 'City'],
    ['John', 25, 'New York'],
    ['Jane', 30, 'London']
  ],
  'Sheet2': [
    ['Product', 'Price'],
    ['Laptop', 999],
    ['Mouse', 25]
  ]
}
```

#### 新格式（包含样式）
```typescript
const newFormatData = {
  'Sheet1': {
    data: [
      ['Name', 'Age', 'City'],
      ['John', 25, 'New York'],
      ['Jane', 30, 'London']
    ],
    styles: [
      [
        { font: { bold: true, sz: 12 } },
        { font: { bold: true, sz: 12 } },
        { font: { bold: true, sz: 12 } }
      ],
      [
        null,
        { fill: { fgColor: { rgb: 'FFFF0000' } } },
        { alignment: { horizontal: 'center' } }
      ],
      [
        null,
        null,
        { border: { top: { style: 'thin' } } }
      ]
    ]
  }
}
```

## API

### `readAllExcelSheets(file: File)`

读取 Excel 文件中的所有工作表，包括数据和样式信息。

```typescript
const result = await readAllExcelSheets(file)
// 返回格式：
// {
//   'Sheet1': {
//     data: any[][],
//     styles: any[][],
//     range: { s: { r: number, c: number }, e: { r: number, c: number } }
//   },
//   'Sheet2': { ... }
// }
```

### `transformMultiSheetsToWorkbookData(sheetsData, fileName?)`

将多个工作表数据转换为 Univer 工作簿格式。

```typescript
const workbookData = transformMultiSheetsToWorkbookData(sheetsData, 'MyWorkbook')
```

## 测试

```bash
npm test -- src/opensource/components/UniverComponent/__tests__/multi-sheet.test.tsx
```

## 兼容性

- 支持 `.xlsx` 和 `.xls` 格式
- 支持 `.csv` 格式
- 向后兼容旧的单工作表格式
- 自动识别并处理新旧数据格式

## 注意事项

- Excel 样式转换基于 XLSX 库的 `cellStyles` 选项
- 某些复杂的 Excel 样式可能不完全支持
- 建议在生产环境中测试特定的 Excel 文件格式 