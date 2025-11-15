import { getExtensions, loadEditorApi } from './utils';
import { g_sEmpty_bin } from './empty_bin';
import { getDocmentObj } from './utils';
import { editorManager } from './editor-manager';
import { ONLUOFFICE_RESOURCE, ONLYOFFICE_ID } from './const';

declare global {
  interface Window {
    Module: EmscriptenModule;
  }
}

// types/x2t.d.ts - 类型定义文件
interface EmscriptenFileSystem {
  mkdir(path: string): void;
  readdir(path: string): string[];
  readFile(path: string, options?: { encoding: 'binary' }): BlobPart;
  writeFile(path: string, data: Uint8Array | string): void;
}

interface EmscriptenModule {
  FS: EmscriptenFileSystem;
  ccall: (funcName: string, returnType: string, argTypes: string[], args: any[]) => number;
  onRuntimeInitialized: () => void;
}

interface ConversionResult {
  fileName: string;
  type: DocumentType;
  bin: BlobPart;
  media: Record<string, string>;
}

interface BinConversionResult {
  fileName: string;
  data: BlobPart;
}

type DocumentType = 'word' | 'cell' | 'slide';

/**
 * X2T 工具类 - 负责文档转换功能
 */
class X2TConverter {
  private x2tModule: EmscriptenModule | null = null;
  private isReady = false;
  private initPromise: Promise<EmscriptenModule> | null = null;
  private hasScriptLoaded = false;

  // 支持的文件类型映射
  private readonly DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
    docx: 'word',
    doc: 'word',
    odt: 'word',
    rtf: 'word',
    txt: 'word',
    xlsx: 'cell',
    xls: 'cell',
    ods: 'cell',
    csv: 'cell',
    pptx: 'slide',
    ppt: 'slide',
    odp: 'slide',
  };

  private readonly WORKING_DIRS = ['/working', '/working/media', '/working/fonts', '/working/themes'];
  private readonly SCRIPT_PATH = ONLUOFFICE_RESOURCE.X2T;
  private readonly INIT_TIMEOUT = 300000;

  /**
   * 加载 X2T 脚本文件
   */
  async loadScript(): Promise<void> {
    if (this.hasScriptLoaded) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.SCRIPT_PATH;
      script.onload = () => {
        this.hasScriptLoaded = true;
        console.log('X2T WASM script loaded successfully');
        resolve();
      };

      script.onerror = (error) => {
        const errorMsg = 'Failed to load X2T WASM script';
        console.error(errorMsg, error);
        reject(new Error(errorMsg));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 初始化 X2T 模块
   */
  async initialize(): Promise<EmscriptenModule> {
    if (this.isReady && this.x2tModule) {
      return this.x2tModule;
    }

    // 防止重复初始化
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<EmscriptenModule> {
    try {
      await this.loadScript();
      return new Promise((resolve, reject) => {
        const x2t = window.Module;
        if (!x2t) {
          reject(new Error('X2T module not found after script loading'));
          return;
        }

        // 设置超时处理
        const timeoutId = setTimeout(() => {
          if (!this.isReady) {
            reject(new Error(`X2T initialization timeout after ${this.INIT_TIMEOUT}ms`));
          }
        }, this.INIT_TIMEOUT);

        x2t.onRuntimeInitialized = () => {
          try {
            clearTimeout(timeoutId);
            this.createWorkingDirectories(x2t);
            this.x2tModule = x2t;
            this.isReady = true;
            console.log('X2T module initialized successfully');
            resolve(x2t);
          } catch (error) {
            reject(error);
          }
        };
      });
    } catch (error) {
      this.initPromise = null; // 重置以允许重试
      throw error;
    }
  }

  /**
   * 创建工作目录
   */
  private createWorkingDirectories(x2t: EmscriptenModule): void {
    this.WORKING_DIRS.forEach((dir) => {
      try {
        x2t.FS.mkdir(dir);
      } catch (error) {
        // 目录可能已存在，忽略错误
        console.warn(`Directory ${dir} may already exist:`, error);
      }
    });
  }

  /**
   * 获取文档类型
   */
  private getDocumentType(extension: string): DocumentType {
    const docType = this.DOCUMENT_TYPE_MAP[extension.toLowerCase()];
    if (!docType) {
      throw new Error(`Unsupported file format: ${extension}`);
    }
    return docType;
  }

  /**
   * 清理文件名
   */
  private sanitizeFileName(input: string): string {
    if (typeof input !== 'string' || !input.trim()) {
      return 'file.bin';
    }

    const parts = input.split('.');
    const ext = parts.pop() || 'bin';
    const name = parts.join('.');

    const illegalChars = /[/?<>\\:*|"]/g;
    // eslint-disable-next-line no-control-regex
    const controlChars = /[\x00-\x1f\x80-\x9f]/g;
    const reservedPattern = /^\.+$/;
    const unsafeChars = /[&'%!"{}[\]]/g;

    let sanitized = name
      .replace(illegalChars, '')
      .replace(controlChars, '')
      .replace(reservedPattern, '')
      .replace(unsafeChars, '');

    sanitized = sanitized.trim() || 'file';
    return `${sanitized.slice(0, 200)}.${ext}`; // 限制长度
  }

  /**
   * 执行文档转换
   */
  private executeConversion(paramsPath: string): void {
    if (!this.x2tModule) {
      throw new Error('X2T module not initialized');
    }

    const result = this.x2tModule.ccall('main1', 'number', ['string'], [paramsPath]);
    if (result !== 0) {
      throw new Error(`Conversion failed with code: ${result}`);
    }
  }

  /**
   * 创建转换参数 XML
   */
  private createConversionParams(fromPath: string, toPath: string, additionalParams = ''): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${fromPath}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${toPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  ${additionalParams}
</TaskQueueDataConvert>`;
  }

  /**
   * 读取媒体文件
   */
  private readMediaFiles(): Record<string, string> {
    if (!this.x2tModule) return {};

    const media: Record<string, string> = {};

    try {
      const files = this.x2tModule.FS.readdir('/working/media/');

      files
        .filter((file) => file !== '.' && file !== '..')
        .forEach((file) => {
          try {
            const fileData = this.x2tModule!.FS.readFile(`/working/media/${file}`, {
              encoding: 'binary',
            }) as BlobPart;

            const blob = new Blob([fileData]);
            const mediaUrl = window.URL.createObjectURL(blob);
            media[`media/${file}`] = mediaUrl;
          } catch (error) {
            console.warn(`Failed to read media file ${file}:`, error);
          }
        });
    } catch (error) {
      console.warn('Failed to read media directory:', error);
    }

    return media;
  }

  /**
   * 将文档转换为 bin 格式
   */
  async convertDocument(file: File): Promise<ConversionResult> {
    await this.initialize();

    const fileName = file.name;
    const fileExt = getExtensions(file?.type)[0] || fileName.split('.').pop() || '';
    const documentType = this.getDocumentType(fileExt);

    try {
      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      // 生成安全的文件名
      const sanitizedName = this.sanitizeFileName(fileName);
      const inputPath = `/working/${sanitizedName}`;
      const outputPath = `${inputPath}.bin`;

      // 写入文件到虚拟文件系统
      this.x2tModule!.FS.writeFile(inputPath, data);

      // 创建转换参数
      const params = this.createConversionParams(inputPath, outputPath);
      this.x2tModule!.FS.writeFile('/working/params.xml', params);

      // 执行转换
      this.executeConversion('/working/params.xml');

      // 读取转换结果
      const result = this.x2tModule!.FS.readFile(outputPath);
      const media = this.readMediaFiles();

      return {
        fileName: sanitizedName,
        type: documentType,
        bin: result,
        media,
      };
    } catch (error) {
      throw new Error(`Document conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 将 bin 格式转换为指定格式并下载
   */
  async convertBinToDocumentAndDownload(
    bin: Uint8Array,
    originalFileName: string,
    targetExt = 'DOCX',
  ): Promise<BinConversionResult> {
    await this.initialize();

    const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
    const binFileName = `${sanitizedBase}.bin`;
    const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

    try {
      // 写入 bin 文件
      this.x2tModule!.FS.writeFile(`/working/${binFileName}`, bin);

      // 创建转换参数
      let additionalParams = '';
      if (targetExt === 'PDF') {
        additionalParams = '<m_sFontDir>/working/fonts/</m_sFontDir>';
      }

      const params = this.createConversionParams(
        `/working/${binFileName}`,
        `/working/${outputFileName}`,
        additionalParams,
      );

      this.x2tModule!.FS.writeFile('/working/params.xml', params);

      // 执行转换
      this.executeConversion('/working/params.xml');

      // 读取生成的文档
      const result = this.x2tModule!.FS.readFile(`/working/${outputFileName}`);

      // 确保 result 是 Uint8Array 类型
      const resultArray = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayBuffer);

      // 下载文件
      // TODO: 完善打印功能
      this.saveWithFileSystemAPI(resultArray, outputFileName);

      return {
        fileName: outputFileName,
        data: result,
      };
    } catch (error) {
      throw new Error(`Bin to document conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 下载文件
   */
  private downloadFile(data: Uint8Array, fileName: string): void {
    const blob = new Blob([data as BlobPart]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // 清理资源
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeMap: Record<string, string> = {
      // 文档类型
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      odt: 'application/vnd.oasis.opendocument.text',
      rtf: 'application/rtf',
      txt: 'text/plain',
      pdf: 'application/pdf',

      // 表格类型
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      csv: 'text/csv',

      // 演示文稿类型
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      odp: 'application/vnd.oasis.opendocument.presentation',

      // 图片类型
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };

    return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * 获取文件类型描述
   */
  private getFileDescription(extension: string): string {
    const descriptionMap: Record<string, string> = {
      docx: 'Word Document',
      doc: 'Word 97-2003 Document',
      odt: 'OpenDocument Text',
      pdf: 'PDF Document',
      xlsx: 'Excel Workbook',
      xls: 'Excel 97-2003 Workbook',
      ods: 'OpenDocument Spreadsheet',
      pptx: 'PowerPoint Presentation',
      ppt: 'PowerPoint 97-2003 Presentation',
      odp: 'OpenDocument Presentation',
      txt: 'Text Document',
      rtf: 'Rich Text Format',
      csv: 'CSV File',
    };

    return descriptionMap[extension.toLowerCase()] || 'Document';
  }

  /**
   * 使用现代文件系统 API 保存文件
   */
  private async saveWithFileSystemAPI(data: Uint8Array, fileName: string, mimeType?: string): Promise<void> {
    if (!(window as any).showSaveFilePicker) {
      this.downloadFile(data, fileName);
      return;
    }
    try {
      // 获取文件扩展名并确定 MIME 类型
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const detectedMimeType = mimeType || this.getMimeTypeFromExtension(extension);

      // 显示文件保存对话框
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: this.getFileDescription(extension),
            accept: {
              [detectedMimeType]: [`.${extension}`],
            },
          },
        ],
      });

      // 创建可写流并写入数据
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      console.log('File saved successfully:', fileName);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('User cancelled the save operation');
        return;
      }
      throw error;
    }
  }

  /**
   * 销毁实例，清理资源
   */
  destroy(): void {
    this.x2tModule = null;
    this.isReady = false;
    this.initPromise = null;
    console.log('X2T converter destroyed');
  }
}


// 单例实例
const x2tConverter = new X2TConverter();
export const loadScript = (): Promise<void> => x2tConverter.loadScript();
export const initX2T = (): Promise<EmscriptenModule> => x2tConverter.initialize();
export const convertDocument = (file: File): Promise<ConversionResult> => x2tConverter.convertDocument(file);
export const convertBinToDocumentAndDownload = (
  bin: Uint8Array,
  fileName: string,
  targetExt?: string,
): Promise<BinConversionResult> => x2tConverter.convertBinToDocumentAndDownload(bin, fileName, targetExt);

// 重新导出 loadEditorApi
export { loadEditorApi };


// 文件类型常量
export const oAscFileType = {
  UNKNOWN: 0,
  PDF: 513,
  PDFA: 521,
  DJVU: 515,
  XPS: 516,
  DOCX: 65,
  DOC: 66,
  ODT: 67,
  RTF: 68,
  TXT: 69,
  HTML: 70,
  MHT: 71,
  EPUB: 72,
  FB2: 73,
  MOBI: 74,
  DOCM: 75,
  DOTX: 76,
  DOTM: 77,
  FODT: 78,
  OTT: 79,
  DOC_FLAT: 80,
  DOCX_FLAT: 81,
  HTML_IN_CONTAINER: 82,
  DOCX_PACKAGE: 84,
  OFORM: 85,
  DOCXF: 86,
  DOCY: 4097,
  CANVAS_WORD: 8193,
  JSON: 2056,
  XLSX: 257,
  XLS: 258,
  ODS: 259,
  CSV: 260,
  XLSM: 261,
  XLTX: 262,
  XLTM: 263,
  XLSB: 264,
  FODS: 265,
  OTS: 266,
  XLSX_FLAT: 267,
  XLSX_PACKAGE: 268,
  XLSY: 4098,
  PPTX: 129,
  PPT: 130,
  ODP: 131,
  PPSX: 132,
  PPTM: 133,
  PPSM: 134,
  POTX: 135,
  POTM: 136,
  FODP: 137,
  OTP: 138,
  PPTX_PACKAGE: 139,
  IMG: 1024,
  JPG: 1025,
  TIFF: 1026,
  TGA: 1027,
  GIF: 1028,
  PNG: 1029,
  EMF: 1030,
  WMF: 1031,
  BMP: 1032,
  CR2: 1033,
  PCX: 1034,
  RAS: 1035,
  PSD: 1036,
  ICO: 1037,
} as const;

export const c_oAscFileType2 = Object.fromEntries(
  Object.entries(oAscFileType).map(([key, value]) => [value, key]),
) as Record<number, keyof typeof oAscFileType>;

interface SaveEvent {
  data: {
    data: {
      data: Uint8Array;
    };
    option: {
      outputformat: number;
    }; 
  };
}

async function handleSaveDocument(event: SaveEvent) {
  console.log('Save document event:', event);
  console.log('Event data structure:', JSON.stringify(event, null, 2));
  const rawDataType = typeof (event.data?.data as any)?.data;
  console.log('Raw data type:', rawDataType);
  const rawDataValue = (event.data?.data as any)?.data;
  if (typeof rawDataValue === 'string') {
    console.log('Raw data sample (first 200 chars):', rawDataValue.substring(0, 200));
  } else {
    console.log('Raw data sample:', rawDataValue);
  }

  if (event.data && event.data.data) {
    const { data, option } = event.data;
    const { fileName } = getDocmentObj() || {};
    
    // 确保 data.data 是 Uint8Array
    let binData: Uint8Array;
    const rawData = data.data as any;
    
    if (typeof rawData === 'string') {
      // 如果是字符串，可能是 base64 编码的数据或 OnlyOffice 内部格式
      // OnlyOffice 的 downloadAs 方法返回的数据可能是字符串格式
      try {
        // 首先尝试直接使用字符串作为二进制数据
        // 将字符串转换为 Uint8Array
        const encoder = new TextEncoder();
        const bytes = encoder.encode(rawData);
        binData = bytes;
        
        // 如果字符串看起来像 base64（以常见 base64 字符开头），尝试解码
        if (rawData.match(/^[A-Za-z0-9+/=]+$/)) {
          try {
            const binaryString = atob(rawData);
            const decodedBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              decodedBytes[i] = binaryString.charCodeAt(i);
            }
            // 如果解码后的数据看起来更合理（非空且长度合理），使用解码后的数据
            if (decodedBytes.length > 0 && decodedBytes.length < bytes.length * 2) {
              binData = decodedBytes;
            }
          } catch (e) {
            // base64 解码失败，使用原始字符串编码
            console.log('Base64 decode failed, using raw string encoding');
          }
        }
      } catch (error) {
        console.error('Failed to process string data:', error);
        binData = new Uint8Array(0);
      }
    } else if (rawData instanceof Uint8Array) {
      binData = rawData;
    } else if (rawData instanceof ArrayBuffer) {
      binData = new Uint8Array(rawData);
    } else if (rawData && typeof rawData === 'object' && 'buffer' in rawData) {
      // 可能是 TypedArray 或其他类似结构
      binData = new Uint8Array(rawData.buffer || rawData);
    } else {
      console.error('Invalid data type in save event:', typeof rawData, rawData);
      binData = new Uint8Array(0);
    }
    
    // 创建下载
    if (binData.length > 0) {
      await convertBinToDocumentAndDownload(binData, fileName, c_oAscFileType2[option.outputformat]);
    } else {
      console.error('Empty document data in save event');
    }
  }

  // 告知编辑器保存完成
  editorManager.get()?.sendCommand({
    command: 'asc_onSaveCallback',
    data: { err_code: 0 },
  });
}

// 获取文档类型
export function getDocumentType(fileType: string): string | null {
  const type = fileType.toLowerCase();
  if (type === 'docx' || type === 'doc') {
    return 'word';
  } else if (type === 'xlsx' || type === 'xls') {
    return 'cell';
  } else if (type === 'pptx' || type === 'ppt') {
    return 'slide';
  }
  return null;
}

// 公共编辑器创建方法
export function createEditorInstance(config: {
  fileName: string;
  fileType: string;
  binData: ArrayBuffer | string;
  media?: any;
  readOnly?: boolean; // 是否只读模式，默认为 false
}) {
  const { fileName, fileType, binData, media, readOnly = false } = config;

  // 确保 API 已加载
  if (!window.DocsAPI) {
    throw new Error('OnlyOffice API 未加载，请先调用 loadEditorApi()');
  }

  // 确保容器元素存在（OnlyOffice 的 destroyEditor 可能会删除它）
  // 使用 editorManager 的配置来获取容器信息
  const containerId = editorManager.getContainerId();
  let container = document.getElementById(containerId);
  if (!container) {
    // 如果容器不存在，创建一个新的
    container = document.createElement('div');
    container.id = containerId;
    container.className = 'absolute inset-0';
    // 尝试找到父容器（使用 editorManager 的配置）
    const parentSelector = editorManager.getContainerParentSelector();
    const parent = document.querySelector(parentSelector) || document.body;
    parent.appendChild(container);
    console.warn('Container element was missing, created a new one');
  }

  // 创建编辑器实例
  const editor = new window.DocsAPI.DocEditor(ONLYOFFICE_ID, {
    document: {
      title: fileName,
      url: fileName, // 使用文件名作为标识
      fileType: fileType,
      permissions: {
        // edit: !readOnly, // 根据 readOnly 参数设置编辑权限
        chat: false,
        protect: false,
        print: false,
      },
    },
    editorConfig: {
      // mode: readOnly ? 'view' : 'edit', // 根据 readOnly 参数设置模式
      // lang: 'zh',
      customization: {
        help: false,
        about: false,
        hideRightMenu: true,
        features: {
          spellcheck: {
            change: false,
          },
        },
         // 取消远程 modal 弹窗
        anonymous: {
          request: false,
          label: 'Guest',
        },
        layout: { 
          header: {
              users: false, // users list button
              save: false, // save button
              editMode: false, // change mode button
              user: false // icon of current user
          },
      },
      },
    },
    events: {
      onAppReady: () => {
        // 直接使用 editor 实例，因为此时编辑器还未注册到管理器
        // 设置媒体资源
        if (media) {
          editor.sendCommand({
            command: 'asc_setImageUrls',
            data: { urls: media },
          });
        }

        // 加载文档内容
        editor.sendCommand({
          command: 'asc_openDocument',
          data: { buf: binData as any },
        });
      },
      onDocumentReady: () => {
        console.log('文档加载完成：', fileName);
      },

      // core: 下载
      onSave: handleSaveDocument,
      onDownloadAs: (event: any) => {
        console.log('DownloadAs event:', event);
        // 如果提供了下载 URL，直接下载
        if (event.data && event.data.url) {
          const link = document.createElement('a');
          link.href = event.data.url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    },
  });

  // 使用管理器注册编辑器实例，保存配置以便后续切换只读模式
  editorManager.create(editor, {
    fileName,
    fileType,
    binData,
    media,
    readOnly,
    events: {
      onSave: handleSaveDocument,
    },
  });
}

// 合并后的文件操作方法
export async function handleDocumentOperation(options: {
  isNew: boolean;
  fileName: string;
  file?: File;
}): Promise<void> {
  try {
    const { isNew, fileName, file } = options;
    const fileType = getExtensions(file?.type || '')[0] || fileName.split('.').pop() || '';

    // 获取文档内容
    let documentData: {
      bin: ArrayBuffer | string;
      media?: any;
    };

    if (isNew) {
      // 新建文档使用空模板
      const emptyBin = g_sEmpty_bin[`.${fileType}`];
      if (!emptyBin) {
        throw new Error(`不支持的文件类型：${fileType}`);
      }
      documentData = { bin: emptyBin };
    } else {
      // 打开现有文档需要转换
      if (!file) throw new Error('无效的文件对象');
      // @ts-expect-error convertDocument handles the file type conversion
      documentData = await convertDocument(file);
    }

    // 创建编辑器实例
    createEditorInstance({
      fileName,
      fileType,
      binData: documentData.bin,
      media: documentData.media,
    });
  } catch (error: any) {
    console.error('文档操作失败：', error);
    alert(`文档操作失败：${error.message}`);
    throw error;
  }
}
