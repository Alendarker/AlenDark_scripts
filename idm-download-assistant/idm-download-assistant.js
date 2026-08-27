// ==UserScript==
// @name         IDM Download Assistant
// @name:zh-CN   IDM下载助手
// @name:zh-TW   IDM下載助手
// @name:en      IDM Download Assistant
// @name:ja      IDM ダウンロードアシスタント
// @name:de      IDM-Download-Assistent
// @name:ru      Помощник загрузки IDM
// @namespace    https://tampermonkey.net/
// @version      1.0
// @description  Scan paginated lists and up to three webpage levels, repair filenames, prepare IDM browser-extension links, and export results.
// @description:zh-CN 列表分页与一至三级网页嗅探、中文文件名修复、IDM浏览器插件批量选择及多格式导出。
// @description:zh-TW 列表分頁與一至三級網頁嗅探、中文檔名修復、IDM瀏覽器外掛批次選取及多格式匯出。
// @description:en Scan paginated lists and up to three webpage levels, repair filenames, prepare IDM browser-extension links, and export results.
// @description:ja ページ分割された一覧と最大3階層のWebページを探索し、ファイル名の修復、IDM拡張機能用リンクの準備、各形式への書き出しを行います。
// @description:de Durchsucht paginierte Listen und bis zu drei Webseiten-Ebenen, korrigiert Dateinamen, bereitet Links für die IDM-Browsererweiterung vor und exportiert Ergebnisse.
// @description:ru Сканирует списки с пагинацией и до трёх уровней страниц, исправляет имена файлов, подготавливает ссылки для расширения IDM и экспортирует результаты.
// @author       ChatGPT
// @license      MIT
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    /**********************************************************************
     * 0. 配置
     **********************************************************************/
    const CONFIG = {

        fileExts: [
            'pdf',
            'doc',
            'docx',
            'xls',
            'xlsx',
            'ppt',
            'pptx',
            'dwg',
            'dxf',
            'shp',
            'tif',
            'tiff',
            'zip',
            'rar',
            '7z'
        ],

        blockedExts: [
            'jpg',
            'jpeg',
            'png',
            'gif',
            'webp',
            'svg',
            'bmp',
            'ico',
            'css',
            'js',
            'mjs',
            'map',
            'woff',
            'woff2',
            'ttf',
            'eot',
            'mp3',
            'wav',
            'mp4',
            'avi',
            'mov',
            'm3u8'
        ],

        invalidTexts: [
            '下载',
            '点击下载',
            '立即下载',
            '查看附件',
            '附件',
            '附件下载',
            '文件下载',
            '下载文件',
            '查看',
            '点击查看',
            '打开附件',
            'download',
            '点击',
            '打开',
            '详情',
            '查看详情'
        ],

        navigationTexts: [
            '首页',
            '上一页',
            '下一页',
            '上页',
            '下页',
            '末页',
            '尾页',
            '返回',
            '返回首页',
            'prev',
            'previous',
            'next',
            'home',
            'last',
            'more',
            '更多'
        ],

        genericFileNames: [
            '初步设计报告',
            '初设报告',
            '可行性研究报告',
            '可研报告',
            '施工图',
            '设计图纸',
            '水资源论证报告',
            '洪水影响评价报告',
            '防洪评价报告',
            '水土保持方案',
            '批复文件',
            '批复',
            '报告',
            '公示材料',
            '招标文件',
            '图纸',
            '附件'
        ],

        // 单个页面最多加入多少个候选子页面。
        maxSniffLinksPerPage: 160,

        sniffConcurrency: 4,

        maxHeadRequestsPerScan: 50,

        headConcurrency: 4,

        mutationDebounceMs: 1000,

        supportUrl: 'https://ko-fi.com/alen685279',

        helpUrls: {
            'zh-CN': 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.md',
            'zh-TW': 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.zh-TW.md',
            en: 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.en.md',
            ja: 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.ja.md',
            de: 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.de.md',
            ru: 'https://github.com/Alendarker/AlenDark_scripts/blob/main/idm-download-assistant/README.ru.md'
        }
    };


    const EXT_GROUP =
        CONFIG.fileExts.join('|');


    const FILE_EXT_RE =
        new RegExp(
            `\\.(${EXT_GROUP})(?:$|[?#&])`,
            'i'
        );


    const FILE_EXT_END_RE =
        new RegExp(
            `\\.(${EXT_GROUP})$`,
            'i'
        );


    const BLOCKED_EXT_RE =
        new RegExp(
            `\\.(${CONFIG.blockedExts.join('|')})(?:$|[?#&])`,
            'i'
        );


    const DOWNLOAD_URL_RE =
        /(download|attachment|attach|file|upload|resource|document|docfile|downfile|downloadfile|filedownload|files\/)/i;


    const ATTACHMENT_WORD_RE =
        /(附件|下载|文件|报告|批复|图纸|设计|论证|评价|公示材料|压缩包|电子版|文档|材料)/i;


    const CHINESE_RE =
        /[\u3400-\u9fff]/;


    const MIME_TO_EXT = {

        'application/pdf':
            'pdf',

        'application/msword':
            'doc',

        'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            'docx',

        'application/vnd.ms-excel':
            'xls',

        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            'xlsx',

        'application/vnd.ms-powerpoint':
            'ppt',

        'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            'pptx',

        'application/zip':
            'zip',

        'application/x-zip-compressed':
            'zip',

        'application/x-rar-compressed':
            'rar',

        'application/vnd.rar':
            'rar',

        'application/x-7z-compressed':
            '7z',

        'image/tiff':
            'tif'
    };


    const STORAGE_KEYS = {

        panelCollapsed:
            'idm-download-assistant.panelCollapsed',

        panelPosition:
            'idm-download-assistant.panelPosition',

        themeMode:
            'idm-download-assistant.themeMode',

        listPages:
            'idm-download-assistant.listPages',

        sniffDepth:
            'idm-download-assistant.sniffDepth',

        sniffChildPages:
            'idm-download-assistant.sniffChildPages'
    };


    function readStoredValue(
        key,
        fallback
    ) {

        try {

            if (
                typeof GM_getValue ===
                'function'
            ) {

                return GM_getValue(
                    key,
                    fallback
                );
            }

        } catch (_) {}


        try {

            const raw =
                globalThis.localStorage
                    ?.getItem(
                        key
                    );


            return raw == null
                ? fallback
                : JSON.parse(
                    raw
                );

        } catch (_) {

            return fallback;
        }
    }


    function writeStoredValue(
        key,
        value
    ) {

        try {

            if (
                typeof GM_setValue ===
                'function'
            ) {

                GM_setValue(
                    key,
                    value
                );

                return;
            }

        } catch (_) {}


        try {

            globalThis.localStorage
                ?.setItem(
                    key,
                    JSON.stringify(
                        value
                    )
                );

        } catch (_) {}
    }


    function clampInteger(
        value,
        fallback,
        min
    ) {

        const number =
            Number.parseInt(
                value,
                10
            );


        if (
            !Number.isFinite(
                number
            ) ||
            number < min
        ) {

            return fallback;
        }


        return number;
    }


    function normalizeThemeMode(value) {

        return [
            'auto',
            'dark',
            'light'
        ].includes(
            value
        )
            ? value
            : 'auto';
    }


    function normalizeSniffDepth(value) {

        return [
            '1',
            '2',
            '3'
        ].includes(
            String(
                value
            )
        )
            ? String(
                value
            )
            : '1';
    }


    function normalizePanelPosition(value) {

        if (
            !value ||
            typeof value !==
            'object'
        ) {

            return null;
        }


        const left =
            Number(
                value.left
            );


        const top =
            Number(
                value.top
            );


        if (
            !Number.isFinite(
                left
            ) ||
            !Number.isFinite(
                top
            )
        ) {

            return null;
        }


        return {
            left,
            top
        };
    }


    const state = {

        items: [],

        byUrl: new Map(),

        scanning: false,

        observerTimer: null,

        panelCollapsed:
            Boolean(
                readStoredValue(
                    STORAGE_KEYS.panelCollapsed,
                    false
                )
            ),

        panelPosition:
            normalizePanelPosition(
                readStoredValue(
                    STORAGE_KEYS.panelPosition,
                    null
                )
            ),

        themeMode:
            normalizeThemeMode(
                readStoredValue(
                    STORAGE_KEYS.themeMode,
                    'auto'
                )
            ),

        uiSettings: {

            listPages:
                clampInteger(
                    readStoredValue(
                        STORAGE_KEYS.listPages,
                        1
                    ),
                    1,
                    1
                ),

            sniffDepth:
                normalizeSniffDepth(
                    readStoredValue(
                        STORAGE_KEYS.sniffDepth,
                        '1'
                    )
                ),

            sniffChildPages:
                clampInteger(
                    readStoredValue(
                        STORAGE_KEYS.sniffChildPages,
                        20
                    ),
                    20,
                    1
                )
        },

        filterText: '',

        filenameAffixes: {

            prefixEnabled: false,

            prefixText: '',

            suffixEnabled: false,

            suffixText: ''
        }
    };


    const UI_LANGUAGE =
        (() => {

            const preferred =
                String(
                    globalThis.navigator
                        ?.languages?.[0] ||
                    globalThis.navigator
                        ?.language ||
                    'en'
                )
                    .toLowerCase();


            if (
                /^zh-(?:tw|hk|mo|hant)/.test(
                    preferred
                )
            ) {

                return 'zh-TW';
            }


            if (
                preferred.startsWith(
                    'zh'
                )
            ) {

                return 'zh-CN';
            }


            if (
                preferred.startsWith(
                    'ja'
                )
            ) {

                return 'ja';
            }


            if (
                preferred.startsWith(
                    'de'
                )
            ) {

                return 'de';
            }


            if (
                preferred.startsWith(
                    'ru'
                )
            ) {

                return 'ru';
            }


            return 'en';
        })();


    const I18N = {

        'zh-CN': {
            appTitle: 'IDM下载助手',
            collapseExpand: '收起/展开',
            hideWindow: '隐藏窗口',
            theme: '主题',
            themeTitle: '选择下载助手界面主题',
            themeAuto: '自动',
            themeDark: '深色',
            themeLight: '浅色',
            fetch: '抓取',
            listPages: '个列表页',
            sniffDepth: '嗅探级别',
            level1: '一级',
            level2: '二级',
            level3: '三级',
            perLevelMax: '每级最多',
            childPages: '个子页面',
            perLevelTooltip: '每个列表页最多进入这么多个二级页；每个二级页最多再进入这么多个三级页',
            startSniff: '开始嗅探',
            startSniffTitle: '按第一行设置扫描列表分页及下级网页',
            prepareIdm: '准备IDM插件',
            prepareIdmTitle: '准备并选中链接，然后使用 IDM 插件右键命令',
            copySelectedIdm: '复制选中→IDM',
            selectAll: '全选',
            selectNone: '全不选',
            invert: '反选',
            filterPlaceholder: '搜索/过滤名称、栏目、项目名…',
            selectFiltered: '勾选筛选结果',
            prefix: '前缀',
            suffix: '后缀',
            prefixToggleTitle: '勾选后启用；取消勾选会撤销本功能添加的前缀',
            suffixToggleTitle: '勾选后启用；取消勾选会撤销本功能添加的后缀',
            prefixPlaceholder: '输入前缀，可包含分隔符',
            prefixInputTitle: '内容会原样放在文件名前；默认仅提供页面标题作为建议，不会自动启用',
            suffixPlaceholder: '输入后缀，如 _已发布',
            suffixInputTitle: '后缀会放在扩展名前，例如 文件名_已发布.pdf',
            exportTxt: '导出TXT',
            exportCsv: '导出CSV',
            exportExcel: '导出Excel',
            clear: '清空',
            supportAuthor: '支持作者',
            supportAuthorTitle: '打开作者 Ko-fi 赞赏页面',
            help: '帮助',
            helpTitle: '打开使用帮助',
            helpUrlMissing: '帮助链接尚未设置。请在脚本 CONFIG.helpUrls 中填写公开帮助文档地址。',
            found: '找到附件：{count}',
            selected: '已选：{count}',
            initialStatus: '等待扫描。前缀和后缀默认均不启用；勾选后生效，取消勾选即可撤销。所有名称框仍可直接修改。',
            emptyResults: '暂未发现附件',
            itemCheckTitle: '勾选此附件',
            filenameEditTitle: '可直接修改最终文件名',
            unknownContext: '未识别上下文',
            depthPage: '{depth}级网页',
            scanCurrent: '正在扫描当前页面…',
            mojibakeRetry: '检测到疑似中文乱码，正在按原始网页字节重新识别编码…',
            currentAdded: '当前页新增 {added} 个，合计 {total} 个。正在核对无扩展名/哈希附件…',
            scanCompleteUnreliable: '扫描完成：共 {total} 个附件；仍有 {machine} 个名称未可靠识别（服务器机器名或原始乱码），可直接在黄色名称框内修改。',
            scanComplete: '扫描完成：共找到 {total} 个附件。',
            scanFailed: '扫描失败：{error}',
            sniffDepthProgress: '开始嗅探：正在扫描{depth}级网页 {current}/{total}…',
            scanAlreadyRunning: '已有扫描任务正在运行，请等待完成。',
            sniffInvalidUrl: '当前网址无法进行网页嗅探。',
            sniffListProgress: '开始嗅探：正在扫描列表父页面 {current}/{total}…',
            sniffMetadata: '网页扫描完成，正在核对新附件名称…',
            sniffComplete: '嗅探完成：列表父页面 {listDone}/{listTarget} 个，二级页 {level2} 个，三级页 {level3} 个；新增 {added} 个附件，共 {total} 个{failedPart}{stopNote}。每个父页面的下一级均分别限制为最多 {limit} 页。',
            sniffFailedPart: '；{failed} 个页面请求失败或超时',
            sniffStopDuplicate: '；后续列表分页出现重复地址',
            sniffStopNoNext: '；未再识别到后续列表分页',
            sniffStopOffsite: '；后续列表分页跳转到站外地址',
            sniffStopRequestFailed: '；第 {page} 个列表父页面请求失败',
            sniffAborted: '嗅探中止：{error}。已保留 {total} 个结果。',
            selectFilteredStatus: '已仅勾选当前筛选结果 {count} 个。',
            prefixValue: '前缀“{value}”',
            prefixEmpty: '前缀（内容为空）',
            suffixValue: '后缀“{value}”',
            suffixEmpty: '后缀（内容为空）',
            listSeparator: '、',
            affixEnabled: '已启用{enabled}，已更新 {count} 个文件名；取消勾选即可撤销。',
            affixDisabled: '前缀和后缀均已关闭，已撤销由此功能添加的内容。',
            noSelected: '没有勾选附件。',
            copyRich: '已复制 {count} 条带修复文件名的 IDM 富文本链接；可在 IDM 使用“从剪贴板添加批量下载”。',
            copyPlainFallback: '已复制 {count} 条 URL + 文件名；当前页面只允许纯文本剪贴板，若 IDM 仍采用服务器名，请改用“准备IDM插件”。',
            copyPlain: '已复制 {count} 条 URL + 文件名。',
            copyFailed: '复制失败，请检查浏览器剪贴板权限。',
            idmSheetTitle: '准备交给 IDM 浏览器插件',
            close: '关闭',
            idmGuide: '已选中 {count} 条附件链接。请在下面的蓝色链接区域内<strong>右键</strong>，然后选择<strong>“使用 IDM 下载选定链接”</strong>，即可打开 IDM 原生批量筛选窗口。',
            idmReselect: '重新选中全部链接',
            idmReady: '已为 IDM 插件准备并选中 {count} 条链接；请在弹出的蓝色链接区域内右键，选择“使用 IDM 下载选定链接”。',
            exportedTxt: '已导出 {count} 个勾选附件的 TXT。',
            exportedCsv: '已导出 {count} 个勾选附件的 CSV。',
            exportedXlsx: '已导出 {count} 个勾选附件的 XLSX。',
            cleared: '结果已清空。',
            networkFailed: '网络请求失败',
            requestTimeout: '请求超时',
            menuExtract: '提取此网页附件',
            menuPrepare: '准备IDM插件批量下载',
            menuSupport: '支持作者（Ko-fi）',
            menuHelp: '使用帮助',
            menuToggle: '显示/隐藏 IDM下载助手',
            filenameHeader: '文件名',
            urlHeader: '下载地址',
            sourcePageHeader: '来源页面',
            depthHeader: '嗅探层级',
            projectHeader: '项目名称',
            sectionHeader: '栏目标题',
            basisHeader: '命名依据',
            attachmentList: '附件列表',
            exportBase: 'IDM下载助手',
            unnamedAttachment: '未命名附件',
            sourcePending: '待探测',
            sourceServer: '服务器Content-Disposition',
            sourceLinkText: '链接文字',
            sourceAttribute: '{attr}属性',
            sourceChildTitle: '子节点title',
            sourceChildFilename: '子节点data-filename',
            sourceChildName: '子节点data-name',
            sourceChildAria: '子节点aria-label',
            sourceAdjacent: '相邻文本节点',
            sourceTableRow: '表格行',
            sourcePrevious: '前置兄弟节点',
            sourceNext: '后置兄弟节点',
            sourceParent: '父容器{selector}'
        },

        'zh-TW': {
            appTitle: 'IDM下載助手',
            collapseExpand: '收合/展開',
            hideWindow: '隱藏視窗',
            theme: '主題',
            themeTitle: '選擇下載助手介面主題',
            themeAuto: '自動',
            themeDark: '深色',
            themeLight: '淺色',
            fetch: '抓取',
            listPages: '個列表頁',
            sniffDepth: '嗅探層級',
            level1: '一級',
            level2: '二級',
            level3: '三級',
            perLevelMax: '每級最多',
            childPages: '個子頁面',
            perLevelTooltip: '每個列表頁最多進入這麼多個二級頁；每個二級頁最多再進入這麼多個三級頁',
            startSniff: '開始嗅探',
            startSniffTitle: '依第一列設定掃描列表分頁及下級網頁',
            prepareIdm: '準備IDM外掛',
            prepareIdmTitle: '準備並選取連結，然後使用 IDM 外掛右鍵命令',
            copySelectedIdm: '複製所選→IDM',
            selectAll: '全選',
            selectNone: '全部取消',
            invert: '反向選取',
            filterPlaceholder: '搜尋/篩選名稱、欄目、專案名稱…',
            selectFiltered: '勾選篩選結果',
            prefix: '前綴',
            suffix: '後綴',
            prefixToggleTitle: '勾選後啟用；取消勾選會撤銷本功能加入的前綴',
            suffixToggleTitle: '勾選後啟用；取消勾選會撤銷本功能加入的後綴',
            prefixPlaceholder: '輸入前綴，可包含分隔符號',
            prefixInputTitle: '內容會原樣放在檔名前；預設僅提供頁面標題作為建議，不會自動啟用',
            suffixPlaceholder: '輸入後綴，如 _已發布',
            suffixInputTitle: '後綴會放在副檔名前，例如 檔名_已發布.pdf',
            exportTxt: '匯出TXT',
            exportCsv: '匯出CSV',
            exportExcel: '匯出Excel',
            clear: '清除',
            supportAuthor: '支持作者',
            supportAuthorTitle: '開啟作者 Ko-fi 贊賞頁面',
            help: '幫助',
            helpTitle: '開啟使用說明',
            helpUrlMissing: '尚未設定幫助連結。請在腳本 CONFIG.helpUrls 中填入公開說明文件地址。',
            found: '找到附件：{count}',
            selected: '已選：{count}',
            initialStatus: '等待掃描。前綴和後綴預設均不啟用；勾選後生效，取消勾選即可撤銷。所有名稱欄仍可直接修改。',
            emptyResults: '尚未發現附件',
            itemCheckTitle: '勾選此附件',
            filenameEditTitle: '可直接修改最終檔名',
            unknownContext: '未識別內容',
            depthPage: '{depth}級網頁',
            scanCurrent: '正在掃描目前頁面…',
            mojibakeRetry: '偵測到疑似中文亂碼，正在依原始網頁位元組重新識別編碼…',
            currentAdded: '目前頁面新增 {added} 個，共 {total} 個。正在核對無副檔名/雜湊附件…',
            scanCompleteUnreliable: '掃描完成：共 {total} 個附件；仍有 {machine} 個名稱未可靠識別（伺服器機器名稱或原始亂碼），可直接在黃色名稱欄內修改。',
            scanComplete: '掃描完成：共找到 {total} 個附件。',
            scanFailed: '掃描失敗：{error}',
            sniffDepthProgress: '開始嗅探：正在掃描{depth}級網頁 {current}/{total}…',
            scanAlreadyRunning: '已有掃描工作正在執行，請等待完成。',
            sniffInvalidUrl: '目前網址無法進行網頁嗅探。',
            sniffListProgress: '開始嗅探：正在掃描列表父頁面 {current}/{total}…',
            sniffMetadata: '網頁掃描完成，正在核對新附件名稱…',
            sniffComplete: '嗅探完成：列表父頁面 {listDone}/{listTarget} 個，二級頁 {level2} 個，三級頁 {level3} 個；新增 {added} 個附件，共 {total} 個{failedPart}{stopNote}。每個父頁面的下一級均分別限制為最多 {limit} 頁。',
            sniffFailedPart: '；{failed} 個頁面請求失敗或逾時',
            sniffStopDuplicate: '；後續列表分頁出現重複網址',
            sniffStopNoNext: '；未再識別到後續列表分頁',
            sniffStopOffsite: '；後續列表分頁跳轉到站外網址',
            sniffStopRequestFailed: '；第 {page} 個列表父頁面請求失敗',
            sniffAborted: '嗅探中止：{error}。已保留 {total} 個結果。',
            selectFilteredStatus: '已僅勾選目前篩選結果 {count} 個。',
            prefixValue: '前綴「{value}」',
            prefixEmpty: '前綴（內容為空）',
            suffixValue: '後綴「{value}」',
            suffixEmpty: '後綴（內容為空）',
            listSeparator: '、',
            affixEnabled: '已啟用{enabled}，已更新 {count} 個檔名；取消勾選即可撤銷。',
            affixDisabled: '前綴和後綴均已關閉，已撤銷由此功能加入的內容。',
            noSelected: '沒有勾選附件。',
            copyRich: '已複製 {count} 條帶修復檔名的 IDM 富文字連結；可在 IDM 使用「從剪貼簿新增批次下載」。',
            copyPlainFallback: '已複製 {count} 條 URL + 檔名；目前頁面只允許純文字剪貼簿，若 IDM 仍採用伺服器名稱，請改用「準備IDM外掛」。',
            copyPlain: '已複製 {count} 條 URL + 檔名。',
            copyFailed: '複製失敗，請檢查瀏覽器剪貼簿權限。',
            idmSheetTitle: '準備交給 IDM 瀏覽器外掛',
            close: '關閉',
            idmGuide: '已選取 {count} 條附件連結。請在下方藍色連結區域內<strong>按右鍵</strong>，然後選擇<strong>「使用 IDM 下載選定連結」</strong>，即可開啟 IDM 原生批次篩選視窗。',
            idmReselect: '重新選取全部連結',
            idmReady: '已為 IDM 外掛準備並選取 {count} 條連結；請在彈出的藍色連結區域內按右鍵，選擇「使用 IDM 下載選定連結」。',
            exportedTxt: '已匯出 {count} 個勾選附件的 TXT。',
            exportedCsv: '已匯出 {count} 個勾選附件的 CSV。',
            exportedXlsx: '已匯出 {count} 個勾選附件的 XLSX。',
            cleared: '結果已清除。',
            networkFailed: '網路請求失敗',
            requestTimeout: '請求逾時',
            menuExtract: '擷取此網頁附件',
            menuPrepare: '準備IDM外掛批次下載',
            menuSupport: '支持作者（Ko-fi）',
            menuHelp: '使用說明',
            menuToggle: '顯示/隱藏 IDM下載助手',
            filenameHeader: '檔名',
            urlHeader: '下載網址',
            sourcePageHeader: '來源頁面',
            depthHeader: '嗅探層級',
            projectHeader: '專案名稱',
            sectionHeader: '欄目標題',
            basisHeader: '命名依據',
            attachmentList: '附件列表',
            exportBase: 'IDM下載助手',
            unnamedAttachment: '未命名附件',
            sourcePending: '等待探測',
            sourceServer: '伺服器Content-Disposition',
            sourceLinkText: '連結文字',
            sourceAttribute: '{attr}屬性',
            sourceChildTitle: '子節點title',
            sourceChildFilename: '子節點data-filename',
            sourceChildName: '子節點data-name',
            sourceChildAria: '子節點aria-label',
            sourceAdjacent: '相鄰文字節點',
            sourceTableRow: '表格列',
            sourcePrevious: '前置同層節點',
            sourceNext: '後置同層節點',
            sourceParent: '父容器{selector}'
        },

        ja: {
            appTitle: 'IDM ダウンロードアシスタント',
            collapseExpand: '折りたたむ/展開',
            hideWindow: 'ウィンドウを非表示',
            theme: 'テーマ',
            themeTitle: 'ダウンロードアシスタントのテーマを選択',
            themeAuto: '自動',
            themeDark: 'ダーク',
            themeLight: 'ライト',
            fetch: '取得',
            listPages: '件のリストページ',
            sniffDepth: '探索階層',
            level1: '第1階層',
            level2: '第2階層',
            level3: '第3階層',
            perLevelMax: '各階層の上限',
            childPages: '件の子ページ',
            perLevelTooltip: '各リストページから開く第2階層ページの上限、および各第2階層ページから開く第3階層ページの上限',
            startSniff: '探索を開始',
            startSniffTitle: '上の設定に従ってリストのページ送りと下位ページを探索します',
            prepareIdm: 'IDM拡張機能を準備',
            prepareIdmTitle: 'リンクを準備して選択し、IDM拡張機能の右クリックメニューを使用します',
            copySelectedIdm: '選択項目をコピー → IDM',
            selectAll: 'すべて選択',
            selectNone: 'すべて解除',
            invert: '選択を反転',
            filterPlaceholder: 'ファイル名、セクション、プロジェクトを検索/絞り込み…',
            selectFiltered: '絞り込み結果を選択',
            prefix: '接頭辞',
            suffix: '接尾辞',
            prefixToggleTitle: 'チェックすると接頭辞を有効化し、外すとこの機能が追加した接頭辞を削除します',
            suffixToggleTitle: 'チェックすると接尾辞を有効化し、外すとこの機能が追加した接尾辞を削除します',
            prefixPlaceholder: '区切り文字を含む接頭辞を入力',
            prefixInputTitle: 'ファイル名の直前にそのまま追加されます。ページタイトルは候補として表示されるだけで、自動では有効になりません',
            suffixPlaceholder: '接尾辞を入力（例: _公開済み）',
            suffixInputTitle: '拡張子の直前に追加されます（例: ファイル名_公開済み.pdf）',
            exportTxt: 'TXTを書き出し',
            exportCsv: 'CSVを書き出し',
            exportExcel: 'Excelを書き出し',
            clear: 'クリア',
            supportAuthor: '作者を支援',
            supportAuthorTitle: '作者の Ko-fi 支援ページを開く',
            help: 'ヘルプ',
            helpTitle: '使い方を開く',
            helpUrlMissing: 'ヘルプリンクが未設定です。スクリプトの CONFIG.helpUrls に公開ドキュメントのURLを入力してください。',
            found: '添付ファイル：{count}',
            selected: '選択済み：{count}',
            initialStatus: '待機中です。接頭辞と接尾辞は既定で無効です。チェックで有効化し、チェックを外すと削除できます。各ファイル名は直接編集できます。',
            emptyResults: '添付ファイルはまだ見つかっていません',
            itemCheckTitle: 'この添付ファイルを選択',
            filenameEditTitle: '最終ファイル名を直接編集',
            unknownContext: 'コンテキストを特定できません',
            depthPage: '第{depth}階層ページ',
            scanCurrent: '現在のページをスキャンしています…',
            mojibakeRetry: '中国語の文字化けの可能性を検出しました。元のページデータから文字コードを再判定しています…',
            currentAdded: '現在のページで {added} 件追加、合計 {total} 件。拡張子なし／ハッシュ名の添付ファイルを確認しています…',
            scanCompleteUnreliable: 'スキャン完了：添付ファイル {total} 件。うち {machine} 件のファイル名は信頼できません（サーバー生成名または文字化け）。黄色のファイル名欄で直接編集できます。',
            scanComplete: 'スキャン完了：添付ファイルが {total} 件見つかりました。',
            scanFailed: 'スキャン失敗：{error}',
            sniffDepthProgress: '探索中：第{depth}階層ページ {current}/{total} をスキャンしています…',
            scanAlreadyRunning: 'スキャンはすでに実行中です。完了するまでお待ちください。',
            sniffInvalidUrl: '現在のURLはページ探索に使用できません。',
            sniffListProgress: '探索中：親リストページ {current}/{total} をスキャンしています…',
            sniffMetadata: 'ページのスキャンが完了しました。新しい添付ファイル名を確認しています…',
            sniffComplete: '探索完了：親リストページ {listDone}/{listTarget} 件、第2階層 {level2} 件、第3階層 {level3} 件。添付ファイルを {added} 件追加し、合計 {total} 件です{failedPart}{stopNote}。各親ページの次階層はそれぞれ最大 {limit} ページに制限されました。',
            sniffFailedPart: '；{failed} 件のページ要求が失敗またはタイムアウト',
            sniffStopDuplicate: '；後続のリストページでURLが重複',
            sniffStopNoNext: '；後続のリストページを検出できませんでした',
            sniffStopOffsite: '；後続のリストページが外部サイトへ移動しました',
            sniffStopRequestFailed: '；{page} 件目の親リストページを取得できませんでした',
            sniffAborted: '探索を中止しました：{error}。{total} 件の結果を保持しています。',
            selectFilteredStatus: '現在の絞り込み結果 {count} 件のみを選択しました。',
            prefixValue: '接頭辞「{value}」',
            prefixEmpty: '接頭辞（空）',
            suffixValue: '接尾辞「{value}」',
            suffixEmpty: '接尾辞（空）',
            listSeparator: '、',
            affixEnabled: '{enabled}を有効にし、{count} 件のファイル名を更新しました。チェックを外すと削除できます。',
            affixDisabled: '接頭辞と接尾辞はどちらも無効です。この機能が追加した文字列を削除しました。',
            noSelected: '添付ファイルが選択されていません。',
            copyRich: '修正済みファイル名を含む IDM リッチテキストリンクを {count} 件コピーしました。IDMで「クリップボードから一括ダウンロードを追加」を使用できます。',
            copyPlainFallback: 'URL + ファイル名を {count} 件コピーしました。このページではプレーンテキストのクリップボードのみ使用できます。IDMがサーバー名を使う場合は「IDM拡張機能を準備」を使用してください。',
            copyPlain: 'URL + ファイル名を {count} 件コピーしました。',
            copyFailed: 'コピーに失敗しました。ブラウザーのクリップボード権限を確認してください。',
            idmSheetTitle: 'IDMブラウザー拡張機能用リンクを準備',
            close: '閉じる',
            idmGuide: '{count} 件の添付リンクが選択されています。下の青いリンク領域内で<strong>右クリック</strong>し、<strong>「IDMで選択したリンクをダウンロード」</strong>を選ぶと、IDM標準の一括フィルター画面が開きます。',
            idmReselect: 'すべてのリンクを再選択',
            idmReady: 'IDM拡張機能用に {count} 件のリンクを準備して選択しました。青いリンク領域内で右クリックし、「IDMで選択したリンクをダウンロード」を選んでください。',
            exportedTxt: '選択した添付ファイル {count} 件をTXTに書き出しました。',
            exportedCsv: '選択した添付ファイル {count} 件をCSVに書き出しました。',
            exportedXlsx: '選択した添付ファイル {count} 件をXLSXに書き出しました。',
            cleared: '結果をクリアしました。',
            networkFailed: 'ネットワーク要求に失敗しました',
            requestTimeout: '要求がタイムアウトしました',
            menuExtract: 'このページから添付ファイルを抽出',
            menuPrepare: 'IDM拡張機能の一括ダウンロードを準備',
            menuSupport: '作者を支援（Ko-fi）',
            menuHelp: '使い方',
            menuToggle: 'IDM ダウンロードアシスタントを表示/非表示',
            filenameHeader: 'ファイル名',
            urlHeader: 'ダウンロードURL',
            sourcePageHeader: '取得元ページ',
            depthHeader: '探索階層',
            projectHeader: 'プロジェクト名',
            sectionHeader: 'セクション見出し',
            basisHeader: '命名元',
            attachmentList: '添付ファイル',
            exportBase: 'IDMダウンロードアシスタント',
            unnamedAttachment: '名前のない添付ファイル',
            sourcePending: 'メタデータ待ち',
            sourceServer: 'サーバー Content-Disposition',
            sourceLinkText: 'リンク文字列',
            sourceAttribute: '{attr} 属性',
            sourceChildTitle: '子要素の title',
            sourceChildFilename: '子要素の data-filename',
            sourceChildName: '子要素の data-name',
            sourceChildAria: '子要素の aria-label',
            sourceAdjacent: '隣接テキストノード',
            sourceTableRow: '表の行',
            sourcePrevious: '前の兄弟要素',
            sourceNext: '次の兄弟要素',
            sourceParent: '親コンテナー {selector}'
        },

        de: {
            appTitle: 'IDM-Download-Assistent',
            collapseExpand: 'Ein-/ausklappen',
            hideWindow: 'Fenster ausblenden',
            theme: 'Design',
            themeTitle: 'Design des Download-Assistenten auswählen',
            themeAuto: 'Automatisch',
            themeDark: 'Dunkel',
            themeLight: 'Hell',
            fetch: 'Scannen',
            listPages: 'Listenseite(n)',
            sniffDepth: 'Suchtiefe',
            level1: 'Ebene 1',
            level2: 'Ebene 2',
            level3: 'Ebene 3',
            perLevelMax: 'Maximum je Ebene',
            childPages: 'Unterseite(n)',
            perLevelTooltip: 'Maximale Anzahl von Seiten der Ebene 2 je Listenseite und Seiten der Ebene 3 je Seite der Ebene 2',
            startSniff: 'Suche starten',
            startSniffTitle: 'Listennavigation und Unterseiten mit den obigen Einstellungen scannen',
            prepareIdm: 'IDM-Erweiterung vorbereiten',
            prepareIdmTitle: 'Links vorbereiten und markieren, danach den Kontextmenübefehl der IDM-Erweiterung verwenden',
            copySelectedIdm: 'Auswahl kopieren → IDM',
            selectAll: 'Alle auswählen',
            selectNone: 'Keine auswählen',
            invert: 'Auswahl umkehren',
            filterPlaceholder: 'Dateiname, Bereich oder Projekt suchen/filtern…',
            selectFiltered: 'Gefilterte auswählen',
            prefix: 'Präfix',
            suffix: 'Suffix',
            prefixToggleTitle: 'Aktiviert das Präfix; beim Abwählen wird das von dieser Funktion hinzugefügte Präfix entfernt',
            suffixToggleTitle: 'Aktiviert das Suffix; beim Abwählen wird das von dieser Funktion hinzugefügte Suffix entfernt',
            prefixPlaceholder: 'Präfix einschließlich Trennzeichen eingeben',
            prefixInputTitle: 'Wird unverändert vor den Dateinamen gesetzt; der Seitentitel ist nur ein Vorschlag und wird nicht automatisch aktiviert',
            suffixPlaceholder: 'Suffix eingeben, z. B. _veröffentlicht',
            suffixInputTitle: 'Wird vor der Dateiendung eingefügt, z. B. dateiname_veröffentlicht.pdf',
            exportTxt: 'TXT exportieren',
            exportCsv: 'CSV exportieren',
            exportExcel: 'Excel exportieren',
            clear: 'Leeren',
            supportAuthor: 'Autor unterstützen',
            supportAuthorTitle: 'Ko-fi-Unterstützungsseite des Autors öffnen',
            help: 'Hilfe',
            helpTitle: 'Hilfe öffnen',
            helpUrlMissing: 'Der Hilfe-Link ist nicht festgelegt. Tragen Sie die öffentliche Dokumentationsadresse in CONFIG.helpUrls ein.',
            found: 'Anhänge: {count}',
            selected: 'Ausgewählt: {count}',
            initialStatus: 'Bereit. Präfix und Suffix sind standardmäßig deaktiviert. Aktivieren Sie ein Kontrollkästchen zum Anwenden und entfernen Sie es zum Rückgängigmachen. Jeder Dateiname bleibt direkt bearbeitbar.',
            emptyResults: 'Noch keine Anhänge gefunden',
            itemCheckTitle: 'Diesen Anhang auswählen',
            filenameEditTitle: 'Endgültigen Dateinamen direkt bearbeiten',
            unknownContext: 'Kontext nicht erkannt',
            depthPage: 'Seite der Ebene {depth}',
            scanCurrent: 'Aktuelle Seite wird gescannt…',
            mojibakeRetry: 'Möglicherweise fehlerhaft kodierte chinesische Zeichen erkannt. Die ursprünglichen Seitendaten werden erneut ausgewertet…',
            currentAdded: '{added} neue Einträge auf dieser Seite, insgesamt {total}. Anhänge ohne Endung oder mit Hash-Namen werden geprüft…',
            scanCompleteUnreliable: 'Scan abgeschlossen: {total} Anhänge; {machine} Dateinamen sind noch unzuverlässig (servergeneriert oder fehlerhaft kodiert). Sie können in den gelben Namensfeldern bearbeitet werden.',
            scanComplete: 'Scan abgeschlossen: {total} Anhänge gefunden.',
            scanFailed: 'Scan fehlgeschlagen: {error}',
            sniffDepthProgress: 'Suche läuft: Seiten der Ebene {depth} werden gescannt ({current}/{total})…',
            scanAlreadyRunning: 'Ein Scan wird bereits ausgeführt. Bitte warten Sie auf den Abschluss.',
            sniffInvalidUrl: 'Die aktuelle URL kann nicht durchsucht werden.',
            sniffListProgress: 'Suche läuft: übergeordnete Listenseite {current}/{total} wird gescannt…',
            sniffMetadata: 'Seitenscan abgeschlossen. Neue Anhangsnamen werden geprüft…',
            sniffComplete: 'Suche abgeschlossen: {listDone}/{listTarget} übergeordnete Listenseiten, {level2} Seiten der Ebene 2 und {level3} Seiten der Ebene 3; {added} neue Anhänge, insgesamt {total}{failedPart}{stopNote}. Pro übergeordneter Seite und Ebene wurden höchstens {limit} Unterseiten verarbeitet.',
            sniffFailedPart: '; {failed} Seitenanfragen sind fehlgeschlagen oder abgelaufen',
            sniffStopDuplicate: '; die nachfolgende Listennavigation wiederholte eine URL',
            sniffStopNoNext: '; keine weitere Listenseite erkannt',
            sniffStopOffsite: '; die nachfolgende Listennavigation führte zu einer externen Website',
            sniffStopRequestFailed: '; übergeordnete Listenseite {page} konnte nicht geladen werden',
            sniffAborted: 'Suche abgebrochen: {error}. {total} Ergebnisse wurden beibehalten.',
            selectFilteredStatus: 'Nur die {count} aktuell gefilterten Ergebnisse wurden ausgewählt.',
            prefixValue: 'Präfix „{value}“',
            prefixEmpty: 'Präfix (leer)',
            suffixValue: 'Suffix „{value}“',
            suffixEmpty: 'Suffix (leer)',
            listSeparator: ', ',
            affixEnabled: '{enabled} aktiviert; {count} Dateinamen aktualisiert. Zum Entfernen die Option abwählen.',
            affixDisabled: 'Präfix und Suffix sind deaktiviert. Von dieser Funktion hinzugefügte Inhalte wurden entfernt.',
            noSelected: 'Keine Anhänge ausgewählt.',
            copyRich: '{count} IDM-Rich-Text-Links mit korrigierten Dateinamen wurden kopiert. Verwenden Sie in IDM „Stapel-Download aus Zwischenablage hinzufügen“.',
            copyPlainFallback: '{count} Paare aus URL und Dateiname wurden kopiert. Diese Seite erlaubt nur Text in der Zwischenablage. Falls IDM weiterhin Servernamen nutzt, verwenden Sie „IDM-Erweiterung vorbereiten“.',
            copyPlain: '{count} Paare aus URL und Dateiname wurden kopiert.',
            copyFailed: 'Kopieren fehlgeschlagen. Prüfen Sie die Zwischenablageberechtigung des Browsers.',
            idmSheetTitle: 'Links für die IDM-Browsererweiterung vorbereiten',
            close: 'Schließen',
            idmGuide: '{count} Anhangslinks sind ausgewählt. Klicken Sie im blauen Linkbereich unten mit der <strong>rechten Maustaste</strong> und wählen Sie <strong>„Ausgewählte Links mit IDM herunterladen“</strong>, um das native IDM-Stapelfilterfenster zu öffnen.',
            idmReselect: 'Alle Links erneut auswählen',
            idmReady: '{count} Links wurden für die IDM-Erweiterung vorbereitet und ausgewählt. Klicken Sie im blauen Linkbereich mit der rechten Maustaste und wählen Sie „Ausgewählte Links mit IDM herunterladen“.',
            exportedTxt: '{count} ausgewählte Anhänge wurden als TXT exportiert.',
            exportedCsv: '{count} ausgewählte Anhänge wurden als CSV exportiert.',
            exportedXlsx: '{count} ausgewählte Anhänge wurden als XLSX exportiert.',
            cleared: 'Ergebnisse geleert.',
            networkFailed: 'Netzwerkanfrage fehlgeschlagen',
            requestTimeout: 'Zeitüberschreitung der Anfrage',
            menuExtract: 'Anhänge aus dieser Seite extrahieren',
            menuPrepare: 'IDM-Erweiterung für Stapel-Download vorbereiten',
            menuSupport: 'Autor unterstützen (Ko-fi)',
            menuHelp: 'Hilfe',
            menuToggle: 'IDM-Download-Assistent ein-/ausblenden',
            filenameHeader: 'Dateiname',
            urlHeader: 'Download-URL',
            sourcePageHeader: 'Quellseite',
            depthHeader: 'Suchtiefe',
            projectHeader: 'Projektname',
            sectionHeader: 'Bereichsüberschrift',
            basisHeader: 'Quelle des Namens',
            attachmentList: 'Anhänge',
            exportBase: 'IDM-Download-Assistent',
            unnamedAttachment: 'Unbenannter Anhang',
            sourcePending: 'Metadaten ausstehend',
            sourceServer: 'Server Content-Disposition',
            sourceLinkText: 'Linktext',
            sourceAttribute: 'Attribut {attr}',
            sourceChildTitle: 'Untergeordnetes title',
            sourceChildFilename: 'Untergeordnetes data-filename',
            sourceChildName: 'Untergeordnetes data-name',
            sourceChildAria: 'Untergeordnetes aria-label',
            sourceAdjacent: 'Benachbarter Textknoten',
            sourceTableRow: 'Tabellenzeile',
            sourcePrevious: 'Vorheriges Geschwisterelement',
            sourceNext: 'Nächstes Geschwisterelement',
            sourceParent: 'Übergeordneter Container {selector}'
        },

        ru: {
            appTitle: 'Помощник загрузки IDM',
            collapseExpand: 'Свернуть/развернуть',
            hideWindow: 'Скрыть окно',
            theme: 'Тема',
            themeTitle: 'Выбрать тему помощника загрузки',
            themeAuto: 'Авто',
            themeDark: 'Тёмная',
            themeLight: 'Светлая',
            fetch: 'Сканировать',
            listPages: 'стр. списка',
            sniffDepth: 'Глубина поиска',
            level1: 'Уровень 1',
            level2: 'Уровень 2',
            level3: 'Уровень 3',
            perLevelMax: 'Макс. на уровень',
            childPages: 'дочерних стр.',
            perLevelTooltip: 'Максимум страниц уровня 2 для каждой страницы списка и страниц уровня 3 для каждой страницы уровня 2',
            startSniff: 'Начать поиск',
            startSniffTitle: 'Сканировать пагинацию списка и вложенные страницы с указанными выше параметрами',
            prepareIdm: 'Подготовить расширение IDM',
            prepareIdmTitle: 'Подготовить и выделить ссылки, затем использовать команду контекстного меню расширения IDM',
            copySelectedIdm: 'Копировать выбранное → IDM',
            selectAll: 'Выбрать все',
            selectNone: 'Снять выбор',
            invert: 'Инвертировать',
            filterPlaceholder: 'Поиск/фильтр по имени, разделу, проекту…',
            selectFiltered: 'Выбрать отфильтрованное',
            prefix: 'Префикс',
            suffix: 'Суффикс',
            prefixToggleTitle: 'Включает префикс; снимите флажок, чтобы удалить префикс, добавленный этой функцией',
            suffixToggleTitle: 'Включает суффикс; снимите флажок, чтобы удалить суффикс, добавленный этой функцией',
            prefixPlaceholder: 'Введите префикс, включая разделитель',
            prefixInputTitle: 'Добавляется без изменений перед именем файла; заголовок страницы предлагается как вариант, но не включается автоматически',
            suffixPlaceholder: 'Введите суффикс, например _опубликовано',
            suffixInputTitle: 'Вставляется перед расширением, например имя_опубликовано.pdf',
            exportTxt: 'Экспорт TXT',
            exportCsv: 'Экспорт CSV',
            exportExcel: 'Экспорт Excel',
            clear: 'Очистить',
            supportAuthor: 'Поддержать автора',
            supportAuthorTitle: 'Открыть страницу автора на Ko-fi',
            help: 'Справка',
            helpTitle: 'Открыть справку',
            helpUrlMissing: 'Ссылка на справку не задана. Укажите публичный адрес документации в CONFIG.helpUrls.',
            found: 'Вложений: {count}',
            selected: 'Выбрано: {count}',
            initialStatus: 'Готово. Префикс и суффикс по умолчанию отключены; установите флажок для применения и снимите для удаления. Любое имя файла можно редактировать напрямую.',
            emptyResults: 'Вложения пока не найдены',
            itemCheckTitle: 'Выбрать это вложение',
            filenameEditTitle: 'Изменить итоговое имя файла',
            unknownContext: 'Контекст не определён',
            depthPage: 'Страница уровня {depth}',
            scanCurrent: 'Сканируется текущая страница…',
            mojibakeRetry: 'Обнаружена возможная ошибка кодировки китайского текста. Кодировка повторно определяется по исходным данным страницы…',
            currentAdded: 'На текущей странице добавлено: {added}, всего: {total}. Проверяются вложения без расширения и с хеш-именами…',
            scanCompleteUnreliable: 'Сканирование завершено: вложений {total}; для {machine} имён нет надёжного результата (серверные имена или ошибка кодировки). Их можно изменить в жёлтых полях.',
            scanComplete: 'Сканирование завершено: найдено вложений {total}.',
            scanFailed: 'Ошибка сканирования: {error}',
            sniffDepthProgress: 'Поиск: сканируются страницы уровня {depth}, {current}/{total}…',
            scanAlreadyRunning: 'Сканирование уже выполняется. Дождитесь завершения.',
            sniffInvalidUrl: 'Текущий URL нельзя использовать для поиска страниц.',
            sniffListProgress: 'Поиск: сканируется родительская страница списка {current}/{total}…',
            sniffMetadata: 'Сканирование страниц завершено. Проверяются имена новых вложений…',
            sniffComplete: 'Поиск завершён: родительских страниц списка {listDone}/{listTarget}, страниц уровня 2 — {level2}, уровня 3 — {level3}; новых вложений {added}, всего {total}{failedPart}{stopNote}. Для каждой родительской страницы обработано не более {limit} дочерних страниц на уровень.',
            sniffFailedPart: '; запросов страниц с ошибкой или тайм-аутом: {failed}',
            sniffStopDuplicate: '; в последующей пагинации списка повторился URL',
            sniffStopNoNext: '; следующая страница списка не обнаружена',
            sniffStopOffsite: '; последующая пагинация списка перешла на внешний сайт',
            sniffStopRequestFailed: '; не удалось загрузить родительскую страницу списка {page}',
            sniffAborted: 'Поиск остановлен: {error}. Сохранено результатов: {total}.',
            selectFilteredStatus: 'Выбраны только текущие отфильтрованные результаты: {count}.',
            prefixValue: 'префикс «{value}»',
            prefixEmpty: 'префикс (пусто)',
            suffixValue: 'суффикс «{value}»',
            suffixEmpty: 'суффикс (пусто)',
            listSeparator: ', ',
            affixEnabled: 'Включено: {enabled}; обновлено имён файлов: {count}. Снимите флажок для удаления.',
            affixDisabled: 'Префикс и суффикс отключены. Добавленный этой функцией текст удалён.',
            noSelected: 'Вложения не выбраны.',
            copyRich: 'Скопировано форматированных ссылок IDM с исправленными именами: {count}. В IDM используйте «Добавить пакетную загрузку из буфера обмена».',
            copyPlainFallback: 'Скопировано пар URL + имя файла: {count}. Эта страница разрешает только обычный текст в буфере обмена; если IDM использует серверные имена, выберите «Подготовить расширение IDM».',
            copyPlain: 'Скопировано пар URL + имя файла: {count}.',
            copyFailed: 'Не удалось скопировать. Проверьте разрешение браузера на доступ к буферу обмена.',
            idmSheetTitle: 'Подготовка ссылок для расширения IDM',
            close: 'Закрыть',
            idmGuide: 'Выбрано ссылок на вложения: {count}. Щёлкните <strong>правой кнопкой мыши</strong> в синей области ссылок ниже и выберите <strong>«Скачать выбранные ссылки с помощью IDM»</strong>, чтобы открыть штатное окно пакетного фильтра IDM.',
            idmReselect: 'Повторно выбрать все ссылки',
            idmReady: 'Для расширения IDM подготовлено и выбрано ссылок: {count}. Щёлкните правой кнопкой в синей области ссылок и выберите «Скачать выбранные ссылки с помощью IDM».',
            exportedTxt: 'Выбранные вложения экспортированы в TXT: {count}.',
            exportedCsv: 'Выбранные вложения экспортированы в CSV: {count}.',
            exportedXlsx: 'Выбранные вложения экспортированы в XLSX: {count}.',
            cleared: 'Результаты очищены.',
            networkFailed: 'Ошибка сетевого запроса',
            requestTimeout: 'Истекло время ожидания запроса',
            menuExtract: 'Извлечь вложения с этой страницы',
            menuPrepare: 'Подготовить пакетную загрузку расширением IDM',
            menuSupport: 'Поддержать автора (Ko-fi)',
            menuHelp: 'Справка',
            menuToggle: 'Показать/скрыть помощник загрузки IDM',
            filenameHeader: 'Имя файла',
            urlHeader: 'URL загрузки',
            sourcePageHeader: 'Исходная страница',
            depthHeader: 'Глубина поиска',
            projectHeader: 'Название проекта',
            sectionHeader: 'Заголовок раздела',
            basisHeader: 'Источник имени',
            attachmentList: 'Вложения',
            exportBase: 'Помощник_загрузки_IDM',
            unnamedAttachment: 'Безымянное вложение',
            sourcePending: 'Ожидание метаданных',
            sourceServer: 'Серверный Content-Disposition',
            sourceLinkText: 'Текст ссылки',
            sourceAttribute: 'Атрибут {attr}',
            sourceChildTitle: 'Дочерний title',
            sourceChildFilename: 'Дочерний data-filename',
            sourceChildName: 'Дочерний data-name',
            sourceChildAria: 'Дочерний aria-label',
            sourceAdjacent: 'Соседний текстовый узел',
            sourceTableRow: 'Строка таблицы',
            sourcePrevious: 'Предыдущий соседний элемент',
            sourceNext: 'Следующий соседний элемент',
            sourceParent: 'Родительский контейнер {selector}'
        },

        en: {
            appTitle: 'IDM Download Assistant',
            collapseExpand: 'Collapse/expand',
            hideWindow: 'Hide window',
            theme: 'Theme',
            themeTitle: 'Choose the download assistant theme',
            themeAuto: 'Auto',
            themeDark: 'Dark',
            themeLight: 'Light',
            fetch: 'Scan',
            listPages: 'list page(s)',
            sniffDepth: 'Sniff depth',
            level1: 'Level 1',
            level2: 'Level 2',
            level3: 'Level 3',
            perLevelMax: 'Per-level max',
            childPages: 'child page(s)',
            perLevelTooltip: 'Maximum level-2 pages opened from each list page, and maximum level-3 pages opened from each level-2 page',
            startSniff: 'Start sniffing',
            startSniffTitle: 'Scan list pagination and lower-level pages using the settings above',
            prepareIdm: 'Prepare IDM extension',
            prepareIdmTitle: 'Prepare and select links, then use the IDM extension context-menu command',
            copySelectedIdm: 'Copy selected → IDM',
            selectAll: 'Select all',
            selectNone: 'Select none',
            invert: 'Invert',
            filterPlaceholder: 'Search/filter filename, section, project…',
            selectFiltered: 'Select filtered',
            prefix: 'Prefix',
            suffix: 'Suffix',
            prefixToggleTitle: 'Enable the prefix when checked; uncheck to remove the prefix added by this feature',
            suffixToggleTitle: 'Enable the suffix when checked; uncheck to remove the suffix added by this feature',
            prefixPlaceholder: 'Enter a prefix, including any separator',
            prefixInputTitle: 'Added exactly before the filename; the page title is only a suggestion and is not enabled automatically',
            suffixPlaceholder: 'Enter a suffix, e.g. _published',
            suffixInputTitle: 'Inserted before the extension, for example filename_published.pdf',
            exportTxt: 'Export TXT',
            exportCsv: 'Export CSV',
            exportExcel: 'Export Excel',
            clear: 'Clear',
            supportAuthor: 'Support author',
            supportAuthorTitle: "Open the author's Ko-fi support page",
            help: 'Help',
            helpTitle: 'Open help',
            helpUrlMissing: 'The help link is not configured. Set CONFIG.helpUrls to public documentation URLs.',
            found: 'Attachments: {count}',
            selected: 'Selected: {count}',
            initialStatus: 'Ready. Prefix and suffix are disabled by default; check to enable and uncheck to remove them. Every filename remains directly editable.',
            emptyResults: 'No attachments found yet',
            itemCheckTitle: 'Select this attachment',
            filenameEditTitle: 'Edit the final filename directly',
            unknownContext: 'Context not identified',
            depthPage: 'Level-{depth} page',
            scanCurrent: 'Scanning the current page…',
            mojibakeRetry: 'Possible Chinese mojibake detected. Re-reading the original page bytes to identify the encoding…',
            currentAdded: '{added} new item(s) on this page, {total} total. Checking extensionless and hash-named attachments…',
            scanCompleteUnreliable: 'Scan complete: {total} attachment(s); {machine} filename(s) remain unreliable (server-generated or mojibake). You can edit them in the yellow filename fields.',
            scanComplete: 'Scan complete: {total} attachment(s) found.',
            scanFailed: 'Scan failed: {error}',
            sniffDepthProgress: 'Sniffing: scanning level-{depth} pages {current}/{total}…',
            scanAlreadyRunning: 'A scan is already running. Please wait for it to finish.',
            sniffInvalidUrl: 'The current URL cannot be sniffed.',
            sniffListProgress: 'Sniffing: scanning parent list page {current}/{total}…',
            sniffMetadata: 'Page scan complete. Checking new attachment filenames…',
            sniffComplete: 'Sniffing complete: {listDone}/{listTarget} parent list page(s), {level2} level-2 page(s), and {level3} level-3 page(s); {added} new attachment(s), {total} total{failedPart}{stopNote}. Each parent page was limited to {limit} child page(s) per level.',
            sniffFailedPart: '; {failed} page request(s) failed or timed out',
            sniffStopDuplicate: '; subsequent list pagination repeated a URL',
            sniffStopNoNext: '; no subsequent list page was detected',
            sniffStopOffsite: '; subsequent list pagination led off-site',
            sniffStopRequestFailed: '; parent list page {page} could not be loaded',
            sniffAborted: 'Sniffing stopped: {error}. {total} result(s) were kept.',
            selectFilteredStatus: 'Selected only the {count} currently filtered result(s).',
            prefixValue: 'prefix “{value}”',
            prefixEmpty: 'prefix (empty)',
            suffixValue: 'suffix “{value}”',
            suffixEmpty: 'suffix (empty)',
            listSeparator: ', ',
            affixEnabled: 'Enabled {enabled}; updated {count} filename(s). Uncheck an option to remove it.',
            affixDisabled: 'Prefix and suffix are both off. Content added by this feature has been removed.',
            noSelected: 'No attachments are selected.',
            copyRich: 'Copied {count} IDM rich-text link(s) with corrected filenames. In IDM, use “Add batch download from clipboard”.',
            copyPlainFallback: 'Copied {count} URL + filename pair(s). This page only permits plain-text clipboard access; if IDM still uses server filenames, use “Prepare IDM extension”.',
            copyPlain: 'Copied {count} URL + filename pair(s).',
            copyFailed: 'Copy failed. Check the browser clipboard permission.',
            idmSheetTitle: 'Prepare links for the IDM browser extension',
            close: 'Close',
            idmGuide: '{count} attachment link(s) are selected. <strong>Right-click</strong> inside the blue link area below, then choose <strong>“Download selected links with IDM”</strong> to open the native IDM batch-filter window.',
            idmReselect: 'Reselect all links',
            idmReady: 'Prepared and selected {count} link(s) for the IDM extension. Right-click inside the blue link area and choose “Download selected links with IDM”.',
            exportedTxt: 'Exported {count} selected attachment(s) to TXT.',
            exportedCsv: 'Exported {count} selected attachment(s) to CSV.',
            exportedXlsx: 'Exported {count} selected attachment(s) to XLSX.',
            cleared: 'Results cleared.',
            networkFailed: 'Network request failed',
            requestTimeout: 'Request timed out',
            menuExtract: 'Extract attachments from this page',
            menuPrepare: 'Prepare IDM extension batch download',
            menuSupport: 'Support author (Ko-fi)',
            menuHelp: 'Help',
            menuToggle: 'Show/hide IDM Download Assistant',
            filenameHeader: 'Filename',
            urlHeader: 'Download URL',
            sourcePageHeader: 'Source page',
            depthHeader: 'Sniff depth',
            projectHeader: 'Project name',
            sectionHeader: 'Section title',
            basisHeader: 'Naming source',
            attachmentList: 'Attachments',
            exportBase: 'IDM_Download_Assistant',
            unnamedAttachment: 'Unnamed attachment',
            sourcePending: 'Pending metadata',
            sourceServer: 'Server Content-Disposition',
            sourceLinkText: 'Link text',
            sourceAttribute: '{attr} attribute',
            sourceChildTitle: 'Child title',
            sourceChildFilename: 'Child data-filename',
            sourceChildName: 'Child data-name',
            sourceChildAria: 'Child aria-label',
            sourceAdjacent: 'Adjacent text node',
            sourceTableRow: 'Table row',
            sourcePrevious: 'Previous sibling',
            sourceNext: 'Next sibling',
            sourceParent: 'Parent container {selector}'
        }
    };


    function t(
        key,
        values = {}
    ) {

        const bundle =
            I18N[UI_LANGUAGE] ||
            I18N.en;


        const template =
            bundle[key] ??
            I18N.en[key] ??
            I18N['zh-CN'][key] ??
            key;


        return String(template)
            .replace(
                /\{(\w+)\}/g,
                (
                    _,
                    name
                ) =>
                    Object.prototype
                        .hasOwnProperty.call(
                            values,
                            name
                        )
                        ? String(
                            values[name]
                        )
                        : ''
            );
    }


    function localizeNameSource(source) {

        const value =
            String(source || '');


        const exactKeys = {
            '待探测':
                'sourcePending',
            '服务器Content-Disposition':
                'sourceServer',
            '链接文字':
                'sourceLinkText',
            '子节点title':
                'sourceChildTitle',
            '子节点data-filename':
                'sourceChildFilename',
            '子节点data-name':
                'sourceChildName',
            '子节点aria-label':
                'sourceChildAria',
            '相邻文本节点':
                'sourceAdjacent',
            '表格行':
                'sourceTableRow',
            '前置兄弟节点':
                'sourcePrevious',
            '后置兄弟节点':
                'sourceNext'
        };


        if (
            exactKeys[value]
        ) {

            return t(
                exactKeys[value]
            );
        }


        const attributeMatch =
            value.match(
                /^(.+)属性$/
            );


        if (attributeMatch) {

            return t(
                'sourceAttribute',
                {
                    attr:
                        attributeMatch[1]
                }
            );
        }


        const parentMatch =
            value.match(
                /^父容器(.+)$/
            );


        if (parentMatch) {

            return t(
                'sourceParent',
                {
                    selector:
                        parentMatch[1]
                }
            );
        }


        return value;
    }


    /**********************************************************************
     * 1. 通用工具
     **********************************************************************/

    function normalizeSpace(text) {

        return String(text || '')

            .replace(
                /[\u00A0\t\r\n]+/g,
                ' '
            )

            .replace(
                /\s{2,}/g,
                ' '
            )

            .trim();
    }


    function isMojibake(text) {

        const s =
            String(text || '');


        if (!s) {

            return false;
        }


        return (
            /\uFFFD/.test(s) ||
            /(?:锟斤拷|烫烫烫|鏂囦欢|涓嬭浇|闄勪欢|绔欑偣|馃)/.test(s) ||
            /(?:Ã.|Â.|â[€™œ“”]|ðŸ)/.test(s) ||
            /[\u00C0-\u00FF]{3,}/.test(s)
        );
    }


    function textQualityScore(text) {

        const s =
            String(text || '');


        const replacementCount =
            (
                s.match(
                    /\uFFFD/g
                ) ||
                []
            ).length;


        const controlCount =
            (
                s.match(
                    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
                ) ||
                []
            ).length;


        const chineseCount =
            (
                s.match(
                    /[\u3400-\u9fff]/g
                ) ||
                []
            ).length;


        return (
            chineseCount *
            5 -
            replacementCount *
            500 -
            controlCount *
            100 -
            (
                isMojibake(s)
                    ? 150
                    : 0
            ) -
            (
                (
                    s.match(
                        /%[0-9a-f]{2}/ig
                    ) ||
                    []
                ).length *
                3
            )
        );
    }


    function normalizeCharset(charset) {

        const value =
            String(charset || '')
                .trim()
                .toLowerCase()
                .replace(
                    /^['"]|['"]$/g,
                    ''
                );


        if (
            /^(?:gbk|gb2312|gb_2312|x-gbk|cp936|ms936|gb18030)$/.test(
                value
            )
        ) {

            return 'gb18030';
        }


        if (
            /^(?:utf8|utf-8)$/.test(
                value
            )
        ) {

            return 'utf-8';
        }


        return value;
    }


    function percentEncodedToBytes(value) {

        const source =
            String(value || '');


        const bytes =
            [];


        for (
            let i = 0;
            i < source.length;
            i++
        ) {

            if (
                source[i] === '%' &&
                /^[0-9a-f]{2}$/i.test(
                    source.slice(
                        i + 1,
                        i + 3
                    )
                )
            ) {

                bytes.push(
                    parseInt(
                        source.slice(
                            i + 1,
                            i + 3
                        ),
                        16
                    )
                );


                i +=
                    2;

                continue;
            }


            const encoded =
                new TextEncoder()
                    .encode(
                        source[i]
                    );


            bytes.push(
                ...encoded
            );
        }


        return new Uint8Array(
            bytes
        );
    }


    function decodeBytes(
        bytes,
        charset,
        fatal = false
    ) {

        try {

            return new TextDecoder(
                normalizeCharset(charset),
                {
                    fatal
                }
            )
                .decode(bytes);

        } catch (_) {

            return '';
        }
    }


    function repairByteMojibake(text) {

        const source =
            String(text || '');


        const chars =
            [...source];


        const highByteCount =
            chars
                .filter(
                    ch => {

                        const code =
                            ch.codePointAt(0);


                        return code >= 0x80 &&
                            code <= 0xff;
                    }
                )
                .length;


        if (
            highByteCount < 2 ||
            !/[\u0080-\u00ff]{2,}/i.test(
                source
            ) ||
            chars.some(
                ch =>
                    ch.codePointAt(0) >
                    0xff
            )
        ) {

            return source;
        }


        const bytes =
            new Uint8Array(
                chars.map(
                    ch =>
                        ch.codePointAt(0)
                )
            );


        const candidates = [

            source,

            decodeBytes(
                bytes,
                'utf-8',
                true
            ),

            decodeBytes(
                bytes,
                'gb18030'
            )
        ]
            .filter(Boolean);


        return candidates
            .sort(
                (
                    a,
                    b
                ) =>
                    textQualityScore(b) -
                    textQualityScore(a)
            )[0] ||
            source;
    }


    function decodeUrlComponentSmart(
        value,
        declaredCharset = ''
    ) {

        const source =
            String(value || '');


        if (
            !/%[0-9a-f]{2}/i.test(
                source
            )
        ) {

            return repairByteMojibake(
                source
            );
        }


        const bytes =
            percentEncodedToBytes(
                source
            );


        const charset =
            normalizeCharset(
                declaredCharset
            );


        if (
            charset &&
            charset !== 'utf-8'
        ) {

            const declared =
                decodeBytes(
                    bytes,
                    charset
                );


            if (declared) {

                return repairByteMojibake(
                    declared
                );
            }
        }


        try {

            return repairByteMojibake(
                decodeURIComponent(
                    source
                )
            );

        } catch (_) {}


        return repairByteMojibake(
            decodeBytes(
                bytes,
                charset ||
                'gb18030'
            ) ||
            source
        );
    }


    function safeDecode(value) {

        let s =
            String(value || '');


        for (
            let i = 0;
            i < 2;
            i++
        ) {

            const decoded =
                decodeUrlComponentSmart(
                    s
                );


            if (
                decoded === s
            ) {

                break;
            }


            s =
                decoded;
        }


        return repairByteMojibake(
            s
        );
    }


    function escapeHtml(text) {

        return String(text || '')

            .replace(
                /&/g,
                '&amp;'
            )

            .replace(
                /</g,
                '&lt;'
            )

            .replace(
                />/g,
                '&gt;'
            )

            .replace(
                /"/g,
                '&quot;'
            )

            .replace(
                /'/g,
                '&#039;'
            );
    }


    function normalizeUrl(
        url,
        baseUrl
    ) {

        try {

            const u =
                new URL(
                    url,
                    baseUrl ||
                    location.href
                );


            if (
                !/^https?:$/i.test(
                    u.protocol
                )
            ) {

                return '';
            }


            u.hash =
                '';


            return u.href;

        } catch (_) {

            return '';
        }
    }


    function getExtension(text) {

        const s =
            safeDecode(
                String(text || '')
            )
                .split('#')[0]
                .split('?')[0];


        const m =
            s.match(
                new RegExp(
                    `\\.(${EXT_GROUP})$`,
                    'i'
                )
            );


        return m
            ? m[1].toLowerCase()
            : '';
    }


    function stripExtension(name) {

        return String(name || '')
            .replace(
                new RegExp(
                    `\\.(${EXT_GROUP})$`,
                    'i'
                ),
                ''
            );
    }


    function sanitizeWindowsFilename(name) {

        let s =
            normalizeSpace(name);


        const replacements = {

            '\\':
                '＼',

            '/':
                '／',

            ':':
                '：',

            '*':
                '＊',

            '?':
                '？',

            '"':
                '＂',

            '<':
                '＜',

            '>':
                '＞',

            '|':
                '｜'
        };


        s =
            s.replace(
                /[\\/:*?"<>|]/g,
                ch =>
                    replacements[ch] ||
                    '_'
            );


        s =
            s.replace(
                /[\u0000-\u001F]/g,
                ''
            );


        s =
            s.replace(
                /[. ]+$/g,
                ''
            )
                .replace(
                    /^[. ]+/g,
                    ''
                );


        if (!s) {

            s =
                t(
                    'unnamedAttachment'
                );
        }


        if (
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(
                s
            )
        ) {

            s =
                '_' + s;
        }


        const maxLen =
            190;


        if (
            s.length >
            maxLen
        ) {

            const ext =
                getExtension(s);


            if (ext) {

                const suffix =
                    '.' + ext;


                s =
                    stripExtension(s)
                        .slice(
                            0,
                            maxLen -
                            suffix.length
                        ) +
                    suffix;

            } else {

                s =
                    s.slice(
                        0,
                        maxLen
                    );
            }
        }


        return s;
    }


    function ensureExtension(
        filename,
        ext
    ) {

        const name =
            sanitizeWindowsFilename(
                filename ||
                t(
                    'unnamedAttachment'
                )
            );


        if (
            getExtension(name)
        ) {

            return name;
        }


        return ext

            ? sanitizeWindowsFilename(
                `${name}.${String(ext).toLowerCase()}`
            )

            : name;
    }


    function isInvalidText(text) {

        const t =
            normalizeSpace(text)
                .toLowerCase()
                .replace(
                    /[：:。.!！?？\s]/g,
                    ''
                );


        if (!t) {

            return true;
        }


        // 附件1、附件2、文件1等也属于无意义名称。
        if (
            /^(?:附件|文件)\d*[：:]?$/.test(
                t
            )
        ) {

            return true;
        }


        return CONFIG.invalidTexts
            .some(
                x =>
                    t ===
                    x.toLowerCase()
                        .replace(
                            /[：:。.!！?？\s]/g,
                            ''
                        )
            );
    }


    function isNavigationText(text) {

        const t =
            normalizeSpace(text)
                .toLowerCase()
                .replace(
                    /[>»›→\s]/g,
                    ''
                );


        return CONFIG.navigationTexts
            .some(
                x =>
                    t ===
                    x.toLowerCase()
                        .replace(
                            /[>»›→\s]/g,
                            ''
                        )
            );
    }


    function isBlockedResource(url) {

        return BLOCKED_EXT_RE
            .test(
                (url || '')
                    .split('#')[0]
            );
    }


    function looksLikeSupportedFile(text) {

        return FILE_EXT_RE
            .test(
                safeDecode(
                    text ||
                    ''
                )
            );
    }


    /**********************************************************************
     * 判断服务器机器文件名 / 哈希文件名
     *
     * 例如：
     *
     * 0f4a63d673944bf1b43a33f78f6ceb3d.pdf
     * 4927dda724274553a4e08c450a7b085b.pdf
     *
     * 这种名称即使有 PDF 扩展名，也不能视为有效附件名称。
     **********************************************************************/

    function isMachineFilename(filename) {

        const safe =
            sanitizeWindowsFilename(
                filename ||
                ''
            );


        const base =
            stripExtension(safe)

                .replace(
                    /^附件\s*\d*\s*[：:_-]?\s*/i,
                    ''
                )

                .trim();


        if (
            isMojibake(
                safe
            )
        ) {

            return true;
        }


        if (!base) {

            return true;
        }


        if (
            [
                '未命名附件',
                'Unnamed attachment',
                '名前のない添付ファイル',
                'Unbenannter Anhang',
                'Безымянное вложение'
            ]
                .some(
                    name =>
                        base
                            .toLowerCase()
                            .startsWith(
                                name.toLowerCase()
                            )
                )
        ) {

            return true;
        }


        // MD5 / 哈希。
        if (
            /^[a-f0-9]{24,64}$/i.test(
                base
            )
        ) {

            return true;
        }


        // UUID。
        if (
            /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5a-f0-9][a-f0-9]{3}-[89ab0-9a-f][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
                base
            )
        ) {

            return true;
        }


        // 长纯数字。
        if (
            /^\d{12,22}$/.test(
                base
            )
        ) {

            return true;
        }


        // 长随机英文数字串。
        if (
            !CHINESE_RE.test(base) &&
            base.length >= 28 &&
            /^[A-Za-z0-9_-]+$/.test(
                base
            )
        ) {

            const letters =
                (
                    base.match(
                        /[A-Za-z]/g
                    ) ||
                    []
                ).length;


            const digits =
                (
                    base.match(
                        /\d/g
                    ) ||
                    []
                ).length;


            if (
                letters > 4 &&
                digits > 4
            ) {

                return true;
            }
        }


        return false;
    }


    function extensionFromUrlOrText(
        url,
        text
    ) {

        for (
            const source
            of [text, url]
        ) {

            const m =
                safeDecode(
                    source ||
                    ''
                )
                    .match(
                        FILE_EXT_RE
                    );


            if (m) {

                return m[1]
                    .toLowerCase();
            }
        }


        return '';
    }


    function rawSearchParam(
        urlObject,
        wantedKey
    ) {

        const query =
            String(
                urlObject.search ||
                ''
            )
                .replace(
                    /^\?/,
                    ''
                );


        for (
            const part
            of query.split('&')
        ) {

            const separator =
                part.indexOf('=');


            const rawKey =
                separator >= 0
                    ? part.slice(
                        0,
                        separator
                    )
                    : part;


            const key =
                safeDecode(
                    rawKey.replace(
                        /\+/g,
                        ' '
                    )
                );


            if (
                key.toLowerCase() !==
                String(wantedKey)
                    .toLowerCase()
            ) {

                continue;
            }


            return separator >= 0
                ? part.slice(
                    separator + 1
                )
                : '';
        }


        return '';
    }


    function filenameFromUrl(url) {

        try {

            const u =
                new URL(
                    url,
                    location.href
                );


            const keys = [

                'filename',

                'fileName',

                'name',

                'downloadName',

                'attname',

                'file',

                'title'
            ];


            for (
                const key
                of keys
            ) {

                const rawValue =
                    rawSearchParam(
                        u,
                        key
                    );


                const value =
                    rawValue
                        ? decodeUrlComponentSmart(
                            rawValue.replace(
                                /\+/g,
                                ' '
                            )
                        )
                        : u.searchParams
                            .get(key);


                if (!value) {

                    continue;
                }


                const decoded =
                    safeDecode(value)

                        .split('/')
                        .pop()

                        .split('\\')
                        .pop();


                if (
                    decoded &&
                    decoded.length <= 240
                ) {

                    return sanitizeWindowsFilename(
                        decoded
                    );
                }
            }


            const last =
                safeDecode(

                    u.pathname

                        .split('/')

                        .filter(Boolean)

                        .pop() ||

                    ''
                );


            return last

                ? sanitizeWindowsFilename(
                    last
                )

                : '';

        } catch (_) {

            return '';
        }
    }


    function stripNoise(text) {

        let t =
            normalizeSpace(
                safeDecode(
                    text ||
                    ''
                )
            );


        t =
            t.replace(
                /https?:\/\/\S+/gi,
                ' '
            );


        t =
            t.replace(
                /(?:点击下载|立即下载|下载文件|文件下载|附件下载|查看附件|点击查看|查看详情|下载|查看|打开)\s*$/gi,
                ''
            );


        t =
            t.replace(
                /^\s*(?:文件名|附件名称|文件名称)\s*[：:]\s*/i,
                ''
            );


        return normalizeSpace(t);
    }


    /**********************************************************************
     * 从网页文字中抽取文件名
     **********************************************************************/

    function extractFileNameFromText(text) {

        const t =
            stripNoise(text);


        if (!t) {

            return '';
        }


        // 短文本且只包含一个文件扩展名，
        // 可以把整个文本作为文件名。
        const extHits =
            t.match(
                new RegExp(
                    `\\.(${EXT_GROUP})(?=$|[\\s,，;；)）\\]】])`,
                    'ig'
                )
            ) ||
            [];


        if (
            t.length <= 190 &&
            FILE_EXT_END_RE.test(t) &&
            extHits.length === 1
        ) {

            return sanitizeWindowsFilename(
                t
            );
        }


        // 较长上下文中，寻找“中文名称.xxx”。
        const re =
            new RegExp(

                `(?:^|[|｜;；。\\n]|\\s{2,})` +

                `([^|｜;；。\\n]{1,180}?\\.(${EXT_GROUP}))` +

                `(?=$|[\\s,，;；)）\\]】]|(?:下载|查看|打开))`,

                'ig'
            );


        const matches =
            [
                ...t.matchAll(re)
            ];


        if (
            matches.length
        ) {

            let candidate =
                matches[
                    matches.length - 1
                ][1]
                    .trim();


            candidate =
                candidate.replace(

                    /^(?:附件名称|文件名称|文件名)\s*[：:]\s*/i,

                    ''
                );


            return sanitizeWindowsFilename(
                candidate
            );
        }


        // 没有扩展名，但明显是短中文资料名称，
        // 后续可根据 URL 自动补扩展名。
        if (
            t.length >= 3 &&
            t.length <= 100 &&
            CHINESE_RE.test(t) &&
            !isInvalidText(t) &&
            !isNavigationText(t)
        ) {

            if (
                !/^(发布时间|来源|作者|浏览次数|字号|打印|关闭|分享)/.test(
                    t
                )
            ) {

                return sanitizeWindowsFilename(
                    t
                );
            }
        }


        return '';
    }


    /**********************************************************************
     * 2. 项目名称识别
     **********************************************************************/

    function cleanupProjectTitle(text) {

        let t =
            normalizeSpace(text)

                .replace(
                    /^(项目名称|工程名称|建设项目名称)\s*[：:]\s*/i,
                    ''
                )

                .split(
                    /(?:建设单位|项目单位|建设地点|公示时间|发布时间|附件)[：:]/
                )[0]

                .trim();


        if (
            t.length > 90
        ) {

            t =
                t.slice(
                    0,
                    90
                );
        }


        return sanitizeWindowsFilename(
            t
        );
    }


    function detectProjectTitle(doc) {

        const nodes =
            doc.querySelectorAll(
                'td,th,dt,dd,p,li,div,span'
            );


        let checked =
            0;


        for (
            const el
            of nodes
        ) {

            if (
                ++checked >
                3000
            ) {

                break;
            }


            const text =
                normalizeSpace(

                    el.innerText ||

                    el.textContent ||

                    ''
                );


            if (
                !text ||
                text.length > 180
            ) {

                continue;
            }


            const m =
                text.match(

                    /(?:项目名称|工程名称|建设项目名称)\s*[：:]\s*(.{2,100})/i

                );


            if (
                m &&
                m[1]
            ) {

                const v =
                    cleanupProjectTitle(
                        m[1]
                    );


                if (v) {

                    return v;
                }
            }


            if (
                /^(项目名称|工程名称|建设项目名称)\s*[：:]?$/i.test(
                    text
                )
            ) {

                const sibling =
                    el.nextElementSibling;


                const s =
                    normalizeSpace(

                        sibling?.innerText ||

                        sibling?.textContent ||

                        ''
                    );


                if (
                    s &&
                    s.length <= 100
                ) {

                    return cleanupProjectTitle(
                        s
                    );
                }
            }
        }


        const heading =
            doc.querySelector(

                'h1,.article-title,.content-title,.news-title,.title'

            );


        let title =
            cleanupProjectTitle(

                heading?.innerText ||

                heading?.textContent ||

                ''
            );


        if (
            title &&
            /(工程|项目|水库|灌区|河道|水利|供水|引水|水资源|评价|报告|公示)/.test(
                title
            )
        ) {

            title =
                title.replace(

                    /(?:公示|公告|批前公示|审批公示|信息公开).*$/g,

                    ''
                )
                    .trim();


            if (
                title.length >= 4
            ) {

                return title;
            }
        }


        return '';
    }


    function findNearestHeading(a) {

        const generic =
            /^(附件|附件下载|相关附件|下载|文件下载|正文|内容|公示|公告)$/;


        let node =
            a;


        for (
            let up = 0;
            up < 5 &&
            node;
            up++,
            node = node.parentElement
        ) {

            let prev =
                node.previousElementSibling;


            let steps =
                0;


            while (
                prev &&
                steps++ < 8
            ) {

                const heading =
                    prev.matches?.(

                        'h1,h2,h3,h4,h5,h6,.title,.tit,.section-title,.subtitle'

                    )

                        ? prev

                        : prev.querySelector?.(

                            'h1,h2,h3,h4,h5,h6,.title,.tit,.section-title,.subtitle'

                        );


                const text =
                    normalizeSpace(

                        heading?.innerText ||

                        heading?.textContent ||

                        ''
                    );


                if (
                    text &&
                    text.length <= 90 &&
                    !generic.test(text)
                ) {

                    return sanitizeWindowsFilename(
                        text
                    );
                }


                prev =
                    prev.previousElementSibling;
            }
        }


        return '';
    }


    /**********************************************************************
     * 3. 下载链接识别
     **********************************************************************/

    function extractUrlFromAnchor(
        a,
        baseUrl
    ) {

        const attrs = [

            a.getAttribute(
                'href'
            ),

            a.getAttribute(
                'data-href'
            ),

            a.getAttribute(
                'data-url'
            ),

            a.getAttribute(
                'data-file'
            ),

            a.getAttribute(
                'data-download'
            ),

            a.getAttribute(
                'download-url'
            )

        ].filter(Boolean);


        for (
            const raw
            of attrs
        ) {

            const s =
                String(raw)
                    .trim();


            if (
                !s ||
                s === '#' ||
                /^javascript:\s*void/i.test(s) ||
                /^mailto:/i.test(s)
            ) {

                continue;
            }


            if (
                !/^javascript:/i.test(
                    s
                )
            ) {

                const normalized =
                    normalizeUrl(
                        s,
                        baseUrl
                    );


                if (normalized) {

                    return normalized;
                }
            }
        }


        // 某些政府网站把下载地址写在 onclick 中。
        const onclick =
            a.getAttribute(
                'onclick'
            ) ||
            '';


        const quoted =
            [
                ...onclick.matchAll(
                    /['"]([^'"]+)['"]/g
                )
            ]
                .map(
                    m => m[1]
                );


        for (
            const part
            of quoted
        ) {

            if (
                looksLikeSupportedFile(part) ||
                DOWNLOAD_URL_RE.test(part)
            ) {

                const normalized =
                    normalizeUrl(
                        part,
                        baseUrl
                    );


                if (normalized) {

                    return normalized;
                }
            }
        }


        return '';
    }


    function getAnchorContextText(a) {

        const chunks =
            [];


        let node =
            a;


        for (
            let level = 0;
            level < 4 &&
            node;
            level++,
            node = node.parentElement
        ) {

            const text =
                normalizeSpace(

                    node.innerText ||

                    node.textContent ||

                    ''
                );


            if (
                text &&
                text.length <= 700
            ) {

                chunks.push(
                    text
                );
            }
        }


        return chunks
            .join(' | ')
            .slice(
                0,
                1800
            );
    }


    function isAttachmentCandidate(
        a,
        url
    ) {

        if (
            !url ||
            isBlockedResource(url)
        ) {

            return false;
        }


        const text =
            normalizeSpace(

                a.innerText ||

                a.textContent ||

                a.getAttribute(
                    'title'
                ) ||

                ''
            );


        const downloadAttr =
            a.getAttribute(
                'download'
            ) ||
            '';


        const title =
            normalizeSpace(

                a.getAttribute(
                    'title'
                ) ||

                ''
            );


        const context =
            getAnchorContextText(a);


        if (
            looksLikeSupportedFile(url) ||
            looksLikeSupportedFile(text) ||
            looksLikeSupportedFile(downloadAttr) ||
            looksLikeSupportedFile(title)
        ) {

            return true;
        }


        if (
            a.hasAttribute(
                'download'
            )
        ) {

            return true;
        }


        if (
            DOWNLOAD_URL_RE.test(url) &&
            (
                ATTACHMENT_WORD_RE.test(
                    `${text} ${title}`
                ) ||
                ATTACHMENT_WORD_RE.test(
                    context
                )
            )
        ) {

            return true;
        }


        if (
            (
                isInvalidText(text) ||
                ATTACHMENT_WORD_RE.test(text)
            ) &&
            DOWNLOAD_URL_RE.test(url)
        ) {

            return true;
        }


        if (
            isNavigationText(text)
        ) {

            return false;
        }


        return false;
    }


    /**********************************************************************
     * 4. 智能中文文件名识别
     **********************************************************************/

    function collectNameCandidates(
        a,
        url
    ) {

        const candidates =
            [];


        function push(
            value,
            origin,
            bonus = 0
        ) {

            const raw =
                normalizeSpace(
                    value ||
                    ''
                );


            if (
                !raw ||
                raw.length > 800
            ) {

                return;
            }


            const parsed =
                extractFileNameFromText(
                    raw
                );


            if (parsed) {

                candidates.push({

                    name:
                        parsed,

                    origin,

                    bonus,

                    raw
                });
            }
        }


        // 1. 链接显示文字。
        push(

            a.innerText ||
            a.textContent ||
            '',

            '链接文字',

            120
        );


        // 2. 常见文件名属性。
        const attrNames = [

            'download',

            'title',

            'aria-label',

            'data-filename',

            'data-file-name',

            'data-name',

            'data-title',

            'data-original-name',

            'data-original',

            'filename'
        ];


        for (
            const attr
            of attrNames
        ) {

            push(

                a.getAttribute(
                    attr
                ),

                `${attr}属性`,

                100
            );
        }


        // 3. 链接内部节点。
        for (
            const child
            of a.querySelectorAll(

                '[title],[data-filename],[data-name],[aria-label]'

            )
        ) {

            push(
                child.getAttribute(
                    'title'
                ),
                '子节点title',
                90
            );


            push(
                child.getAttribute(
                    'data-filename'
                ),
                '子节点data-filename',
                90
            );


            push(
                child.getAttribute(
                    'data-name'
                ),
                '子节点data-name',
                90
            );


            push(
                child.getAttribute(
                    'aria-label'
                ),
                '子节点aria-label',
                80
            );
        }


        // 4. 紧邻文本节点。
        // 常见：
        //
        // 项目报告.pdf <a href="hash.pdf">下载</a>
        //
        const parentNode =
            a.parentNode;


        if (parentNode) {

            const nodes =
                [
                    ...parentNode.childNodes
                ];


            const pos =
                nodes.indexOf(a);


            for (
                const offset
                of [
                    -2,
                    -1,
                    1,
                    2
                ]
            ) {

                const node =
                    nodes[
                        pos +
                        offset
                    ];


                if (
                    node &&
                    node !== a
                ) {

                    push(

                        node.textContent ||
                        '',

                        '相邻文本节点',

                        88 -
                        Math.abs(offset) *
                        3
                    );
                }
            }
        }


        // 5. 表格同行。
        const tr =
            a.closest(
                'tr'
            );


        if (tr) {

            for (
                const cell
                of tr.querySelectorAll(
                    'th,td'
                )
            ) {

                push(

                    cell.innerText ||
                    cell.textContent ||
                    '',

                    '表格行',

                    80
                );
            }
        }


        // 6. 前后兄弟元素。
        let prev =
            a.previousElementSibling;


        let next =
            a.nextElementSibling;


        for (
            let i = 0;
            i < 4 &&
            prev;
            i++,
            prev =
                prev.previousElementSibling
        ) {

            push(

                prev.innerText ||
                prev.textContent ||
                '',

                '前置兄弟节点',

                75 -
                i *
                5
            );
        }


        for (
            let i = 0;
            i < 3 &&
            next;
            i++,
            next =
                next.nextElementSibling
        ) {

            push(

                next.innerText ||
                next.textContent ||
                '',

                '后置兄弟节点',

                55 -
                i *
                5
            );
        }


        // 7. 最近父容器。
        for (
            const selector
            of [
                'li',
                'p',
                'dd',
                '.attachment',
                '.file',
                '.download',
                '.fj',
                '.list-item',
                'div'
            ]
        ) {

            const box =
                a.closest(
                    selector
                );


            if (box) {

                push(

                    box.innerText ||
                    box.textContent ||
                    '',

                    `父容器${selector}`,

                    60
                );
            }
        }


        // 8. URL 永远放在最后。
        const fromUrl =
            filenameFromUrl(
                url
            );


        if (fromUrl) {

            candidates.push({

                name:
                    fromUrl,

                origin:
                    'URL',

                bonus:
                    -20,

                raw:
                    fromUrl
            });
        }


        return candidates;
    }


    function candidateScore(
        candidate,
        urlExt
    ) {

        const name =
            sanitizeWindowsFilename(

                candidate.name ||

                ''
            );


        const base =
            stripExtension(name)
                .trim();


        if (
            !name ||
            !base ||
            isInvalidText(base) ||
            isNavigationText(base)
        ) {

            return -99999;
        }


        let score =
            candidate.bonus ||
            0;


        const ext =
            getExtension(name);


        // 中文名优先。
        if (
            CHINESE_RE.test(
                name
            )
        ) {

            score +=
                180;
        }


        // 有明确扩展名。
        if (ext) {

            score +=
                55;
        }


        if (
            urlExt &&
            ext &&
            ext === urlExt
        ) {

            score +=
                20;
        }


        if (
            base.length >= 4 &&
            base.length <= 100
        ) {

            score +=
                30;
        }


        if (
            ATTACHMENT_WORD_RE.test(
                name
            )
        ) {

            score +=
                20;
        }


        if (
            /^(附件\s*\d+\s*[：:])/i.test(
                name
            )
        ) {

            score +=
                25;
        }


        if (
            candidate.origin ===
            '链接文字'
        ) {

            score +=
                45;
        }


        if (
            candidate.origin.includes(
                '表格行'
            )
        ) {

            score +=
                30;
        }


        if (
            candidate.origin.includes(
                '兄弟节点'
            )
        ) {

            score +=
                25;
        }


        // 机器哈希名直接重罚。
        if (
            isMachineFilename(
                name
            )
        ) {

            score -=
                500;
        }


        if (
            name.length > 160
        ) {

            score -=
                100;
        }


        if (
            /^(发布时间|来源|作者|浏览次数|打印|关闭|分享)/.test(
                base
            )
        ) {

            score -=
                300;
        }


        if (
            /^(http|www\.)/i.test(
                base
            )
        ) {

            score -=
                300;
        }


        return score;
    }


    function sanitizeFilenameAffix(text) {

        const normalized =
            normalizeSpace(text);


        return normalized
            ? sanitizeWindowsFilename(
                normalized
            )
            : '';
    }


    function splitFilenameForAffix(filename) {

        const name =
            String(filename || '');


        const match =
            name.match(
                new RegExp(
                    `\.(${EXT_GROUP})$`,
                    'i'
                )
            );


        return match
            ? {

                stem:
                    name.slice(
                        0,
                        -match[0].length
                    ),

                extension:
                    match[0]
            }
            : {

                stem: name,

                extension: ''
            };
    }


    function filenameWithoutAppliedAffixes(
        item,
        filename = item?.filename
    ) {

        let base =
            String(filename || '');


        const appliedPrefix =
            String(
                item?.appliedFilenamePrefix ||
                ''
            );


        const appliedSuffix =
            String(
                item?.appliedFilenameSuffix ||
                ''
            );


        if (
            appliedPrefix &&
            base.startsWith(
                appliedPrefix
            )
        ) {

            base =
                base.slice(
                    appliedPrefix.length
                );
        }


        const parts =
            splitFilenameForAffix(
                base
            );


        if (
            appliedSuffix &&
            parts.stem.endsWith(
                appliedSuffix
            )
        ) {

            parts.stem =
                parts.stem.slice(
                    0,
                    -appliedSuffix.length
                );
        }


        return sanitizeWindowsFilename(
            `${parts.stem}${parts.extension}`
        );
    }


    function composeFilenameWithAffixes(
        baseFilename
    ) {

        const base =
            sanitizeWindowsFilename(
                baseFilename ||
                t(
                    'unnamedAttachment'
                )
            );


        const parts =
            splitFilenameForAffix(
                base
            );


        let prefix =
            state.filenameAffixes
                .prefixEnabled
                ? sanitizeFilenameAffix(
                    state.filenameAffixes
                        .prefixText
                )
                : '';


        let suffix =
            state.filenameAffixes
                .suffixEnabled
                ? sanitizeFilenameAffix(
                    state.filenameAffixes
                        .suffixText
                )
                : '';


        // Windows 文件名总长度仍限制为 190 个字符。
        // 优先保留用户填写的前后缀，再缩短文件名主体。
        const stemLimit =
            Math.max(
                1,
                190 -
                parts.extension.length
            );


        const affixLimit =
            Math.max(
                0,
                stemLimit - 1
            );


        if (
            prefix.length +
            suffix.length >
            affixLimit
        ) {

            if (
                prefix &&
                suffix
            ) {

                const prefixLimit =
                    Math.ceil(
                        affixLimit / 2
                    );


                prefix =
                    prefix.slice(
                        0,
                        prefixLimit
                    );


                suffix =
                    suffix.slice(
                        0,
                        Math.max(
                            0,
                            affixLimit -
                            prefix.length
                        )
                    );

            } else if (prefix) {

                prefix =
                    prefix.slice(
                        0,
                        affixLimit
                    );

            } else {

                suffix =
                    suffix.slice(
                        0,
                        affixLimit
                    );
            }
        }


        const coreLimit =
            Math.max(
                1,
                stemLimit -
                prefix.length -
                suffix.length
            );


        const core =
            (
                parts.stem ||
                t(
                    'unnamedAttachment'
                )
            )
                .slice(
                    0,
                    coreLimit
                );


        return {

            filename:
                sanitizeWindowsFilename(
                    `${prefix}${core}${suffix}${parts.extension}`
                ),

            prefix,

            suffix
        };
    }


    function applyFilenameAffixesToItem(
        item
    ) {

        const base =
            filenameWithoutAppliedAffixes(
                item
            );


        const composed =
            composeFilenameWithAffixes(
                base
            );


        item.filename =
            composed.filename;


        item.appliedFilenamePrefix =
            composed.prefix;


        item.appliedFilenameSuffix =
            composed.suffix;
    }


    function applyFilenameAffixesToAll() {

        for (
            const item
            of state.items
        ) {

            applyFilenameAffixesToItem(
                item
            );
        }
    }


    function chooseBestFilename(
        a,
        url,
        projectTitle
    ) {

        const originalText =
            normalizeSpace(

                a.innerText ||

                a.textContent ||

                ''
            );


        const urlExt =
            extensionFromUrlOrText(
                url,
                originalText
            );


        const candidates =
            collectNameCandidates(
                a,
                url
            )

                .map(
                    c => ({
                        ...c,
                        score:
                            candidateScore(
                                c,
                                urlExt
                            )
                    })
                )

                .sort(
                    (
                        x,
                        y
                    ) =>
                        y.score -
                        x.score
                );


        const best =
            candidates[0];


        let filename =
            best?.name ||
            t(
                'unnamedAttachment'
            );


        let source =
            best?.origin ||
            '待探测';


        filename =
            ensureExtension(
                filename,
                urlExt
            );


        return {

            filename:
                sanitizeWindowsFilename(
                    filename
                ),

            source,

            originalText,

            candidateDebug:
                candidates.slice(
                    0,
                    5
                )
        };
    }


    function extractItemsFromDocument(
        doc,
        baseUrl,
        sourcePageUrl,
        sourceDepth = 1
    ) {

        const result =
            [];


        const projectTitle =
            detectProjectTitle(
                doc
            );


        for (
            const a
            of doc.querySelectorAll(
                'a'
            )
        ) {

            // 防止扫描脚本自身窗口。
            if (
                a.closest?.(
                    '#wra-helper-panel,#wra-idm-plugin-sheet'
                )
            ) {

                continue;
            }


            const url =
                extractUrlFromAnchor(
                    a,
                    baseUrl
                );


            if (
                !url ||
                !isAttachmentCandidate(
                    a,
                    url
                )
            ) {

                continue;
            }


            const visibleText =
                normalizeSpace(

                    a.innerText ||

                    a.textContent ||

                    ''
                );


            if (
                isNavigationText(
                    visibleText
                ) &&
                !looksLikeSupportedFile(
                    url
                ) &&
                !looksLikeSupportedFile(
                    visibleText
                )
            ) {

                continue;
            }


            const named =
                chooseBestFilename(
                    a,
                    url,
                    projectTitle
                );


            const heading =
                findNearestHeading(
                    a
                );


            result.push({

                id:
                    cryptoRandomId(),

                selected:
                    true,

                filename:
                    named.filename,

                url,

                sourcePage:
                    sourcePageUrl ||
                    baseUrl,

                sourceDepth,

                projectTitle:
                    projectTitle ||
                    '',

                sectionTitle:
                    heading ||
                    '',

                nameSource:
                    named.source,

                originalText:
                    named.originalText,

                needsMetadata:
                    isMachineFilename(
                        named.filename
                    ) ||
                    !getExtension(
                        named.filename
                    ),

                candidateDebug:
                    named.candidateDebug
            });
        }


        return result;
    }


    function cryptoRandomId() {

        try {

            if (
                globalThis.crypto
                    ?.randomUUID
            ) {

                return globalThis.crypto
                    .randomUUID();
            }

        } catch (_) {}


        return (
            'i_' +
            Date.now()
                .toString(36) +
            '_' +
            Math.random()
                .toString(36)
                .slice(2)
        );
    }


    function mergeItems(items) {

        let added =
            0;


        for (
            const item
            of items
        ) {

            const key =
                normalizeUrl(

                    item.url,

                    item.sourcePage ||
                    location.href
                );


            if (!key) {

                continue;
            }


            if (
                state.byUrl
                    .has(key)
            ) {

                const existing =
                    state.byUrl
                        .get(key);


                // 已有机器名，新结果找到中文名时自动覆盖。
                if (
                    isMachineFilename(
                        filenameWithoutAppliedAffixes(
                            existing
                        )
                    ) &&
                    !isMachineFilename(
                        filenameWithoutAppliedAffixes(
                            item
                        )
                    )
                ) {

                    existing.filename =
                        filenameWithoutAppliedAffixes(
                            item
                        );


                    existing.appliedFilenamePrefix =
                        '';


                    existing.appliedFilenameSuffix =
                        '';


                    existing.nameSource =
                        item.nameSource;


                    existing.projectTitle =
                        item.projectTitle ||
                        existing.projectTitle;


                    existing.sectionTitle =
                        item.sectionTitle ||
                        existing.sectionTitle;


                    existing.needsMetadata =
                        false;


                    applyFilenameAffixesToItem(
                        existing
                    );
                }


                continue;
            }


            item.url =
                key;


            applyFilenameAffixesToItem(
                item
            );


            state.items
                .push(
                    item
                );


            state.byUrl
                .set(
                    key,
                    item
                );


            added++;
        }


        return added;
    }


    /**********************************************************************
     * 5. HEAD探测
     *
     * 用于：
     *
     * /download?id=123
     * /file?id=456
     *
     * 或服务器哈希文件名。
     **********************************************************************/

    function parseHeaders(
        rawHeaders
    ) {

        const headers =
            {};


        String(
            rawHeaders ||
            ''
        )

            .split(
                /\r?\n/
            )

            .forEach(
                line => {

                    const idx =
                        line.indexOf(
                            ':'
                        );


                    if (
                        idx > 0
                    ) {

                        headers[
                            line
                                .slice(
                                    0,
                                    idx
                                )
                                .trim()
                                .toLowerCase()
                        ] =
                            line
                                .slice(
                                    idx + 1
                                )
                                .trim();
                    }
                }
            );


        return headers;
    }


    function filenameFromContentDisposition(
        cd
    ) {

        if (!cd) {

            return '';
        }


        let m =
            cd.match(

                /filename\*\s*=\s*["']?([^'";]*)'[^']*'([^;"']+)/i

            );


        if (m) {

            const value =
                decodeUrlComponentSmart(
                    m[2]
                        .trim(),
                    m[1]
                );


            if (value) {

                return sanitizeWindowsFilename(

                    value

                        .split('/')
                        .pop()

                        .split('\\')
                        .pop()
                );
            }
        }


        m =
            cd.match(

                /filename\*\s*=\s*([^;]+)/i

            );


        if (m) {

            const value =
                safeDecode(
                    m[1]
                        .trim()
                        .replace(
                            /^['"]|['"]$/g,
                            ''
                        )
                );


            if (value) {

                return sanitizeWindowsFilename(
                    value
                        .split('/')
                        .pop()
                        .split('\\')
                        .pop()
                );
            }
        }


        m =
            cd.match(

                /filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;]+))/i

            );


        if (m) {

            const value =
                safeDecode(

                    m[1] ||

                    m[2] ||

                    m[3] ||

                    ''
                )
                    .trim();


            if (value) {

                return sanitizeWindowsFilename(

                    value

                        .split('/')
                        .pop()

                        .split('\\')
                        .pop()
                );
            }
        }


        return '';
    }


    function headRequest(url) {

        return new Promise(
            resolve => {

                GM_xmlhttpRequest({

                    method:
                        'HEAD',

                    url,

                    timeout:
                        12000,

                    anonymous:
                        false,


                    onload:
                        resolve,


                    onerror:
                        () =>
                            resolve(
                                null
                            ),


                    ontimeout:
                        () =>
                            resolve(
                                null
                            )
                });
            }
        );
    }


    async function enrichItemMetadata(
        item
    ) {

        const res =
            await headRequest(
                item.url
            );


        if (!res) {

            return;
        }


        const headers =
            parseHeaders(
                res.responseHeaders
            );


        const cdName =
            filenameFromContentDisposition(

                headers[
                    'content-disposition'
                ]
            );


        const contentType =
            String(

                headers[
                    'content-type'
                ] ||

                ''
            )

                .split(';')[0]

                .trim()

                .toLowerCase();


        const mimeExt =
            MIME_TO_EXT[
                contentType
            ] ||
            '';


        let filename =
            filenameWithoutAppliedAffixes(
                item
            );


        // 只有服务器提供的是正常名称，
        // 才允许替换机器哈希名称。
        if (
            cdName &&
            !isMachineFilename(
                cdName
            ) &&
            (
                isMachineFilename(
                    filename
                ) ||
                !getExtension(
                    filename
                )
            )
        ) {

            filename =
                cdName;


            item.nameSource =
                '服务器Content-Disposition';
        }


        if (
            !getExtension(
                filename
            ) &&
            mimeExt
        ) {

            filename =
                ensureExtension(
                    filename,
                    mimeExt
                );
        }


        const baseFilename =
            sanitizeWindowsFilename(
                filename
            );


        item.filename =
            baseFilename;


        item.appliedFilenamePrefix =
            '';


        item.appliedFilenameSuffix =
            '';


        applyFilenameAffixesToItem(
            item
        );


        item.needsMetadata =
            isMachineFilename(
                baseFilename
            ) ||
            !getExtension(
                baseFilename
            );
    }


    async function enrichMissingMetadata(
        items
    ) {

        const queue =
            items

                .filter(
                    x =>
                        x.needsMetadata
                )

                .slice(
                    0,
                    CONFIG.maxHeadRequestsPerScan
                );


        if (
            !queue.length
        ) {

            return;
        }


        let index =
            0;


        async function worker() {

            while (
                index <
                queue.length
            ) {

                const current =
                    queue[
                        index++
                    ];


                await enrichItemMetadata(
                    current
                );


                renderResults();
            }
        }


        await Promise.all(

            Array.from(

                {
                    length:
                        Math.min(

                            CONFIG.headConcurrency,

                            queue.length
                        )
                },

                () =>
                    worker()
            )
        );
    }


    /**********************************************************************
     * 6. 扫描
     **********************************************************************/

    async function scanCurrentPage() {

        if (
            state.scanning
        ) {

            return;
        }


        state.scanning =
            true;


       setStatus(
            t('scanCurrent')
        );


        try {

            let items =
                extractItemsFromDocument(

                    document,

                    location.href,

                    location.href
                );


            if (
                items.some(
                    item =>
                        isMojibake(
                            `${item.filename} ${item.originalText}`
                        )
                )
            ) {

               setStatus(
                    t('mojibakeRetry')
                );


                try {

                    const res =
                        await requestText(
                            location.href
                        );


                    const recoveredUrl =
                        normalizeUrl(
                            res.finalUrl ||
                            location.href,
                            location.href
                        ) ||
                        location.href;


                    const recoveredDoc =
                        new DOMParser()
                            .parseFromString(
                                res.text,
                                'text/html'
                            );


                    items = [

                        ...items,

                        ...extractItemsFromDocument(
                            recoveredDoc,
                            recoveredUrl,
                            recoveredUrl
                        )
                    ];

                } catch (encodingError) {

                    console.warn(
                        '[IDM下载助手] 网页乱码重解失败：',
                        encodingError
                    );
                }
            }


            const added =
                mergeItems(
                    items
                );


            renderResults();

            updateSelectionCount();


           setStatus(

                t(
                    'currentAdded',
                    {
                        added,
                        total:
                            state.items.length
                    }
                )

           );


            await enrichMissingMetadata(
                items
            );


            renderResults();

            updateSelectionCount();


            const machineCount =
                state.items

                    .filter(
                        x =>
                           isMachineFilename(
                                filenameWithoutAppliedAffixes(
                                    x
                                )
                           )
                    )

                    .length;


            setStatus(

                machineCount

                    ? t(
                        'scanCompleteUnreliable',
                        {
                            total:
                                state.items.length,
                            machine:
                                machineCount
                        }
                    )

                    : t(
                        'scanComplete',
                        {
                            total:
                                state.items.length
                        }
                    )

            );

        } catch (err) {

            console.error(

                '[IDM下载助手] 扫描失败：',

                err
            );


           setStatus(

                t(
                    'scanFailed',
                    {
                        error:
                            err.message ||
                            err
                    }
                )

           );

        } finally {

            state.scanning =
                false;
        }
    }


    function installMutationObserver() {

        const observer =
            new MutationObserver(

                mutations => {

                    const hasNewLinks =
                        mutations.some(

                            m => {

                                if (
                                    m.target
                                        ?.closest?.(
                                            '#wra-helper-panel,#wra-idm-plugin-sheet'
                                        )
                                ) {

                                    return false;
                                }


                                return [
                                    ...(
                                        m.addedNodes ||
                                        []
                                    )
                                ]
                                    .some(

                                        node =>

                                            node.nodeType === 1 &&

                                            !node.closest?.(
                                                '#wra-helper-panel,#wra-idm-plugin-sheet'
                                            ) &&

                                            (
                                                node.matches?.(
                                                    'a'
                                                ) ||

                                                node.querySelector?.(
                                                    'a'
                                                )
                                            )
                                    );
                            }
                        );


                    if (
                        !hasNewLinks
                    ) {

                        return;
                    }


                    clearTimeout(
                        state.observerTimer
                    );


                    state.observerTimer =
                        setTimeout(

                            scanCurrentPage,

                            CONFIG.mutationDebounceMs
                        );
                }
            );


        observer.observe(

            document.documentElement,

            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    /**********************************************************************
     * 7. 列表分页识别与网页请求
     **********************************************************************/

    function findNextPageUrl(
        doc,
        baseUrl,
        visited
    ) {

        const anchors =
            [
                ...doc.querySelectorAll(
                    'a'
                )
            ];


        const urlOf =
            a => {

                const url =
                    extractUrlFromAnchor(
                        a,
                        baseUrl
                    );


                return url &&
                    !visited.has(url)
                    ? url
                    : '';
            };


        const labelOf =
            a =>
                normalizeSpace(
                    [
                        a.innerText ||
                        a.textContent ||
                        '',
                        a.getAttribute(
                            'title'
                        ) ||
                        '',
                        a.getAttribute(
                            'aria-label'
                        ) ||
                        ''
                    ]
                        .join(' ')
                );


        const paginationMarker =
            node => {

                for (
                    let current = node;
                    current;
                    current =
                        current.parentElement
                ) {

                    const marker =
                        `${current.id || ''} ${
                            typeof current.className ===
                            'string'
                                ? current.className
                                : ''
                        } ${current.getAttribute?.(
                            'aria-label'
                        ) || ''}`;


                    if (
                        /(?:^|[\s_-])(pagination|paging|pager|pagebar|page-nav|page-list|pages|fenye|fy)(?:$|[\s_-])/i.test(
                            marker
                        )
                    ) {

                        return true;
                    }


                    if (
                        current ===
                        doc.body
                    ) {

                        break;
                    }
                }


                return false;
            };


        // 优先使用标准 rel=next。
        for (
            const a
            of anchors.filter(
                anchor =>
                    /(?:^|\s)next(?:\s|$)/i.test(
                        anchor.getAttribute(
                            'rel'
                        ) ||
                        ''
                    )
            )
        ) {

            const url =
                urlOf(a);


            if (url) {

                return url;
            }
        }


        // 兼容“下一页 >”“Next »”、title/aria-label 以及 next 类名。
        for (const a of anchors) {

            const label =
                labelOf(a);


            const marker =
                `${a.id || ''} ${
                    typeof a.className ===
                    'string'
                        ? a.className
                        : ''
                } ${
                    typeof a.parentElement
                        ?.className ===
                    'string'
                        ? a.parentElement.className
                        : ''
                }`;


            if (
                !/(?:下一页|下页|后一页|next(?:\s*page)?)/i.test(
                    label
                ) &&
                !/^(?:\s*[›»>→]+\s*)$/i.test(
                    label
                ) &&
                !/(?:^|[\s_-])next(?:$|[\s_-])/i.test(
                    marker
                )
            ) {

                continue;
            }


            const url =
                urlOf(a);


            if (url) {

                return url;
            }
        }


        // 没有明确“下一页”时，从分页条中找当前页码之后最小的数字页。
        let currentPage = 0;


        for (
            const node
            of doc.querySelectorAll(
                '[aria-current="page"],.current,.active,.on,.selected,strong'
            )
        ) {

            if (
                !paginationMarker(node)
            ) {

                continue;
            }


            const match =
                normalizeSpace(
                    node.textContent ||
                    ''
                )
                    .match(
                        /^(\d{1,6})$/
                    );


            if (match) {

                currentPage =
                    Number(match[1]);


                break;
            }
        }


        if (!currentPage) {

            try {

                const currentUrl =
                    new URL(baseUrl);


                for (
                    const key
                    of [
                        'page',
                        'p',
                        'pageNo',
                        'pageNum',
                        'currentPage',
                        'pageIndex'
                    ]
                ) {

                    const value =
                        Number(
                            currentUrl.searchParams
                                .get(key)
                        );


                    if (
                        Number.isFinite(value) &&
                        value > 0
                    ) {

                        currentPage = value;

                        break;
                    }
                }

            } catch (_) {}
        }


        const numbered =
            anchors
                .filter(
                    paginationMarker
                )
                .map(
                    a => {

                        const match =
                            normalizeSpace(
                                a.textContent ||
                                ''
                            )
                                .match(
                                    /^(\d{1,6})$/
                                );


                        return match
                            ? {
                                page:
                                    Number(
                                        match[1]
                                    ),
                                url:
                                    urlOf(a)
                            }
                            : null;
                    }
                )
                .filter(
                    item =>
                        item?.url &&
                        item.page >
                        currentPage
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        a.page -
                        b.page
                );


        if (numbered[0]?.url) {

            return numbered[0].url;
        }


        // 某些政府静态站只有第一页写出“下一页”，后续页采用
        // index_1.html、index_2.html 递增；有明确分页证据时补推下一页。
        try {

            const currentUrl =
                new URL(baseUrl);


            for (
                const [
                    key,
                    rawValue
                ]
                of currentUrl.searchParams
                    .entries()
            ) {

                if (
                    !/^(?:page|p|pageno|pagenum|currentpage|pageindex)$/i.test(
                        key
                    ) ||
                    !/^\d+$/.test(
                        rawValue
                    )
                ) {

                    continue;
                }


                const inferred =
                    new URL(
                        currentUrl.href
                    );


                inferred.searchParams
                    .set(
                        key,
                        String(
                            Number(rawValue) +
                            1
                        )
                    );


                if (
                    !visited.has(
                        inferred.href
                    )
                ) {

                    return inferred.href;
                }
            }


            const pathMatch =
                currentUrl.pathname
                    .match(
                        /^(.*?)([_-])(\d+)(\.(?:s?html?|xhtml))$/i
                    );


            if (pathMatch) {

                const [
                    ,
                    prefix,
                    separator,
                    rawNumber,
                    extension
                ] = pathMatch;


                const unnumberedPath =
                    `${prefix}${extension}`;


                let hasPaginationEvidence =
                    false;


                for (
                    const seenUrl
                    of visited
                ) {

                    try {

                        const seen =
                            new URL(seenUrl);


                        if (
                            seen.origin !==
                            currentUrl.origin
                        ) {

                            continue;
                        }


                        if (
                            seen.pathname ===
                            unnumberedPath ||
                            seen.pathname.match(
                                new RegExp(
                                    `^${prefix.replace(
                                        /[.*+?^${}()|[\]\\]/g,
                                        '\\$&'
                                    )}${separator}\\d+${extension.replace(
                                        '.',
                                        '\\.'
                                    )}$`,
                                    'i'
                                )
                            ) &&
                            seen.pathname !==
                            currentUrl.pathname
                        ) {

                            hasPaginationEvidence =
                                true;

                            break;
                        }

                    } catch (_) {}
                }


                if (hasPaginationEvidence) {

                    const inferred =
                        new URL(
                            currentUrl.href
                        );


                    inferred.pathname =
                        `${prefix}${separator}${
                            Number(rawNumber) +
                            1
                        }${extension}`;


                    if (
                        !visited.has(
                            inferred.href
                        )
                    ) {

                        return inferred.href;
                    }
                }
            }

        } catch (_) {}


        return '';
    }


    function charsetFromResponse(
        rawHeaders,
        bytes
    ) {

        const headers =
            parseHeaders(
                rawHeaders
            );


        const headerMatch =
            String(
                headers[
                    'content-type'
                ] ||
                ''
            )
                .match(
                    /charset\s*=\s*["']?([^;\s"']+)/i
                );


        const prefix =
            decodeBytes(
                bytes.slice(
                    0,
                    8192
                ),
                'windows-1252'
            );


        const metaMatch =
            prefix.match(
                /<meta[^>]+charset\s*=\s*["']?\s*([^\s"'/>;]+)/i
            ) ||
            prefix.match(
                /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';/>]+)/i
            );


        return normalizeCharset(
            metaMatch?.[1] ||
            headerMatch?.[1] ||
            ''
        );
    }


    function decodeHtmlBuffer(
        buffer,
        rawHeaders
    ) {

        const bytes =
            buffer instanceof Uint8Array
                ? buffer
                : ArrayBuffer.isView(
                    buffer
                )
                    ? new Uint8Array(
                        buffer.buffer,
                        buffer.byteOffset,
                        buffer.byteLength
                    )
                    : new Uint8Array(
                        buffer
                    );


        if (
            bytes.length >= 3 &&
            bytes[0] === 0xef &&
            bytes[1] === 0xbb &&
            bytes[2] === 0xbf
        ) {

            return decodeBytes(
                bytes,
                'utf-8'
            );
        }


        // 严格 UTF-8 可成功解码时优先采用，避免把正常 UTF-8 误判成 GBK。
        const strictUtf8 =
            decodeBytes(
                bytes,
                'utf-8',
                true
            );


        if (strictUtf8) {

            return strictUtf8;
        }


        const declaredCharset =
            charsetFromResponse(
                rawHeaders,
                bytes
            );


        const candidates = [

            declaredCharset
                ? decodeBytes(
                    bytes,
                    declaredCharset
                )
                : '',

            decodeBytes(
                bytes,
                'gb18030'
            ),

            decodeBytes(
                bytes,
                'utf-8'
            )
        ]
            .filter(Boolean);


        return candidates
            .sort(
                (
                    a,
                    b
                ) =>
                    textQualityScore(b) -
                    textQualityScore(a)
            )[0] ||
            '';
    }


    function responseTextDecoded(res) {

        try {

            if (
                res.response &&
                (
                    res.response instanceof ArrayBuffer ||
                    ArrayBuffer.isView(
                        res.response
                    ) ||
                    Object.prototype.toString.call(
                        res.response
                    ) === '[object ArrayBuffer]'
                )
            ) {

                return decodeHtmlBuffer(
                    res.response,
                    res.responseHeaders
                );
            }

        } catch (_) {}


        return String(
            res.responseText ||
            res.response ||
            ''
        );
    }


    function requestText(url) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                GM_xmlhttpRequest({

                    method:
                        'GET',

                    url,

                    timeout:
                        20000,

                    responseType:
                        'arraybuffer',

                    anonymous:
                        false,


                    onload:
                        res => {

                            if (
                                res.status >= 200 &&
                                res.status < 400
                            ) {

                                resolve({

                                    text:
                                        responseTextDecoded(
                                            res
                                        ),

                                    finalUrl:
                                        res.finalUrl ||
                                        url,

                                    responseHeaders:
                                        res.responseHeaders ||
                                        ''
                                });

                            } else {

                                reject(

                                    new Error(
                                        `HTTP ${res.status}`
                                    )
                                );
                            }
                        },


                    onerror:
                        () =>

                            reject(

                               new Error(
                                    t(
                                        'networkFailed'
                                    )
                                )
                            ),


                    ontimeout:
                        () =>

                            reject(

                               new Error(
                                    t(
                                        'requestTimeout'
                                    )
                                )
                            )
                });
            }
        );
    }


    /**********************************************************************
     * 8. 列表分页与一至三级网页嗅探
     *
     * 第一级为当前列表页及其后续分页；每个列表页分别挑选最多 N 个
     * 二级页，每个二级页再分别挑选最多 N 个三级页。
     **********************************************************************/

    function isSameOriginUrl(
        url,
        rootUrl
    ) {

        try {

            return new URL(url).origin ===
                new URL(rootUrl).origin;

        } catch (_) {

            return false;
        }
    }


    function looksLikeHtmlPageUrl(url) {

        try {

            const pathname =
                safeDecode(
                    new URL(url).pathname
                )
                    .toLowerCase();


            const match =
                pathname.match(
                    /\.([a-z0-9]{1,10})$/i
                );


            // 没有扩展名的链接通常是路由页或动态详情页。
            if (!match) {

                return true;
            }


            return [
                'htm',
                'html',
                'shtml',
                'xhtml',
                'php',
                'asp',
                'aspx',
                'jsp',
                'jspx',
                'do',
                'action'
            ]
                .includes(
                    match[1]
                );

        } catch (_) {

            return false;
        }
    }


    function isSiteChromeAnchor(a) {

        if (
            a.closest?.(
                'header,footer,nav,[role="navigation"],[role="banner"],[role="contentinfo"]'
            )
        ) {

            return true;
        }


        let node =
            a.parentElement;


        for (
            let level = 0;
            node &&
            level < 5;
            level++,
            node = node.parentElement
        ) {

            const marker =
                `${node.id || ''} ${
                    typeof node.className === 'string'
                        ? node.className
                        : ''
                }`;


            if (
                /(?:^|[\s_-])(nav|menu|breadcrumb|crumb|footer|header|sidebar|share|login|pagination|pager)(?:$|[\s_-])/i.test(
                    marker
                )
            ) {

                return true;
            }
        }


        return false;
    }


    function sniffLinkScore(
        a,
        url
    ) {

        const text =
            normalizeSpace(
                a.innerText ||
                a.textContent ||
                a.getAttribute(
                    'title'
                ) ||
                ''
            );


        let score =
            0;


        if (
            text.length >= 4 &&
            text.length <= 100
        ) {

            score +=
                3;
        }


        if (
            CHINESE_RE.test(
                text
            )
        ) {

            score +=
                3;
        }


        if (
            /(detail|article|content|info|view|show|news|notice|public|gongshi|gg|xxgk|id=)/i.test(
                safeDecode(url)
            )
        ) {

            score +=
                4;
        }


        if (
            a.closest?.(
                'main,article,[role="main"],.main,.content,.article,.list,.news-list,.notice-list'
            )
        ) {

            score +=
                5;
        }


        if (
            isInvalidText(
                text
            )
        ) {

            score -=
                2;
        }


        return score;
    }


    function collectSniffPageLinks(
        doc,
        baseUrl,
        rootUrl
    ) {

        const byUrl =
            new Map();


        let order =
            0;


        for (
            const a
            of doc.querySelectorAll(
                'a'
            )
        ) {

            if (
                a.closest?.(
                    '#wra-helper-panel,#wra-idm-plugin-sheet'
                ) ||
                isSiteChromeAnchor(a)
            ) {

                continue;
            }


            const url =
                extractUrlFromAnchor(
                    a,
                    baseUrl
                );


            if (
                !url ||
                !isSameOriginUrl(
                    url,
                    rootUrl
                ) ||
                !looksLikeHtmlPageUrl(
                    url
                ) ||
                isAttachmentCandidate(
                    a,
                    url
                )
            ) {

                continue;
            }


            const text =
                normalizeSpace(
                    a.innerText ||
                    a.textContent ||
                    a.getAttribute(
                        'title'
                    ) ||
                    ''
                );


            if (
                isNavigationText(
                    text
                ) ||
                /(?:^|[\/?#&=_-])(logout|login|signin|signup|register|search|print|share|comment)(?:$|[\/?#&=_-])/i.test(
                    safeDecode(url)
                )
            ) {

                continue;
            }


            const candidate = {

                url,

                score:
                    sniffLinkScore(
                        a,
                        url
                    ),

                order:
                    order++
            };


            const existing =
                byUrl.get(url);


            if (
                !existing ||
                candidate.score >
                existing.score
            ) {

                byUrl.set(
                    url,
                    candidate
                );
            }
        }


        return [
            ...byUrl.values()
        ]

            .sort(
                (
                    a,
                    b
                ) =>
                    b.score -
                    a.score ||
                    a.order -
                    b.order
            )

            .slice(
                0,
                CONFIG.maxSniffLinksPerPage
            )

            .map(
                x =>
                    x.url
            );
    }


    function addChildPageJobs(
        parents,
        depth,
        pagesPerParent,
        rootUrl,
        knownPageUrls
    ) {

        const jobs = [];


        for (const parent of parents) {

            let addedForParent = 0;


            const candidates =
                collectSniffPageLinks(
                    parent.doc,
                    parent.url,
                    rootUrl
                );


            for (const url of candidates) {

                if (
                    knownPageUrls.has(url)
                ) {

                    continue;
                }


                knownPageUrls.add(url);


                jobs.push({
                    url,
                    parentUrl:
                        parent.url,
                    depth
                });


                addedForParent++;


                if (
                    addedForParent >=
                    pagesPerParent
                ) {

                    break;
                }
            }
        }


        return jobs;
    }


    async function fetchSniffPageJobs(
        jobs,
        depth,
        rootUrl,
        resolvedPageUrls,
        progress
    ) {

        const results =
            new Array(
                jobs.length
            );


        let cursor = 0;


        let done = 0;


        async function worker() {

            while (
                cursor <
                jobs.length
            ) {

                const index =
                    cursor++;


                const job =
                    jobs[index];


               setStatus(
                    t(
                        'sniffDepthProgress',
                        {
                            depth,
                            current:
                                Math.min(
                                    done +
                                    CONFIG.sniffConcurrency,
                                    jobs.length
                                ),
                            total:
                                jobs.length
                        }
                    )
               );


                try {

                    const res =
                        await requestText(
                            job.url
                        );


                    const pageUrl =
                        normalizeUrl(
                            res.finalUrl ||
                            job.url,
                            job.url
                        ) ||
                        job.url;


                    if (
                        !isSameOriginUrl(
                            pageUrl,
                            rootUrl
                        ) ||
                        resolvedPageUrls.has(
                            pageUrl
                        )
                    ) {

                        continue;
                    }


                    resolvedPageUrls.add(
                        pageUrl
                    );


                    const pageDoc =
                        new DOMParser()
                            .parseFromString(
                                res.text,
                                'text/html'
                            );


                    const items =
                        extractItemsFromDocument(
                            pageDoc,
                            pageUrl,
                            pageUrl,
                            depth
                        );


                    mergeItems(items);


                    results[index] = {
                        url:
                            pageUrl,
                        doc:
                            pageDoc,
                        parentUrl:
                            job.parentUrl
                    };

                } catch (err) {

                    progress.failed++;


                    console.warn(
                        '[IDM下载助手] 网页嗅探跳过：',
                        job.url,
                        err
                    );

                } finally {

                    done++;

                    progress.processed++;


                    if (
                        done % 2 === 0 ||
                        done ===
                        jobs.length
                    ) {

                        renderResults();

                        updateSelectionCount();
                    }
                }
            }
        }


        await Promise.all(
            Array.from(
                {
                    length:
                        Math.min(
                            CONFIG.sniffConcurrency,
                            jobs.length
                        )
                },
                () =>
                    worker()
            )
        );


        return results
            .filter(Boolean);
    }


    async function startSniffing(
        maxListPages,
        maxDepth,
        pagesPerParent
    ) {

        if (state.scanning) {

           setStatus(
                t(
                    'scanAlreadyRunning'
                )
            );

            return;
        }


        const requestedListPages =
            Number(maxListPages);


        maxListPages =
            Number.isFinite(
                requestedListPages
            )
                ? Math.max(
                    1,
                    Math.floor(
                        requestedListPages
                    )
                )
                : 1;


        maxDepth =
            Math.max(
                1,
                Math.min(
                    3,
                    Number(maxDepth) ||
                    1
                )
            );


        pagesPerParent =
            Math.max(
                1,
                Math.floor(
                    Number(pagesPerParent) ||
                    20
                )
            );


        const rootUrl =
            normalizeUrl(
                location.href
            );


        if (!rootUrl) {

           setStatus(
                t(
                    'sniffInvalidUrl'
                )
            );

            return;
        }


        state.scanning = true;


        const existingUrls =
            new Set(
                state.byUrl.keys()
            );


        const listPages = [];


        const listPageUrls =
            new Set();


        const listVisitedUrls =
            new Set();


        const progress = {
            processed: 0,
            failed: 0
        };


        let level2Pages = [];


        let level3Pages = [];


        let listStopNote = '';


        try {

            let currentDoc =
                document;


            let currentUrl =
                rootUrl;


            for (
                let pageNo = 1;
                pageNo <= maxListPages;
                pageNo++
            ) {

                if (
                    listPageUrls.has(
                        currentUrl
                    )
                ) {

                   listStopNote =
                        t(
                            'sniffStopDuplicate'
                        );

                    break;
                }


                listPageUrls.add(
                    currentUrl
                );


                listVisitedUrls.add(
                    currentUrl
                );


                listPages.push({
                    url:
                        currentUrl,
                    doc:
                        currentDoc
                });


               setStatus(
                    t(
                        'sniffListProgress',
                        {
                            current:
                                pageNo,
                            total:
                                maxListPages
                        }
                    )
                );


                mergeItems(
                    extractItemsFromDocument(
                        currentDoc,
                        currentUrl,
                        currentUrl,
                        1
                    )
                );


                renderResults();


                if (
                    pageNo >=
                    maxListPages
                ) {

                    break;
                }


                const nextUrl =
                    findNextPageUrl(
                        currentDoc,
                        currentUrl,
                        listVisitedUrls
                    );


                if (!nextUrl) {

                   listStopNote =
                        t(
                            'sniffStopNoNext'
                        );

                    break;
                }


                if (
                    !isSameOriginUrl(
                        nextUrl,
                        rootUrl
                    )
                ) {

                   listStopNote =
                        t(
                            'sniffStopOffsite'
                        );

                    break;
                }


                listVisitedUrls.add(
                    nextUrl
                );


                try {

                    const res =
                        await requestText(
                            nextUrl
                        );


                    const finalUrl =
                        normalizeUrl(
                            res.finalUrl ||
                            nextUrl,
                            nextUrl
                        ) ||
                        nextUrl;


                    if (
                        !isSameOriginUrl(
                            finalUrl,
                            rootUrl
                        )
                    ) {

                       listStopNote =
                            t(
                                'sniffStopOffsite'
                            );

                        break;
                    }


                    currentDoc =
                        new DOMParser()
                            .parseFromString(
                                res.text,
                                'text/html'
                            );


                    currentUrl =
                        finalUrl;

                } catch (err) {

                    progress.failed++;


                   listStopNote =
                        t(
                            'sniffStopRequestFailed',
                            {
                                page:
                                    listPages.length +
                                    1
                            }
                        );


                    console.warn(
                        '[IDM下载助手] 列表分页读取停止：',
                        nextUrl,
                        err
                    );


                    break;
                }
            }


            const knownPageUrls =
                new Set(
                    listVisitedUrls
                );


            const resolvedPageUrls =
                new Set(
                    listPageUrls
                );


            if (
                maxDepth >= 2
            ) {

                const level2Jobs =
                    addChildPageJobs(
                        listPages,
                        2,
                        pagesPerParent,
                        rootUrl,
                        knownPageUrls
                    );


                level2Pages =
                    await fetchSniffPageJobs(
                        level2Jobs,
                        2,
                        rootUrl,
                        resolvedPageUrls,
                        progress
                    );


                level2Pages.forEach(
                    page =>
                        knownPageUrls.add(
                            page.url
                        )
                );
            }


            if (
                maxDepth >= 3 &&
                level2Pages.length
            ) {

                const level3Jobs =
                    addChildPageJobs(
                        level2Pages,
                        3,
                        pagesPerParent,
                        rootUrl,
                        knownPageUrls
                    );


                level3Pages =
                    await fetchSniffPageJobs(
                        level3Jobs,
                        3,
                        rootUrl,
                        resolvedPageUrls,
                        progress
                    );
            }


            const newItems =
                state.items
                    .filter(
                        item =>
                            !existingUrls.has(
                                item.url
                            )
                    );


           setStatus(
                t(
                    'sniffMetadata'
                )
            );


            await enrichMissingMetadata(
                newItems
            );


            renderResults();

            updateSelectionCount();


           setStatus(
                t(
                    'sniffComplete',
                    {
                        listDone:
                            listPages.length,
                        listTarget:
                            maxListPages,
                        level2:
                            level2Pages.length,
                        level3:
                            level3Pages.length,
                        added:
                            newItems.length,
                        total:
                            state.items.length,
                        failedPart:
                            progress.failed
                                ? t(
                                    'sniffFailedPart',
                                    {
                                        failed:
                                            progress.failed
                                    }
                                )
                                : '',
                        stopNote:
                            listStopNote,
                        limit:
                            pagesPerParent
                    }
                )
           );

        } catch (err) {

            console.error(
                '[IDM下载助手] 网页嗅探失败：',
                err
            );


            renderResults();

            updateSelectionCount();


           setStatus(
                t(
                    'sniffAborted',
                    {
                        error:
                            err.message ||
                            err,
                        total:
                            state.items.length
                    }
                )
           );

        } finally {

            state.scanning = false;
        }
    }


    /**********************************************************************
     * 9. 勾选及文本筛选
     **********************************************************************/

    function selectedItems() {

        return state.items
            .filter(
                x =>
                    x.selected
            );
    }


    function itemSearchText(item) {

        return [

            item.filename,

            item.originalText,

            item.projectTitle,

            item.sectionTitle,

           item.sourcePage,

           item.sourceDepth
                ? t(
                    'depthPage',
                    {
                        depth:
                            item.sourceDepth
                    }
                )
                : '',

            localizeNameSource(
                item.nameSource
            )
        ]

            .filter(Boolean)

            .join(' ');
    }


    function selectAll(
        value = true
    ) {

        state.items
            .forEach(
                x => {

                    x.selected =
                        value;
                }
            );


        renderResults();

        updateSelectionCount();
    }


    function invertSelection() {

        state.items
            .forEach(
                x => {

                    x.selected =
                        !x.selected;
                }
            );


        renderResults();

        updateSelectionCount();
    }


    function applyTextFilter(text) {

        state.filterText =
            normalizeSpace(
                text
            )
                .toLowerCase();


        renderResults();
    }


    function selectVisible() {

        let count =
            0;


        state.items
            .forEach(
                item => {

                    const visible =

                        !state.filterText ||

                        itemSearchText(item)
                            .toLowerCase()
                            .includes(
                                state.filterText
                            );


                    // “勾选筛选结果”表示只保留当前可见结果。
                    item.selected =
                        visible;


                    if (visible) {

                        count++;
                    }
                }
            );


        renderResults();

        updateSelectionCount();


       setStatus(

            t(
                'selectFilteredStatus',
                {
                    count
                }
            )

       );
    }


    function refreshFilenameAffixes() {

        applyFilenameAffixesToAll();


        renderResults();

        updateSelectionCount();


        const enabled = [];


        if (
            state.filenameAffixes
                .prefixEnabled
        ) {

            const prefix =
                sanitizeFilenameAffix(
                    state.filenameAffixes
                        .prefixText
                );


           enabled.push(
               prefix
                    ? t(
                        'prefixValue',
                        {
                            value:
                                prefix.length > 28
                                    ? `${prefix.slice(0, 28)}…`
                                    : prefix
                        }
                    )
                    : t(
                        'prefixEmpty'
                    )
            );
        }


        if (
            state.filenameAffixes
                .suffixEnabled
        ) {

            const suffix =
                sanitizeFilenameAffix(
                    state.filenameAffixes
                        .suffixText
                );


           enabled.push(
               suffix
                    ? t(
                        'suffixValue',
                        {
                            value:
                                suffix.length > 28
                                    ? `${suffix.slice(0, 28)}…`
                                    : suffix
                        }
                    )
                    : t(
                        'suffixEmpty'
                    )
            );
        }


       setStatus(
           enabled.length
                ? t(
                    'affixEnabled',
                    {
                        enabled:
                            enabled.join(
                                t(
                                    'listSeparator'
                                )
                            ),
                        count:
                            state.items.length
                    }
                )
                : t(
                    'affixDisabled'
                )
       );
    }


    /**********************************************************************
     * 9.5. 外部链接
     **********************************************************************/

    function openExternalUrl(url) {

        const targetUrl =
            String(
                url ||
                ''
            )
                .trim();


        if (
            !/^https?:\/\//i.test(
                targetUrl
            )
        ) {

            return false;
        }


        try {

            if (
                typeof GM_openInTab ===
                'function'
            ) {

                GM_openInTab(
                    targetUrl,
                    {
                        active: true,
                        insert: true,
                        setParent: true
                    }
                );

                return true;
            }

        } catch (_) {}


        try {

            window.open(
                targetUrl,
                '_blank',
                'noopener,noreferrer'
            );

        } catch (_) {

            location.href =
                targetUrl;
        }


        return true;
    }


    function openSupportAuthor() {

        openExternalUrl(
            CONFIG.supportUrl
        );
    }


    function openHelpPage() {

        const helpUrl =
            CONFIG.helpUrls
                ? (
                    CONFIG.helpUrls[
                        UI_LANGUAGE
                    ] ||
                    CONFIG.helpUrls.en
                )
                : '';


        if (
            !openExternalUrl(
                helpUrl
            )
        ) {

            setStatus(
                t(
                    'helpUrlMissing'
                )
            );
        }
    }


    /**********************************************************************
     * 10. IDM
     **********************************************************************/

    function getIdmText(
        items =
        selectedItems()
    ) {

        return items

            .map(
                x =>
                    `${x.filename}\t${x.url}`
            )

            .join(
                '\r\n'
            );
    }


    function getIdmClipboardPayload(items) {

        const plainText =
            items
                .map(
                    item =>
                        `${item.url}\t${sanitizeWindowsFilename(
                            item.filename
                        )}`
                )
                .join('\r\n');


        const html =
            `<div data-idm-download-list="1">${items
                .map(
                    item => {

                        const filename =
                            sanitizeWindowsFilename(
                                item.filename
                            );


                        return `<div><a href="${escapeHtml(
                            item.url
                        )}" download="${escapeHtml(
                            filename
                        )}" title="${escapeHtml(
                            filename
                        )}">${escapeHtml(
                            filename
                        )}</a></div>`;
                    }
                )
                .join('')}</div>`;


        return {
            plainText,
            html
        };
    }


    function copyRichClipboardByEvent(
        plainText,
        html
    ) {

        let copied = false;


        const onCopy =
            event => {

                if (
                    !event.clipboardData
                ) {

                    return;
                }


                event.preventDefault();


                event.clipboardData
                    .setData(
                        'text/plain',
                        plainText
                    );


                event.clipboardData
                    .setData(
                        'text/html',
                        html
                    );


                copied = true;
            };


        document.addEventListener(
            'copy',
            onCopy,
            true
        );


        try {

            document.execCommand(
                'copy'
            );

        } finally {

            document.removeEventListener(
                'copy',
                onCopy,
                true
            );
        }


        return copied;
    }


    async function copySelectedToIdm() {

        const items =
            selectedItems();


        if (
            !items.length
        ) {

           return setStatus(
                t('noSelected')
            );
        }


        const {
            plainText,
            html
        } =
            getIdmClipboardPayload(
                items
            );


        let copiedRich = false;


        try {

            if (
                navigator.clipboard?.write &&
                typeof ClipboardItem !==
                'undefined'
            ) {

                await navigator.clipboard
                    .write([
                        new ClipboardItem({
                            'text/plain':
                                new Blob(
                                    [plainText],
                                    {
                                        type:
                                            'text/plain;charset=utf-8'
                                    }
                                ),
                            'text/html':
                                new Blob(
                                    [html],
                                    {
                                        type:
                                            'text/html;charset=utf-8'
                                    }
                                )
                        })
                    ]);


                copiedRich = true;
            }

        } catch (_) {

            copiedRich = false;
        }


        if (!copiedRich) {

            try {

                copiedRich =
                    copyRichClipboardByEvent(
                        plainText,
                        html
                    );

            } catch (_) {

                copiedRich = false;
            }
        }


       if (copiedRich) {

           setStatus(
                t(
                    'copyRich',
                    {
                        count:
                            items.length
                    }
                )
            );


            return;
        }


        try {

            GM_setClipboard(
                plainText,
                'text'
            );


           setStatus(
                t(
                    'copyPlainFallback',
                    {
                        count:
                            items.length
                    }
                )
            );

        } catch (_) {

            navigator.clipboard

                .writeText(
                    plainText
                )

                .then(

                    () =>

                       setStatus(

                            t(
                                'copyPlain',
                                {
                                    count:
                                        items.length
                                }
                            )

                        ),

                    () =>

                       setStatus(

                            t(
                                'copyFailed'
                            )

                        )
                );
        }
    }


    /**********************************************************************
     * IDM 浏览器插件没有向网页公开“下载全部链接”的调用接口。
     * 这里准备一个只包含选中附件的链接区并自动选中；用户在链接区
     * 使用 IDM 插件的“下载选择的链接”右键命令，即可打开 IDM 原生
     * 批量链接筛选窗口。
     **********************************************************************/

    function selectIdmPluginLinks(container) {

        if (!container) {

            return;
        }


        const selection =
            window.getSelection();


        if (!selection) {

            return;
        }


        const range =
            document.createRange();


        const anchors =
            container.querySelectorAll(
                'a'
            );


        if (
            !anchors.length
        ) {

            return;
        }


        range.setStartBefore(
            anchors[0]
        );

        range.setEndAfter(
            anchors[
                anchors.length - 1
            ]
        );


        selection.removeAllRanges();

        selection.addRange(
            range
        );
    }


    function closeIdmPluginSheet() {

        document.getElementById(
            'wra-idm-plugin-sheet'
        )
            ?.remove();


        window.getSelection()
            ?.removeAllRanges();
    }


    function idmDownloadSelected() {

        const items =
            selectedItems();


        if (
            !items.length
        ) {

           return setStatus(
                t('noSelected')
            );
        }


        closeIdmPluginSheet();


        const sheet =
            document.createElement(
                'div'
            );


        sheet.id =
            'wra-idm-plugin-sheet';


        sheet.lang =
            UI_LANGUAGE;


        applyThemeToElement(
            sheet
        );


        sheet.innerHTML = `

<div id="wra-idm-plugin-dialog">

    <div id="wra-idm-plugin-head">

       <div>
            ${escapeHtml(t('idmSheetTitle'))}
       </div>

       <button
           id="wra-idm-plugin-close"
            title="${escapeHtml(t('close'))}"
        >
            ×
        </button>

    </div>


   <div id="wra-idm-plugin-guide">

        ${t(
            'idmGuide',
            {
                count:
                    items.length
            }
        )}

    </div>


    <div id="wra-idm-plugin-links">

        ${items
            .map(
                (
                    item,
                    index
                ) => `

<a
    href="${escapeHtml(item.url)}"
    download="${escapeHtml(item.filename)}"
    title="${escapeHtml(item.filename)}"
>
    ${index + 1}. ${escapeHtml(item.filename)}
</a>`
            )
            .join('')}

    </div>


    <div id="wra-idm-plugin-actions">

       <button id="wra-idm-plugin-reselect">
            ${escapeHtml(t('idmReselect'))}
       </button>

       <button id="wra-idm-plugin-cancel">
            ${escapeHtml(t('close'))}
        </button>

    </div>

</div>`;


        document.body
            .appendChild(
                sheet
            );


        const links =
            sheet.querySelector(
                '#wra-idm-plugin-links'
            );


        const reselect =
            () =>
                selectIdmPluginLinks(
                    links
                );


        links.addEventListener(
            'click',
            event => {

                if (
                    event.target.closest(
                        'a'
                    )
                ) {

                    event.preventDefault();

                    reselect();
                }
            }
        );


        // 右键发生时再次恢复选区，但不阻止浏览器原生菜单。
        links.addEventListener(
            'mousedown',
            event => {

                if (
                    event.button === 2
                ) {

                    reselect();
                }
            },
            true
        );


        links.addEventListener(
            'contextmenu',
            reselect,
            true
        );


        sheet
            .querySelector(
                '#wra-idm-plugin-reselect'
            )
            .addEventListener(
                'click',
                reselect
            );


        for (
            const selector
            of [
                '#wra-idm-plugin-close',
                '#wra-idm-plugin-cancel'
            ]
        ) {

            sheet
                .querySelector(
                    selector
                )
                .addEventListener(
                    'click',
                    closeIdmPluginSheet
                );
        }


        reselect();


        requestAnimationFrame(
            reselect
        );


       setStatus(
            t(
                'idmReady',
                {
                    count:
                        items.length
                }
            )
       );
    }


    /**********************************************************************
     * 11. TXT / CSV / Excel
     **********************************************************************/

    function timestampName() {

        const d =
            new Date();


        const pad =
            n =>
                String(n)
                    .padStart(
                        2,
                        '0'
                    );


        return (
            `${d.getFullYear()}` +

            `${pad(d.getMonth() + 1)}` +

            `${pad(d.getDate())}_` +

            `${pad(d.getHours())}` +

            `${pad(d.getMinutes())}` +

            `${pad(d.getSeconds())}`
        );
    }


    function downloadBlob(
        content,
        filename,
        mime
    ) {

        const blob =
            content instanceof Blob

                ? content

                : new Blob(

                    [
                        content
                    ],

                    {
                        type:
                            mime
                    }
                );


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                'a'
            );


        a.href =
            url;


        a.download =
            filename;


        document.body
            .appendChild(
                a
            );


        a.click();


        a.remove();


        setTimeout(

            () =>
                URL.revokeObjectURL(
                    url
                ),

            3000
        );
    }


    function exportTxt() {

        const items =
            selectedItems();


        if (
            !items.length
        ) {

           return setStatus(
                t('noSelected')
            );
        }


        downloadBlob(

            '\uFEFF' +
            getIdmText(
                items
            ),

            `${t('exportBase')}_${timestampName()}.txt`,

            'text/plain;charset=utf-8'
        );


       setStatus(

            t(
                'exportedTxt',
                {
                    count:
                        items.length
                }
            )

        );
    }


    function csvCell(value) {

        return (

            '"' +

            String(
                value ??
                ''
            )
                .replace(
                    /"/g,
                    '""'
                ) +

            '"'
        );
    }


    function exportCsv() {

        const items =
            selectedItems();


        if (
            !items.length
        ) {

           return setStatus(
                t('noSelected')
            );
        }


        const rows = [

           [
                t('filenameHeader'),
                t('urlHeader'),
                t('sourcePageHeader'),
                t('depthHeader'),
                t('projectHeader'),
                t('sectionHeader'),
                t('basisHeader')
            ],

            ...items.map(
                x => [

                    x.filename,

                    x.url,

                    x.sourcePage,

                    x.sourceDepth ||
                    1,

                    x.projectTitle,

                    x.sectionTitle,

                    localizeNameSource(
                        x.nameSource
                    )
                ]
            )
        ];


        const csv =
            '\uFEFF' +

            rows

                .map(
                    row =>
                        row

                            .map(
                                csvCell
                            )

                            .join(',')
                )

                .join(
                    '\r\n'
                );


        downloadBlob(

            csv,

            `${t('exportBase')}_${timestampName()}.csv`,

            'text/csv;charset=utf-8'
        );


       setStatus(

            t(
                'exportedCsv',
                {
                    count:
                        items.length
                }
            )

        );
    }


    /**********************************************************************
     * 以下为纯JS生成真正的XLSX
     * 不依赖SheetJS/CDN。
     **********************************************************************/

    function xmlEscape(value) {

        return String(
            value ??
            ''
        )

            .replace(
                /&/g,
                '&amp;'
            )

            .replace(
                /</g,
                '&lt;'
            )

            .replace(
                />/g,
                '&gt;'
            )

            .replace(
                /"/g,
                '&quot;'
            )

            .replace(
                /'/g,
                '&apos;'
            );
    }


    const CRC32_TABLE =
        (() => {

            const table =
                new Uint32Array(
                    256
                );


            for (
                let n = 0;
                n < 256;
                n++
            ) {

                let c =
                    n;


                for (
                    let k = 0;
                    k < 8;
                    k++
                ) {

                    c =
                        (
                            c &
                            1
                        )

                            ? (
                                0xEDB88320 ^
                                (
                                    c >>>
                                    1
                                )
                            )

                            : (
                                c >>>
                                1
                            );
                }


                table[n] =
                    c >>>
                    0;
            }


            return table;
        })();


    function crc32(bytes) {

        let c =
            0xFFFFFFFF;


        for (
            const b
            of bytes
        ) {

            c =
                CRC32_TABLE[
                    (
                        c ^
                        b
                    ) &
                    0xFF
                ] ^
                (
                    c >>>
                    8
                );
        }


        return (
            c ^
            0xFFFFFFFF
        ) >>>
        0;
    }


    function u16(n) {

        return [

            n &
            0xFF,

            (
                n >>>
                8
            ) &
            0xFF
        ];
    }


    function u32(n) {

        return [

            n &
            0xFF,

            (
                n >>>
                8
            ) &
            0xFF,

            (
                n >>>
                16
            ) &
            0xFF,

            (
                n >>>
                24
            ) &
            0xFF
        ];
    }


    function dosDateTime(
        date =
        new Date()
    ) {

        const year =
            Math.max(
                1980,
                date.getFullYear()
            );


        return {

            dosTime:

                (
                    (
                        date.getHours() &
                        0x1F
                    ) <<
                    11
                ) |

                (
                    (
                        date.getMinutes() &
                        0x3F
                    ) <<
                    5
                ) |

                (
                    Math.floor(
                        date.getSeconds() /
                        2
                    ) &
                    0x1F
                ),


            dosDate:

                (
                    (
                        (
                            year -
                            1980
                        ) &
                        0x7F
                    ) <<
                    9
                ) |

                (
                    (
                        (
                            date.getMonth() +
                            1
                        ) &
                        0x0F
                    ) <<
                    5
                ) |

                (
                    date.getDate() &
                    0x1F
                )
        };
    }


    function buildZipStore(files) {

        const enc =
            new TextEncoder();


        const now =
            dosDateTime();


        const localParts =
            [];


        const centralParts =
            [];


        let offset =
            0;


        let centralSize =
            0;


        for (
            const file
            of files
        ) {

            const nameBytes =
                enc.encode(
                    file.name
                );


            const dataBytes =
                typeof file.data ===
                'string'

                    ? enc.encode(
                        file.data
                    )

                    : file.data;


            const crc =
                crc32(
                    dataBytes
                );


            const size =
                dataBytes.length;


            const flags =
                0x0800;


            const localHeader =
                new Uint8Array([

                    ...u32(
                        0x04034B50
                    ),

                    ...u16(20),

                    ...u16(flags),

                    ...u16(0),

                    ...u16(
                        now.dosTime
                    ),

                    ...u16(
                        now.dosDate
                    ),

                    ...u32(crc),

                    ...u32(size),

                    ...u32(size),

                    ...u16(
                        nameBytes.length
                    ),

                    ...u16(0)
                ]);


            localParts.push(

                localHeader,

                nameBytes,

                dataBytes
            );


            const centralHeader =
                new Uint8Array([

                    ...u32(
                        0x02014B50
                    ),

                    ...u16(20),

                    ...u16(20),

                    ...u16(flags),

                    ...u16(0),

                    ...u16(
                        now.dosTime
                    ),

                    ...u16(
                        now.dosDate
                    ),

                    ...u32(crc),

                    ...u32(size),

                    ...u32(size),

                    ...u16(
                        nameBytes.length
                    ),

                    ...u16(0),

                    ...u16(0),

                    ...u16(0),

                    ...u16(0),

                    ...u32(0),

                    ...u32(
                        offset
                    )
                ]);


            centralParts.push(

                centralHeader,

                nameBytes
            );


            offset +=

                localHeader.length +

                nameBytes.length +

                size;


            centralSize +=

                centralHeader.length +

                nameBytes.length;
        }


        const end =
            new Uint8Array([

                ...u32(
                    0x06054B50
                ),

                ...u16(0),

                ...u16(0),

                ...u16(
                    files.length
                ),

                ...u16(
                    files.length
                ),

                ...u32(
                    centralSize
                ),

                ...u32(
                    offset
                ),

                ...u16(0)
            ]);


        return new Blob(

            [
                ...localParts,

                ...centralParts,

                end
            ],

            {
                type:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );
    }


    function excelColumnName(index) {

        let n =
            index +
            1;


        let name =
            '';


        while (
            n > 0
        ) {

            const rem =
                (
                    n -
                    1
                ) %
                26;


            name =
                String.fromCharCode(
                    65 +
                    rem
                ) +
                name;


            n =
                Math.floor(
                    (
                        n -
                        1
                    ) /
                    26
                );
        }


        return name;
    }


    function buildXlsxBlob(rows) {

        const worksheetRows =
            rows

                .map(
                    (
                        row,
                        r
                    ) => {

                        const cells =
                            row

                                .map(
                                    (
                                        value,
                                        c
                                    ) => {

                                        const ref =
                                            `${excelColumnName(c)}${r + 1}`;


                                        return (

                                            `<c r="${ref}" t="inlineStr">` +

                                            `<is><t xml:space="preserve">` +

                                            `${xmlEscape(value)}` +

                                            `</t></is></c>`

                                        );
                                    }
                                )

                                .join('');


                        return (

                            `<row r="${r + 1}">` +

                            `${cells}` +

                            `</row>`

                        );
                    }
                )

                .join('');


        const sheetXml =

            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +

            `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +

            `<sheetData>${worksheetRows}</sheetData>` +

            `</worksheet>`;


        const files = [

            {
                name:
                    '[Content_Types].xml',

                data:

                    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +

                    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +

                    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +

                    `<Default Extension="xml" ContentType="application/xml"/>` +

                    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +

                    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +

                    `</Types>`
            },

            {
                name:
                    '_rels/.rels',

                data:

                    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +

                    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +

                    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +

                    `</Relationships>`
            },

            {
                name:
                    'xl/workbook.xml',

                data:

                    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +

                    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +

                    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +

                    `<sheets>` +

                    `<sheet name="${xmlEscape(
                        t(
                            'attachmentList'
                        )
                    )}" sheetId="1" r:id="rId1"/>` +

                    `</sheets>` +

                    `</workbook>`
            },

            {
                name:
                    'xl/_rels/workbook.xml.rels',

                data:

                    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +

                    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +

                    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +

                    `</Relationships>`
            },

            {
                name:
                    'xl/worksheets/sheet1.xml',

                data:
                    sheetXml
            }
        ];


        return buildZipStore(
            files
        );
    }


    function exportExcel() {

        const items =
            selectedItems();


        if (
            !items.length
        ) {

           return setStatus(
                t('noSelected')
            );
        }


        const rows = [

           [
                t('filenameHeader'),
                t('urlHeader'),
                t('sourcePageHeader'),
                t('depthHeader'),
                t('projectHeader'),
                t('sectionHeader'),
                t('basisHeader')
            ],

            ...items.map(
                x => [

                    x.filename,

                    x.url,

                    x.sourcePage,

                    x.sourceDepth ||
                    1,

                    x.projectTitle,

                    x.sectionTitle,

                    localizeNameSource(
                        x.nameSource
                    )
                ]
            )
        ];


        downloadBlob(

            buildXlsxBlob(
                rows
            ),

            `${t('exportBase')}_${timestampName()}.xlsx`,

            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );


       setStatus(

            t(
                'exportedXlsx',
                {
                    count:
                        items.length
                }
            )

        );
    }


    function clearResults() {

        closeIdmPluginSheet();


        state.items.length =
            0;


        state.byUrl
            .clear();


        renderResults();

        updateSelectionCount();


       setStatus(
            t(
                'cleared'
            )
       );
    }


    /**********************************************************************
     * 12. UI
     **********************************************************************/

    const themeMediaQuery =
        typeof window.matchMedia ===
        'function'
            ? window.matchMedia(
                '(prefers-color-scheme: dark)'
            )
            : null;


    function effectiveThemeMode() {

        if (
            state.themeMode ===
            'dark'
        ) {

            return 'dark';
        }


        if (
            state.themeMode ===
            'light'
        ) {

            return 'light';
        }


        return themeMediaQuery
            ?.matches
            ? 'dark'
            : 'light';
    }


    function applyThemeToElement(element) {

        if (!element) {

            return;
        }


        const dark =
            effectiveThemeMode() ===
            'dark';


        element.classList
            .toggle(
                'wra-theme-dark',
                dark
            );


        element.classList
            .toggle(
                'wra-theme-light',
                !dark
            );
    }


    function applyInterfaceTheme() {

        applyThemeToElement(
            document.getElementById(
                'wra-helper-panel'
            )
        );


        applyThemeToElement(
            document.getElementById(
                'wra-idm-plugin-sheet'
            )
        );
    }


    function persistPanelPosition(panel) {

        const rect =
            panel.getBoundingClientRect();


        state.panelPosition = {
            left:
                Math.max(
                    0,
                    Math.round(
                        rect.left
                    )
                ),
            top:
                Math.max(
                    0,
                    Math.round(
                        rect.top
                    )
                )
        };


        writeStoredValue(
            STORAGE_KEYS.panelPosition,
            state.panelPosition
        );
    }


    function applyStoredPanelPosition(panel) {

        if (
            !state.panelPosition
        ) {

            return;
        }


        const targetWidth =
            state.panelCollapsed
                ? 48
                : panel.offsetWidth;


        const targetHeight =
            state.panelCollapsed
                ? 48
                : panel.offsetHeight;


        const left =
            Math.max(
                0,
                Math.min(
                    Math.max(
                        0,
                        window.innerWidth -
                        targetWidth
                    ),
                    state.panelPosition.left
                )
            );


        const top =
            Math.max(
                0,
                Math.min(
                    Math.max(
                        0,
                        window.innerHeight -
                        targetHeight
                    ),
                    state.panelPosition.top
                )
            );


        panel.style.left =
            left +
            'px';


        panel.style.top =
            top +
            'px';


        panel.style.right =
            'auto';
    }


    function persistUiSettingsFromControls(
        panel,
        normalizeControls =
            true
    ) {

        const pagesInput =
            panel.querySelector(
                '#wra-pages'
            );


        const depthSelect =
            panel.querySelector(
                '#wra-sniff-depth'
            );


        const childPagesInput =
            panel.querySelector(
                '#wra-sniff-pages'
            );


        const parsePositiveInteger =
            value => {

                const number =
                    Number.parseInt(
                        value,
                        10
                    );


                return Number.isFinite(
                    number
                ) &&
                    number >= 1
                    ? number
                    : null;
            };


        const listPages =
            parsePositiveInteger(
                pagesInput?.value
            );


        const childPages =
            parsePositiveInteger(
                childPagesInput?.value
            );


        if (
            normalizeControls ||
            listPages !== null
        ) {

            state.uiSettings
                .listPages =
                listPages ??
                1;
        }


        state.uiSettings
            .sniffDepth =
            normalizeSniffDepth(
                depthSelect?.value
            );


        if (
            normalizeControls ||
            childPages !== null
        ) {

            state.uiSettings
                .sniffChildPages =
                childPages ??
                20;
        }


        if (
            normalizeControls &&
            pagesInput
        ) {

            pagesInput.value =
                String(
                    state.uiSettings
                        .listPages
                );
        }


        if (
            normalizeControls &&
            depthSelect
        ) {

            depthSelect.value =
                state.uiSettings
                    .sniffDepth;
        }


        if (
            normalizeControls &&
            childPagesInput
        ) {

            childPagesInput.value =
                String(
                    state.uiSettings
                        .sniffChildPages
                );
        }


        writeStoredValue(
            STORAGE_KEYS.listPages,
            state.uiSettings
                .listPages
        );


        writeStoredValue(
            STORAGE_KEYS.sniffDepth,
            state.uiSettings
                .sniffDepth
        );


        writeStoredValue(
            STORAGE_KEYS.sniffChildPages,
            state.uiSettings
                .sniffChildPages
        );
    }


    function createPanel() {

        if (
            document.getElementById(
                'wra-helper-panel'
            )
        ) {

            return;
        }


        const suggestedPrefix =
            sanitizeFilenameAffix(
                detectProjectTitle(
                    document
                )
            );


        if (
            !state.filenameAffixes
                .prefixText &&
            suggestedPrefix
        ) {

            state.filenameAffixes
                .prefixText =
                `${suggestedPrefix}_`;
        }


        const style =
            document.createElement(
                'style'
            );


        style.textContent = `

#wra-helper-panel,
#wra-idm-plugin-sheet{
    --wra-bg:#ffffff;
    --wra-text:#1f2328;
    --wra-border:#cfd5dd;
    --wra-shadow:0 8px 30px rgba(0,0,0,.18);
    --wra-head-bg:#f5f7fa;
    --wra-head-border:#e5e8ec;
    --wra-muted:#667085;
    --wra-subtle:#8a9099;
    --wra-label:#555555;
    --wra-button-bg:#ffffff;
    --wra-button-text:#222222;
    --wra-button-border:#c9d0d8;
    --wra-hover-bg:#f0f5ff;
    --wra-hover-border:#8bb4f8;
    --wra-input-bg:#ffffff;
    --wra-input-text:#1f2328;
    --wra-input-border:#c9d0d8;
    --wra-input-disabled-bg:#f4f5f6;
    --wra-input-disabled-text:#8a9099;
    --wra-list-bg:#fafbfc;
    --wra-item-bg:#ffffff;
    --wra-item-border:#eceff2;
    --wra-name-hover-bg:#f9fcff;
    --wra-machine-bg:#fff7e6;
    --wra-machine-border:#ffd591;
    --wra-status-bg:#f6f8fa;
    --wra-status-text:#555555;
    --wra-link:#667085;
    --wra-primary:#1677ff;
    --wra-primary-text:#ffffff;
    --wra-idm:#00a870;
    --wra-idm-hover:#009461;
    --wra-support:#ff5f5f;
    --wra-warn-bg:#fff7e6;
    --wra-warn-border:#ffc069;
    --wra-guide-bg:#fffbe6;
    --wra-guide-border:#f0e5a6;
    --wra-plugin-links-bg:#f7faff;
    --wra-plugin-link-border:#e3ebf7;
}

#wra-helper-panel.wra-theme-dark,
#wra-idm-plugin-sheet.wra-theme-dark{
    --wra-bg:#1f2328;
    --wra-text:#f0f3f7;
    --wra-border:#46515f;
    --wra-shadow:0 10px 34px rgba(0,0,0,.48);
    --wra-head-bg:#292f38;
    --wra-head-border:#3a4350;
    --wra-muted:#a9b3c1;
    --wra-subtle:#8d99a8;
    --wra-label:#c2cad6;
    --wra-button-bg:#2b333d;
    --wra-button-text:#f0f3f7;
    --wra-button-border:#4a5564;
    --wra-hover-bg:#263a56;
    --wra-hover-border:#5d8fd6;
    --wra-input-bg:#171b21;
    --wra-input-text:#f3f6fa;
    --wra-input-border:#4a5564;
    --wra-input-disabled-bg:#242a32;
    --wra-input-disabled-text:#8792a0;
    --wra-list-bg:#171b21;
    --wra-item-bg:#232a33;
    --wra-item-border:#343d49;
    --wra-name-hover-bg:#1f3148;
    --wra-machine-bg:#4a341b;
    --wra-machine-border:#b7791f;
    --wra-status-bg:#171b21;
    --wra-status-text:#c8d1dc;
    --wra-link:#9fbbdf;
    --wra-warn-bg:#4a341b;
    --wra-warn-border:#b7791f;
    --wra-guide-bg:#342f18;
    --wra-guide-border:#6f632b;
    --wra-plugin-links-bg:#171f2b;
    --wra-plugin-link-border:#2d3b4c;
}

#wra-helper-panel.wra-theme-light,
#wra-idm-plugin-sheet.wra-theme-light{
    color-scheme:light;
}

#wra-helper-panel.wra-theme-dark,
#wra-idm-plugin-sheet.wra-theme-dark{
    color-scheme:dark;
}

#wra-helper-panel{
    position:fixed;
    right:16px;
    top:72px;
    width:520px;
    max-height:84vh;
    background:var(--wra-bg);
    color:var(--wra-text);
    border:1px solid var(--wra-border);
    border-radius:10px;
    box-shadow:var(--wra-shadow);
    z-index:2147483646;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif;
    font-size:13px;
    overflow:hidden;
}

#wra-helper-panel *{
    box-sizing:border-box;
}

#wra-helper-head{
    height:42px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 10px 0 12px;
    background:var(--wra-head-bg);
    border-bottom:1px solid var(--wra-head-border);
    cursor:move;
    user-select:none;
}

#wra-helper-title{
    font-weight:700;
    font-size:14px;
}

#wra-helper-titlebar{
    display:flex;
    align-items:center;
    min-width:0;
}

#wra-helper-actions{
    display:flex;
    align-items:center;
    gap:2px;
}

#wra-theme-wrap{
    display:inline-flex;
    align-items:center;
    gap:4px;
    margin-left:10px;
    color:var(--wra-label);
    font-size:12px;
    white-space:nowrap;
}

#wra-theme-select{
    width:76px;
    padding:3px 5px;
    border:1px solid var(--wra-input-border);
    border-radius:6px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
    font-family:inherit;
    font-size:12px;
}

#wra-mini-icon{
    display:none;
}

#wra-helper-head button{
    border:0;
    background:transparent;
    font-size:18px;
    cursor:pointer;
    padding:2px 6px;
    color:var(--wra-label);
}

#wra-helper-body{
    padding:10px;
    overflow:hidden;
}

#wra-helper-panel.collapsed{
    width:48px;
    height:48px;
    max-height:48px;
    border-radius:50%;
    border-color:var(--wra-idm);
}

#wra-helper-panel.collapsed #wra-helper-head{
    height:48px;
    padding:0;
    justify-content:center;
    border-bottom:0;
    border-radius:50%;
    background:var(--wra-idm);
}

#wra-helper-panel.collapsed #wra-helper-title,
#wra-helper-panel.collapsed #wra-helper-titlebar,
#wra-helper-panel.collapsed #wra-helper-actions,
#wra-helper-panel.collapsed #wra-helper-body{
    display:none;
}

#wra-helper-panel.collapsed #wra-mini-icon{
    display:flex;
    align-items:center;
    justify-content:center;
    width:100%;
    height:100%;
    border:0;
    border-radius:50%;
    background:var(--wra-idm);
    color:var(--wra-primary-text);
    font-size:11px;
    font-weight:800;
    letter-spacing:0;
    padding:0;
}

#wra-helper-panel.collapsed #wra-mini-icon:hover{
    background:var(--wra-idm-hover);
}

#wra-helper-toolbar,
#wra-sniffbar,
#wra-selectbar,
#wra-exportbar{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-bottom:7px;
    align-items:center;
}

#wra-affixbar{
    display:grid;
    grid-template-columns:auto minmax(110px,1fr) auto minmax(110px,1fr);
    gap:6px;
    margin-bottom:7px;
    align-items:center;
}

#wra-affixbar label{
    display:inline-flex;
    align-items:center;
    gap:3px;
    white-space:nowrap;
    color:var(--wra-label);
}

#wra-prefix-text,
#wra-suffix-text{
    width:100%;
    min-width:0;
    padding:6px 8px;
    border:1px solid var(--wra-input-border);
    border-radius:6px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
}

#wra-prefix-text:disabled,
#wra-suffix-text:disabled{
    background:var(--wra-input-disabled-bg);
    color:var(--wra-input-disabled-text);
}

#wra-helper-panel button{
    border:1px solid var(--wra-button-border);
    background:var(--wra-button-bg);
    border-radius:6px;
    padding:6px 9px;
    cursor:pointer;
    color:var(--wra-button-text);
    font-family:inherit;
}

#wra-helper-panel button:hover{
    background:var(--wra-hover-bg);
    border-color:var(--wra-hover-border);
}

#wra-helper-panel button.primary{
    background:var(--wra-primary);
    color:var(--wra-primary-text);
    border-color:var(--wra-primary);
}

#wra-helper-panel button.idm{
    background:var(--wra-idm);
    color:var(--wra-primary-text);
    border-color:var(--wra-idm);
    font-weight:600;
}

#wra-helper-panel button.support{
    background:var(--wra-support);
    color:var(--wra-primary-text);
    border-color:var(--wra-support);
    font-weight:600;
}

#wra-helper-panel button.warn{
    background:var(--wra-warn-bg);
    border-color:var(--wra-warn-border);
}

#wra-pages,
#wra-sniff-pages{
    width:54px;
    padding:5px;
    border:1px solid var(--wra-input-border);
    border-radius:6px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
}

#wra-sniff-depth{
    width:72px;
    padding:5px;
    border:1px solid var(--wra-input-border);
    border-radius:6px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
}

#wra-filter{
    flex:1;
    min-width:160px;
    padding:6px 8px;
    border:1px solid var(--wra-input-border);
    border-radius:6px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
}

#wra-helper-info{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    margin:6px 0 8px;
}

#wra-helper-count{
    font-weight:700;
}

#wra-selection-count{
    color:var(--wra-primary);
    font-weight:700;
    margin-left:8px;
}

#wra-helper-list{
    max-height:43vh;
    overflow:auto;
    border:1px solid var(--wra-head-border);
    border-radius:6px;
    background:var(--wra-list-bg);
}

.wra-item{
    display:grid;
    grid-template-columns:24px minmax(0,1fr);
    gap:5px;
    padding:8px;
    border-bottom:1px solid var(--wra-item-border);
    background:var(--wra-item-bg);
}

.wra-item:last-child{
    border-bottom:0;
}

.wra-item.hidden{
    display:none;
}

.wra-check{
    margin-top:7px;
}

.wra-main{
    min-width:0;
}

.wra-name-input{
    width:100%;
    font-weight:600;
    line-height:1.4;
    border:1px solid transparent;
    border-radius:4px;
    padding:4px 5px;
    background:var(--wra-input-bg);
    color:var(--wra-input-text);
    font-family:inherit;
    font-size:13px;
}

.wra-name-input:hover,
.wra-name-input:focus{
    border-color:var(--wra-hover-border);
    outline:none;
    background:var(--wra-name-hover-bg);
}

.wra-machine{
    background:var(--wra-machine-bg)!important;
    border-color:var(--wra-machine-border)!important;
}

.wra-url{
    margin-top:3px;
    font-size:11px;
    line-height:1.35;
    color:var(--wra-muted);
    word-break:break-all;
    max-height:32px;
    overflow:hidden;
}

.wra-url a{
    color:var(--wra-link);
    text-decoration:none;
}

.wra-url a:hover{
    text-decoration:underline;
}

.wra-meta{
    margin-top:3px;
    font-size:11px;
    color:var(--wra-subtle);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
}

#wra-helper-status{
    margin-top:8px;
    padding:7px 8px;
    border-radius:6px;
    background:var(--wra-status-bg);
    color:var(--wra-status-text);
    line-height:1.4;
    min-height:30px;
}

#wra-idm-plugin-sheet{
    position:fixed;
    inset:0;
    z-index:2147483647;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    background:rgba(18,23,31,.62);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif;
    color:var(--wra-text);
}

#wra-idm-plugin-sheet *{
    box-sizing:border-box;
}

#wra-idm-plugin-dialog{
    width:min(820px,94vw);
    max-height:88vh;
    overflow:hidden;
    background:var(--wra-bg);
    border-radius:10px;
    box-shadow:var(--wra-shadow);
}

#wra-idm-plugin-head{
    height:46px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 10px 0 16px;
    border-bottom:1px solid var(--wra-head-border);
    background:var(--wra-head-bg);
    font-size:15px;
    font-weight:700;
}

#wra-idm-plugin-head button{
    border:0;
    background:transparent;
    color:var(--wra-label);
    font-size:23px;
    cursor:pointer;
}

#wra-idm-plugin-guide{
    padding:12px 16px;
    line-height:1.65;
    background:var(--wra-guide-bg);
    border-bottom:1px solid var(--wra-guide-border);
    font-size:13px;
}

#wra-idm-plugin-links{
    max-height:56vh;
    overflow:auto;
    padding:8px 12px;
    background:var(--wra-plugin-links-bg);
    user-select:text;
    cursor:context-menu;
}

#wra-idm-plugin-links a{
    display:block;
    padding:6px 8px;
    border-bottom:1px solid var(--wra-plugin-link-border);
    color:var(--wra-link);
    text-decoration:none;
    font-size:13px;
    line-height:1.4;
    word-break:break-all;
    user-select:text;
}

#wra-idm-plugin-links a:last-child{
    border-bottom:0;
}

#wra-idm-plugin-links ::selection{
    color:var(--wra-primary-text);
    background:var(--wra-primary);
}

#wra-idm-plugin-actions{
    display:flex;
    justify-content:flex-end;
    gap:8px;
    padding:10px 14px;
    border-top:1px solid var(--wra-head-border);
}

#wra-idm-plugin-actions button{
    border:1px solid var(--wra-button-border);
    border-radius:6px;
    padding:7px 12px;
    background:var(--wra-button-bg);
    color:var(--wra-button-text);
    cursor:pointer;
    font-family:inherit;
}

#wra-idm-plugin-actions button:first-child{
    border-color:var(--wra-primary);
    background:var(--wra-primary);
    color:var(--wra-primary-text);
}

.wra-label{
    font-size:12px;
    color:var(--wra-label);
}
`;


        document.documentElement
            .appendChild(
                style
            );


        const panel =
            document.createElement(
                'div'
            );


       panel.id =
           'wra-helper-panel';

        panel.lang =
            UI_LANGUAGE;


        panel.dataset.language =
            UI_LANGUAGE;


        panel.innerHTML = `

<div id="wra-helper-head">

    <button
        id="wra-mini-icon"
        title="${escapeHtml(t('collapseExpand'))}"
        aria-label="${escapeHtml(t('collapseExpand'))}"
    >
        IDM
    </button>

    <div id="wra-helper-titlebar">

        <div id="wra-helper-title">
            ${escapeHtml(t('appTitle'))}
        </div>


        <label
            id="wra-theme-wrap"
            title="${escapeHtml(t('themeTitle'))}"
        >
            ${escapeHtml(t('theme'))}
            <select id="wra-theme-select">
                <option value="auto">${escapeHtml(t('themeAuto'))}</option>
                <option value="dark">${escapeHtml(t('themeDark'))}</option>
                <option value="light">${escapeHtml(t('themeLight'))}</option>
            </select>
        </label>

    </div>

    <div id="wra-helper-actions">

        <button
            id="wra-collapse"
            title="${escapeHtml(t('collapseExpand'))}"
        >
            −
        </button>

        <button
            id="wra-close"
            title="${escapeHtml(t('hideWindow'))}"
        >
            ×
        </button>

    </div>

</div>


<div id="wra-helper-body">

    <div id="wra-helper-toolbar">

        <span class="wra-label">

            ${escapeHtml(t('fetch'))}

            <input
                id="wra-pages"
                type="number"
                min="1"
                step="1"
                value="${escapeHtml(state.uiSettings.listPages)}"
            >

            ${escapeHtml(t('listPages'))}

        </span>


        <span class="wra-label">

            ${escapeHtml(t('sniffDepth'))}

            <select id="wra-sniff-depth">
                <option value="1" ${state.uiSettings.sniffDepth === '1' ? 'selected' : ''}>${escapeHtml(t('level1'))}</option>
                <option value="2" ${state.uiSettings.sniffDepth === '2' ? 'selected' : ''}>${escapeHtml(t('level2'))}</option>
                <option value="3" ${state.uiSettings.sniffDepth === '3' ? 'selected' : ''}>${escapeHtml(t('level3'))}</option>
            </select>

        </span>


        <span
            class="wra-label"
            title="${escapeHtml(t('perLevelTooltip'))}"
        >

            ${escapeHtml(t('perLevelMax'))}

            <input
                id="wra-sniff-pages"
                type="number"
                min="1"
                step="1"
                value="${escapeHtml(state.uiSettings.sniffChildPages)}"
            >

            ${escapeHtml(t('childPages'))}

        </span>

    </div>


    <div id="wra-sniffbar">

        <button
            class="primary"
            id="wra-start-sniff"
            title="${escapeHtml(t('startSniffTitle'))}"
        >
            ${escapeHtml(t('startSniff'))}
        </button>


        <button
            class="primary"
            id="wra-copy"
        >
            ${escapeHtml(t('copySelectedIdm'))}
        </button>


        <button
            class="idm"
            id="wra-idm-download"
            title="${escapeHtml(t('prepareIdmTitle'))}"
        >
            ${escapeHtml(t('prepareIdm'))}
        </button>


        <button
            class="support"
            id="wra-support"
            title="${escapeHtml(t('supportAuthorTitle'))}"
        >
            ${escapeHtml(t('supportAuthor'))}
        </button>


        <button
            id="wra-help"
            title="${escapeHtml(t('helpTitle'))}"
        >
            ${escapeHtml(t('help'))}
        </button>

    </div>


    <div id="wra-selectbar">

        <button id="wra-all">
            ${escapeHtml(t('selectAll'))}
        </button>


        <button id="wra-none">
            ${escapeHtml(t('selectNone'))}
        </button>


        <button id="wra-invert">
            ${escapeHtml(t('invert'))}
        </button>


        <input
            id="wra-filter"
            type="text"
            placeholder="${escapeHtml(t('filterPlaceholder'))}"
        >


        <button id="wra-select-visible">
            ${escapeHtml(t('selectFiltered'))}
        </button>

    </div>


    <div id="wra-affixbar">

       <label
           for="wra-prefix-enabled"
            title="${escapeHtml(t('prefixToggleTitle'))}"
        >
            <input
                id="wra-prefix-enabled"
                type="checkbox"
            >
            ${escapeHtml(t('prefix'))}
        </label>


        <input
            id="wra-prefix-text"
           type="text"
           value="${escapeHtml(state.filenameAffixes.prefixText)}"
            placeholder="${escapeHtml(t('prefixPlaceholder'))}"
            title="${escapeHtml(t('prefixInputTitle'))}"
        >


       <label
           for="wra-suffix-enabled"
            title="${escapeHtml(t('suffixToggleTitle'))}"
        >
            <input
                id="wra-suffix-enabled"
                type="checkbox"
            >
            ${escapeHtml(t('suffix'))}
        </label>


        <input
            id="wra-suffix-text"
           type="text"
           value="${escapeHtml(state.filenameAffixes.suffixText)}"
            placeholder="${escapeHtml(t('suffixPlaceholder'))}"
            title="${escapeHtml(t('suffixInputTitle'))}"
        >

    </div>


    <div id="wra-exportbar">


       <button id="wra-txt">
            ${escapeHtml(t('exportTxt'))}
        </button>


       <button id="wra-csv">
            ${escapeHtml(t('exportCsv'))}
        </button>


       <button id="wra-xls">
            ${escapeHtml(t('exportExcel'))}
        </button>


       <button id="wra-clear">
            ${escapeHtml(t('clear'))}
        </button>

    </div>


    <div id="wra-helper-info">

        <div>

           <span id="wra-helper-count">
                ${escapeHtml(t('found', { count: 0 }))}
            </span>


           <span id="wra-selection-count">
                ${escapeHtml(t('selected', { count: 0 }))}
            </span>

        </div>

    </div>


    <div id="wra-helper-list">
    </div>


   <div id="wra-helper-status">

        ${escapeHtml(t('initialStatus'))}

    </div>

</div>
`;


        document.body
            .appendChild(
                panel
            );


        applyInterfaceTheme();


        const themeSelect =
            panel.querySelector(
                '#wra-theme-select'
            );


        if (themeSelect) {

            themeSelect.value =
                state.themeMode;


            themeSelect.addEventListener(
                'change',
                e => {

                    state.themeMode =
                        normalizeThemeMode(
                            e.target.value
                        );


                    e.target.value =
                        state.themeMode;


                    writeStoredValue(
                        STORAGE_KEYS.themeMode,
                        state.themeMode
                    );


                    applyInterfaceTheme();
                }
            );
        }


        if (
            themeMediaQuery &&
            typeof themeMediaQuery.addEventListener ===
            'function'
        ) {

            themeMediaQuery.addEventListener(
                'change',
                () => {

                    if (
                        state.themeMode ===
                        'auto'
                    ) {

                        applyInterfaceTheme();
                    }
                }
            );
        } else if (
            themeMediaQuery &&
            typeof themeMediaQuery.addListener ===
            'function'
        ) {

            themeMediaQuery.addListener(
                () => {

                    if (
                        state.themeMode ===
                        'auto'
                    ) {

                        applyInterfaceTheme();
                    }
                }
            );
        }


        [
            '#wra-pages',
            '#wra-sniff-depth',
            '#wra-sniff-pages'
        ]
            .forEach(
                selector => {

                    const input =
                        panel.querySelector(
                            selector
                        );


                    if (!input) {

                        return;
                    }


                    input.addEventListener(
                        'change',
                        () =>
                            persistUiSettingsFromControls(
                                panel
                            )
                    );


                    if (
                        input.matches(
                            'input'
                        )
                    ) {

                        input.addEventListener(
                            'input',
                            () =>
                                persistUiSettingsFromControls(
                                    panel,
                                    false
                                )
                        );
                    }
                }
            );


        /******************************************************************
         * 按钮事件
         ******************************************************************/

        panel
            .querySelector(
                '#wra-start-sniff'
            )
            .addEventListener(
                'click',
                () => {

                    persistUiSettingsFromControls(
                        panel
                    );


                    return startSniffing(
                        state.uiSettings
                            .listPages,
                        state.uiSettings
                            .sniffDepth,
                        state.uiSettings
                            .sniffChildPages
                    );
                }
            );


        panel
            .querySelector(
                '#wra-copy'
            )
            .addEventListener(
                'click',
                copySelectedToIdm
            );


        panel
            .querySelector(
                '#wra-idm-download'
            )
            .addEventListener(
                'click',
                idmDownloadSelected
            );


        const prefixEnabledInput =
            panel.querySelector(
                '#wra-prefix-enabled'
            );


        const prefixTextInput =
            panel.querySelector(
                '#wra-prefix-text'
            );


        const suffixEnabledInput =
            panel.querySelector(
                '#wra-suffix-enabled'
            );


        const suffixTextInput =
            panel.querySelector(
                '#wra-suffix-text'
            );


        let filenameAffixInputTimer =
            null;


        const readFilenameAffixInputs =
            () => {

                state.filenameAffixes
                    .prefixEnabled =
                    prefixEnabledInput.checked;


                state.filenameAffixes
                    .prefixText =
                    prefixTextInput.value;


                state.filenameAffixes
                    .suffixEnabled =
                    suffixEnabledInput.checked;


                state.filenameAffixes
                    .suffixText =
                    suffixTextInput.value;
            };


        const applyFilenameAffixInputs =
            () => {

                clearTimeout(
                    filenameAffixInputTimer
                );


                readFilenameAffixInputs();

                refreshFilenameAffixes();
            };


        prefixEnabledInput
            .addEventListener(
                'change',
                applyFilenameAffixInputs
            );


        suffixEnabledInput
            .addEventListener(
                'change',
                applyFilenameAffixInputs
            );


        [
            prefixTextInput,
            suffixTextInput
        ]
            .forEach(
                input => {

                    input.addEventListener(
                        'input',
                        () => {

                            readFilenameAffixInputs();


                            const enabled =
                                input ===
                                prefixTextInput
                                    ? prefixEnabledInput
                                        .checked
                                    : suffixEnabledInput
                                        .checked;


                            if (!enabled) {

                                return;
                            }


                            clearTimeout(
                                filenameAffixInputTimer
                            );


                            filenameAffixInputTimer =
                                setTimeout(
                                    refreshFilenameAffixes,
                                    160
                                );
                        }
                    );


                    input.addEventListener(
                        'change',
                        () => {

                            input.value =
                                sanitizeFilenameAffix(
                                    input.value
                                );


                            readFilenameAffixInputs();


                            const enabled =
                                input ===
                                prefixTextInput
                                    ? prefixEnabledInput
                                        .checked
                                    : suffixEnabledInput
                                        .checked;


                            if (enabled) {

                                applyFilenameAffixInputs();
                            }
                        }
                    );
                }
            );


        panel
            .querySelector(
                '#wra-txt'
            )
            .addEventListener(
                'click',
                exportTxt
            );


        panel
            .querySelector(
                '#wra-csv'
            )
            .addEventListener(
                'click',
                exportCsv
            );


        panel
            .querySelector(
                '#wra-xls'
            )
            .addEventListener(
                'click',
                exportExcel
            );


        panel
            .querySelector(
                '#wra-clear'
            )
            .addEventListener(
                'click',
                clearResults
            );


        panel
            .querySelector(
                '#wra-support'
            )
            .addEventListener(
                'click',
                openSupportAuthor
            );


        panel
            .querySelector(
                '#wra-help'
            )
            .addEventListener(
                'click',
                openHelpPage
            );


        panel
            .querySelector(
                '#wra-all'
            )
            .addEventListener(

                'click',

                () =>
                    selectAll(
                        true
                    )
            );


        panel
            .querySelector(
                '#wra-none'
            )
            .addEventListener(

                'click',

                () =>
                    selectAll(
                        false
                    )
            );


        panel
            .querySelector(
                '#wra-invert'
            )
            .addEventListener(
                'click',
                invertSelection
            );


        panel
            .querySelector(
                '#wra-select-visible'
            )
            .addEventListener(
                'click',
                selectVisible
            );


        panel
            .querySelector(
                '#wra-filter'
            )
            .addEventListener(

                'input',

                e =>
                    applyTextFilter(
                        e.target.value
                    )
            );


        /******************************************************************
         * 文件列表事件委托
         ******************************************************************/

        panel
            .querySelector(
                '#wra-helper-list'
            )
            .addEventListener(

                'change',

                e => {

                    const row =
                        e.target.closest(
                            '.wra-item'
                        );


                    if (!row) {

                        return;
                    }


                    const item =
                        state.items
                            .find(
                                x =>
                                    x.id ===
                                    row.dataset.id
                            );


                    if (!item) {

                        return;
                    }


                    // 勾选。
                    if (
                        e.target.matches(
                            '.wra-check'
                        )
                    ) {

                        item.selected =
                            e.target.checked;


                        updateSelectionCount();

                    }

                    // 手工修改最终文件名。
                    else if (
                        e.target.matches(
                            '.wra-name-input'
                        )
                    ) {

                        item.filename =
                            sanitizeWindowsFilename(

                                e.target.value
                            );


                        applyFilenameAffixesToItem(
                            item
                        );


                        e.target.value =
                            item.filename;


                        e.target.classList
                            .toggle(

                                'wra-machine',

                                isMachineFilename(
                                    filenameWithoutAppliedAffixes(
                                        item
                                    )
                                )
                            );
                    }
                }
            );


        panel
            .querySelector(
                '#wra-helper-list'
            )
            .addEventListener(

                'input',

                e => {

                    if (
                        !e.target.matches(
                            '.wra-name-input'
                        )
                    ) {

                        return;
                    }


                    const row =
                        e.target.closest(
                            '.wra-item'
                        );


                    const item =
                        state.items
                            .find(
                                x =>
                                    x.id ===
                                    row?.dataset.id
                            );


                    if (item) {

                        item.filename =
                            e.target.value;
                    }
                }
            );


        /******************************************************************
         * 收起 / 隐藏
         ******************************************************************/

        const collapseButton =
            panel.querySelector(
                '#wra-collapse'
            );


        const miniIcon =
            panel.querySelector(
                '#wra-mini-icon'
            );


        const setPanelCollapsed =
            collapsed => {

                state.panelCollapsed =
                    Boolean(
                        collapsed
                    );


                panel.classList
                    .toggle(

                        'collapsed',

                        state.panelCollapsed
                    );


                collapseButton.textContent =
                    state.panelCollapsed
                        ? '+'
                        : '−';


                writeStoredValue(
                    STORAGE_KEYS.panelCollapsed,
                    state.panelCollapsed
                );
            };


        setPanelCollapsed(
            state.panelCollapsed
        );


        applyStoredPanelPosition(
            panel
        );


        collapseButton
            .addEventListener(

                'click',

                () =>
                    setPanelCollapsed(
                        !state.panelCollapsed
                    )
            );


        miniIcon
            .addEventListener(

                'click',

                e => {

                    e.stopPropagation();


                    if (
                        panel.dataset
                            .wraDragMoved ===
                        '1'
                    ) {

                        return;
                    }


                    setPanelCollapsed(
                        false
                    );
                }
            );


        panel
            .querySelector(
                '#wra-close'
            )
            .addEventListener(

                'click',

                () => {

                    panel.style.display =
                        'none';
                }
            );


        makePanelDraggable(

            panel,

            panel.querySelector(
                '#wra-helper-head'
            )
        );
    }


    function makePanelDraggable(
        panel,
        handle
    ) {

        let dragging =
            false;


        let startX =
            0;


        let startY =
            0;


        let startLeft =
            0;


        let startTop =
            0;


        let moved =
            false;


        handle.addEventListener(

            'mousedown',

            e => {

                const miniDrag =
                    panel.classList
                        .contains(
                            'collapsed'
                        ) &&
                    e.target.closest(
                        '#wra-mini-icon'
                    );


                if (
                    !miniDrag &&
                    e.target.closest(
                        'button,input,select,textarea,label,a'
                    )
                ) {

                    return;
                }


                dragging =
                    true;


                moved =
                    false;


                panel.dataset
                    .wraDragMoved =
                    '0';


                const rect =
                    panel.getBoundingClientRect();


                startX =
                    e.clientX;


                startY =
                    e.clientY;


                startLeft =
                    rect.left;


                startTop =
                    rect.top;


                panel.style.right =
                    'auto';


                e.preventDefault();
            }
        );


        document.addEventListener(

            'mousemove',

            e => {

                if (
                    !dragging
                ) {

                    return;
                }


                const deltaX =
                    e.clientX -
                    startX;


                const deltaY =
                    e.clientY -
                    startY;


                if (
                    Math.abs(
                        deltaX
                    ) +
                    Math.abs(
                        deltaY
                    ) >
                    3
                ) {

                    moved =
                        true;


                    panel.dataset
                        .wraDragMoved =
                        '1';
                }


                const left =
                    Math.max(

                        0,

                        Math.min(

                            window.innerWidth -
                            panel.offsetWidth,

                            startLeft +
                            deltaX
                        )
                    );


                const top =
                    Math.max(

                        0,

                        Math.min(

                            window.innerHeight -
                            panel.offsetHeight,

                            startTop +
                            deltaY
                        )
                    );


                panel.style.left =
                    left +
                    'px';


                panel.style.top =
                    top +
                    'px';
            }
        );


        document.addEventListener(

            'mouseup',

            () => {

                if (
                    !dragging
                ) {

                    return;
                }


                dragging =
                    false;


                if (moved) {

                    persistPanelPosition(
                        panel
                    );
                }


                setTimeout(
                    () => {

                        delete panel.dataset
                            .wraDragMoved;
                    },
                    0
                );
            }
        );
    }


    function setStatus(text) {

        const el =
            document.getElementById(
                'wra-helper-status'
            );


        if (el) {

            el.textContent =
                text;
        }
    }


    function updateSelectionCount() {

        const count =
            document.getElementById(
                'wra-selection-count'
            );


        if (count) {

           count.textContent =
                t(
                    'selected',
                    {
                        count:
                            selectedItems().length
                    }
                );
        }
    }


    function renderResults() {

        const count =
            document.getElementById(
                'wra-helper-count'
            );


        const list =
            document.getElementById(
                'wra-helper-list'
            );


        if (
            !count ||
            !list
        ) {

            return;
        }


       count.textContent =
            t(
                'found',
                {
                    count:
                        state.items.length
                }
            );


        updateSelectionCount();


        if (
            !state.items.length
        ) {

           list.innerHTML =

                `<div style="padding:18px;text-align:center;color:var(--wra-subtle)">${escapeHtml(
                    t(
                        'emptyResults'
                    )
                )}</div>`;


            return;
        }


        list.innerHTML =
            state.items

                .map(
                    (
                        x,
                        i
                    ) => {

                        const text =
                            itemSearchText(x)
                                .toLowerCase();


                        const hidden =

                            state.filterText &&

                            !text.includes(
                                state.filterText
                            );


                        const machine =
                            isMachineFilename(
                                filenameWithoutAppliedAffixes(
                                    x
                                )
                            );


                        const meta =
                            [

                                x.projectTitle,

                               x.sectionTitle,

                               x.sourceDepth > 1
                                    ? t(
                                        'depthPage',
                                        {
                                            depth:
                                                x.sourceDepth
                                        }
                                    )
                                   : '',

                                localizeNameSource(
                                    x.nameSource
                                )

                            ]

                                .filter(Boolean)

                                .join(
                                    ' · '
                                );


                        return `

<div
    class="wra-item ${hidden ? 'hidden' : ''}"
    data-id="${escapeHtml(x.id)}"
>

    <input
        class="wra-check"
        type="checkbox"
       ${x.selected ? 'checked' : ''}
        title="${escapeHtml(t('itemCheckTitle'))}"
    >


    <div class="wra-main">

        <input
           class="wra-name-input ${machine ? 'wra-machine' : ''}"
           value="${escapeHtml(x.filename)}"
            title="${escapeHtml(t('filenameEditTitle'))}"
        >


        <div class="wra-url">

            <a
                href="${escapeHtml(x.url)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                ${escapeHtml(x.url)}
            </a>

        </div>


        <div
            class="wra-meta"
            title="${escapeHtml(meta)}"
        >

            ${i + 1}. ${escapeHtml(
                meta ||
                t(
                    'unknownContext'
                )
            )}

        </div>

    </div>

</div>
`;
                    }
                )

                .join('');
    }


    function showPanel() {

        createPanel();


        document.getElementById(
            'wra-helper-panel'
        )
            .style.display =
                'block';
    }


    /**********************************************************************
     * 13. 油猴菜单
     **********************************************************************/

    try {

       GM_registerMenuCommand(

            t(
                'menuExtract'
            ),

            () => {

                showPanel();

                scanCurrentPage();
            }
        );


       GM_registerMenuCommand(

            t(
                'menuPrepare'
            ),

            () => {

                showPanel();

                idmDownloadSelected();
            }
        );


       GM_registerMenuCommand(

            t(
                'menuSupport'
            ),

            openSupportAuthor
        );


       GM_registerMenuCommand(

            t(
                'menuHelp'
            ),

            openHelpPage
        );


       GM_registerMenuCommand(

            t(
                'menuToggle'
            ),

            () => {

                createPanel();


                const panel =
                    document.getElementById(
                        'wra-helper-panel'
                    );


                panel.style.display =

                    panel.style.display ===
                    'none'

                        ? 'block'

                        : 'none';
            }
        );

    } catch (_) {}


    /**********************************************************************
     * 启动
     **********************************************************************/

    createPanel();

    installMutationObserver();

    scanCurrentPage();

})();
