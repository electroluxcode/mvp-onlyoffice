'use client';

import { useEffect, useRef, useState } from 'react';
import { loadScript, loadEditorApi, initX2T, handleDocumentOperation } from '@/onlyoffice-comp/lib/x2t';
import { setDocmentObj, getDocmentObj } from '@/onlyoffice-comp/lib/document';
import { editorManager } from '@/onlyoffice-comp/lib/editor-manager';
import { ONLYOFFICE_ID } from '@/onlyoffice-comp/lib/const';
import Loading from '@/components/Loading';

export default function PptPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const initializedRef = useRef(false);

  const handleOperation = async (fileName: string, file?: File) => {
    setLoading(true);
    setError(null);
    try {
      setDocmentObj({ fileName, file });
      await loadScript();
      await loadEditorApi();
      await initX2T();
      const { fileName: currentFileName, file: currentFile } = getDocmentObj();
      await handleDocumentOperation({
        file: currentFile,
        fileName: currentFileName,
        isNew: !currentFile,
      });
      setReadOnly(editorManager.getReadOnly());
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
      console.error('Document operation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadEditorApi();
        // 默认加载空 PowerPoint 文档
        if (!initializedRef.current && !editorManager.exists()) {
          initializedRef.current = true;
          await handleOperation('New_Document.pptx');
        }
      } catch (err) {
        console.error('Failed to load editor API:', err);
        setError('无法加载编辑器组件');
      }
    };

    init();

    return () => {
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
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center text-white font-bold">
              P
            </div>
            <h1 className="text-lg font-semibold text-gray-900">PowerPoint</h1>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              上传文档
            </button>
            <button
              onClick={() => handleOperation('New_Document.pptx')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              新建 PowerPoint
            </button>
            {editorManager.exists() && (
              <>
                <button
                  onClick={() => editorManager.export()}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  💾 导出
                </button>
                <button
                  onClick={async () => {
                    const newReadOnly = !readOnly;
                    setReadOnly(newReadOnly);
                    setLoading(true);
                    try {
                      await editorManager.setReadOnly(newReadOnly);
                    } catch (err) {
                      setError('切换模式失败');
                      console.error('Failed to toggle read-only mode:', err);
                    } finally {
                      setLoading(false);
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
                <button
                  onClick={() => editorManager.print()}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  🖨️ 打印
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
        <div id={ONLYOFFICE_ID} className="absolute inset-0" />
      </div>

      {/* 加载遮罩 */}
      {loading && <Loading />}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx,.ppt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleOperation(file.name, file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        }}
      />
    </div>
  );
}
