'use client';

import { useEffect, useRef, useState } from 'react';
import { convertBinToDocument, createEditorView } from '@/onlyoffice-comp/lib/x2t';

import { initializeOnlyOffice } from '@/onlyoffice-comp/lib/utils';
import { setDocmentObj, getDocmentObj } from '@/onlyoffice-comp/lib/document-state';
import { editorManager } from '@/onlyoffice-comp/lib/editor-manager';
import { ONLYOFFICE_EVENT_KEYS, FILE_TYPE, ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';
import Loading from '@/components/Loading';
import { onlyofficeEventbus } from '@/onlyoffice-comp/lib/eventbus';

export default function ExcelPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const initializedRef = useRef(false);
  const [_, forceUpdate] = useState(0);
  const handleView = async (fileName: string, file?: File) => {
    setError(null);
    try {
      setDocmentObj({ fileName, file });
      // 确保环境已初始化（如果已初始化会立即返回）
      await initializeOnlyOffice();
      const { fileName: currentFileName, file: currentFile } = getDocmentObj();
      await createEditorView({
        file: currentFile,
        fileName: currentFileName,
        isNew: !currentFile,
        readOnly: readOnly,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      console.error('Document operation failed:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        // 统一初始化所有资源
        await initializeOnlyOffice();
        // 默认加载 test.xlsx 文档
        if (!initializedRef.current && !editorManager.exists()) {
          initializedRef.current = true;
        }

          // 加载 public/test.xlsx 文件
          const response = await fetch('/test.xlsx');
          if (!response.ok) {
            throw new Error('无法加载 test.xlsx 文件');
          }
          const blob = await response.blob();
          const file = new File([blob], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          await handleView('test.xlsx', file);
      } catch (err) {
        console.error('Failed to initialize OnlyOffice:', err);
        setError('无法加载编辑器组件');
      }
    };

    init();

    onlyofficeEventbus.on(ONLYOFFICE_EVENT_KEYS.DOCUMENT_READY, (data) => {
      forceUpdate((prev) => prev + 1);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 控制栏 */}
      <div className="bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-white font-bold">
              E
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Excel</h1>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              上传文档
            </button>
            <button
              onClick={() => handleView('New_Document.xlsx')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              新建 Excel
            </button>
            {editorManager.exists() && (
              <>
                <button
                  onClick={async () => {
                    try {
                      const binData = await editorManager.export();
                      
                      const buffer = await convertBinToDocument(binData.binData, binData.fileName,FILE_TYPE.XLSX);
                      console.log(buffer);
                      // 下载文件
                      const blob = new Blob([buffer.data], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = binData.fileName;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();
                      // downloadFile(buffer.data, binData.fileName,'xlsx');
                    } catch (err) {
                      console.error('导出失败:', err);
                    } 
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  💾 导出
                </button>
                <button
                  onClick={async () => {
                    const newReadOnly = !readOnly;
                    setReadOnly(newReadOnly);
                    try {
                      await editorManager.setReadOnly(newReadOnly);
                    } catch (err) {
                      setError('切换模式失败');
                      console.error('Failed to toggle read-only mode:', err);
                    }
                  }}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    readOnly
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {readOnly ? '🔒 只读模式' : '✏️ 编辑模式'}
                </button>
                
              </>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mx-4 mt-4 rounded">
          <p className="font-medium">错误：{error}</p>
        </div>
      )}

      {/* 编辑器容器 */}
      <div className="flex-1 relative">
        <div id={ONLYOFFICE_ID} className="absolute inset-0" style={{ display: loading ? 'none' : 'block' }}/>
      </div>

      {/* 加载遮罩 */}
      {loading && <Loading />}


      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
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
