import {
  EditorView,
  EditorState,
  EditorSelection,
  basicSetup,
  Compartment,
  keymap,
  ViewPlugin,
  indentUnit,
  openSearchPanel,
  gotoLine,
  foldService,
  foldGutter,
  lineNumbers,
  autocompletion,
  acceptCompletion,
  rectangularSelection,
} from "../../third_party/codemirror/cm.js";
import { ABC2SVG_DECORATIONS } from "./abc_decorations_abc2svg.js";
import { buildAbcCompletionSource } from "./editor/abc_completion.js";
import { abcHighlight } from "./editor/abc_decorations.js";
import {
  parseDecorationCatalogEnrichment,
} from "./editor/abc_helpers_model.js";
import {
  openDecorationPickerAtCursor,
  openKeySignaturePickerAtCursor,
  openMidiProgramPickerAtCursor,
} from "./editor/abc_helpers_controller.js";
import { createErrorsFocusMessageController } from "./editor/errors_focus_message_controller.js";
import { createErrorsListController } from "./editor/errors_list_controller.js";
import { createErrorsPopoverController } from "./editor/errors_popover_controller.js";
import { createErrorsHighlightState } from "./editor/errors_highlight_state.js";
import {
  buildErrorEntryKey,
  buildSortedErrorsForNav,
  computeErrorId,
  findErrorSourceRangeForMessage,
  getErrorGroupKey,
  getErrorGroupLabel as getErrorGroupLabelCore,
  normalizeErrors,
  normalizeErrorMessageForMatch,
} from "./editor/errors_model.js";
import { createErrorsNavigationState } from "./editor/errors_navigation_state.js";
import { buildAbcHoverTooltip } from "./editor/abc_hover.js";
import { GM_PROGRAM_NAMES } from "./editor/gm_programs.js";
import {
  buildAbDecorations,
  buildBarMismatchDecorations,
  buildErrorActivationDecorations,
  buildIntonationHighlightDecorations,
  buildMeasureErrorDecorations,
  buildPayloadLayerDecorations,
  buildPracticeBarDecorations,
} from "./editor/range_decorations.js";
import { initSettings } from "./settings.js";
import {
  transformTranspose,
  getNativeTransposeSupport,
} from "./transpose.mjs";
import {
  normalizeMeasuresLineBreaks,
  transformMeasuresByLinebreakMarker,
  transformMeasuresPerLine,
} from "./measures.mjs";
import {
  buildDefaultDrumVelocityMap,
  clampVelocity,
  velocityToDynamic,
} from "./drums.js";
import { createLibraryViewStore } from "./library/store.js";
import { createLibraryActions } from "./library/actions.js";
import { createMoveTuneModalController } from "./library/move_tune_modal_controller.js";
import { createXIssuesModalController } from "./library/x_issues_modal_controller.js";
import { normalizeLibraryPath, pathsEqual } from "./library/path_utils.js";
import {
  applyLibraryTextFilter as applyLibraryTextFilterCore,
  getDefaultGroupSortMode,
  getDefaultTuneSortMode,
  getEntryTuneCount,
  normalizeGroupSortMode,
  normalizeTuneSortMode,
  sortGroupEntries as sortGroupEntriesCore,
  sortLibraryFiles as sortLibraryFilesCore,
  sortTunes as sortTunesCore,
} from "./library/sorting_filtering.js";
import { fileExists, mkdirp, readFile, renameFile, safeBasename, safeDirname, writeFile } from "./io/file_ops.js";
import {
  normalizeSuggestedKeyName,
  parseAbcHeaderFields,
  parseTuneIdentityFields,
} from "./abc/header_fields.js";
import { createPerdeService } from "./microtonal/perde_service.js";
import {
  isChordProFilePath,
  isChordProText,
} from "./tools/chordpro/chordpro_model.js";
import { createChordProFeature } from "./tools/chordpro/chordpro_feature.js";
import {
  parseDrumPattern,
} from "./tools/drum_helper/drum_helper_model.js";
import { openDrumHelperAtCursor } from "./tools/drum_helper/drum_helper_controller.js";
import { openGchordHelperAtCursor } from "./tools/gchord_helper/gchord_helper_controller.js";
import { createSetListFeature } from "./tools/set_list/set_list_feature.js";
import { createSourceLinkFeature } from "./tools/source_link/source_link_feature.js";
import { createMicrotonalToolsFeature } from "./tools/microtonal/microtonal_tools_feature.js";
import { createIntonationExplorerFeature } from "./tools/intonation_explorer/intonation_explorer_feature.js";
import { createTemplatesFeature } from "./tools/templates/templates_feature.js";
import { createMidiInputFeature } from "./tools/midi_input/midi_input_feature.js";
import { createPayloadModeFeature } from "./tools/payload_mode/payload_mode_feature.js";
import {
  buildPlaybackPayloadForDiagnosticsFromRenderText as buildPlaybackPayloadForDiagnosticsFromRenderTextCore,
  computePayloadTuneOffset,
} from "./tools/payload_mode/payload_mode_model.mjs";
import {
  applyMutedVoicesToTuneRoot,
  buildSelectionPlaybackToast,
  extendVisibleRangeToRepeatClose,
  focusRangeCrossesRepeats,
  getFirstPlayableVoiceIdFromTuneRoot,
  hasIntentionalSelectionPlaybackSpan,
  hasRepeatTokensInSlice,
  normalizeVoiceIdToken,
  parseMutedVoiceSetting,
  resolveEffectiveMutedVoiceIds,
  stripGchordDirectives,
  stripRepeatsLengthSafe,
} from "./playback/selection_playback_model.js";
import { createAbLoopRuntime } from "./playback/ab_loop_runtime.js";
import { createSelectionPlaybackRuntime } from "./playback/selection_playback_runtime.js";
import { createPrintAllFeature } from "./print/print_all_feature.js";
import {
  buildPrintTuneLabel,
} from "./print/error_markup.js";
import {
  applyPrintDebugMarkup as applyPrintDebugMarkupCore,
  ensureOnePerPageDirective,
  sanitizeFileBaseName,
} from "./print/print_helpers.js";
import {
  clampTranslateToViewport,
  formatTranslateXY,
  readTranslateXY,
} from "./app/modal_geometry.js";
import { createAboutModalController } from "./app/about_modal_controller.js";
import { createGoToMeasureModalController } from "./app/go_to_measure_modal_controller.js";
import { enableDraggableModal } from "./app/draggable_modal.js";
import { enableDraggableFixedPopover } from "./app/draggable_fixed_popover.js";
import { enableDraggableToolPanel } from "./app/draggable_tool_panel.js";
import { createLayoutController } from "./app/layout_controller.js";
import { createDiagnosticsController } from "./app/diagnostics_controller.js";
import { createDebugDumpFeature } from "./app/debug_dump_feature.js";

const $editorHost = document.getElementById("abc-editor");
const $out = document.getElementById("out");
const $payloadModeBar = document.getElementById("payloadModeBar");
const $payloadModeTabRender = document.getElementById("payloadModeTabRender");
const $payloadModeTabPlayback = document.getElementById("payloadModeTabPlayback");
const $payloadModeCopy = document.getElementById("payloadModeCopy");
const $payloadModeExit = document.getElementById("payloadModeExit");
const $status = document.getElementById("status");
const $cursorStatus = document.getElementById("cursorStatus");
const $bufferStatus = document.getElementById("bufferStatus");
const $toolStatus = document.getElementById("toolStatus");
const $hoverStatus = document.getElementById("hoverStatus");
const $main = document.querySelector("main");
const $divider = document.getElementById("paneDivider");
const $editorPane = document.querySelector(".editor-pane");
const $renderPane = document.querySelector(".render-pane");
const $sidebar = document.querySelector(".sidebar");
const $scanStatus = document.getElementById("scanStatus");
const $libraryTree = document.getElementById("libraryTree");
const $dirtyIndicator = document.getElementById("dirtyIndicator");
const $fileTuneSelect = document.getElementById("fileTuneSelect");
const $btnNewTune = document.getElementById("btnNewTune");
const $btnTemplates = document.getElementById("btnTemplates");
const $fileHeaderPanel = document.getElementById("fileHeaderPanel");
const $fileHeaderToggle = document.getElementById("fileHeaderToggle");
const $fileHeaderEditor = document.getElementById("fileHeaderEditor");
const $fileHeaderSave = document.getElementById("fileHeaderSave");
const $fileHeaderReload = document.getElementById("fileHeaderReload");
const $btnChordproPdf = document.getElementById("btnChordproPdf");
const $templatesModal = document.getElementById("templatesModal");
const $templatesClose = document.getElementById("templatesClose");
const $templatesSearch = document.getElementById("templatesSearch");
const $templatesList = document.getElementById("templatesList");
const $templatesFolderLabel = document.getElementById("templatesFolderLabel");
const $templatesManage = document.getElementById("templatesManage");
const $templatesEdit = document.getElementById("templatesEdit");
const $templatesReload = document.getElementById("templatesReload");
const $templatesPreviewTitle = document.getElementById("templatesPreviewTitle");
const $templatesPreviewText = document.getElementById("templatesPreviewText");
const $templatesInsert = document.getElementById("templatesInsert");
const $templatesReplace = document.getElementById("templatesReplace");
const $templatesAppend = document.getElementById("templatesAppend");
const $templatesCancel = document.getElementById("templatesCancel");
const $xIssuesModal = document.getElementById("xIssuesModal");
const $xIssuesInfo = document.getElementById("xIssuesInfo");
const $xIssuesClose = document.getElementById("xIssuesClose");
const $xIssuesCopy = document.getElementById("xIssuesCopy");
const $xIssuesJump = document.getElementById("xIssuesJump");
const $xIssuesAutoFix = document.getElementById("xIssuesAutoFix");
const $printAllOptionsModal = document.getElementById("printAllOptionsModal");
const $printAllPageBreaks = document.getElementById("printAllPageBreaks");
const $printAllRemember = document.getElementById("printAllRemember");
const $printAllOptionsCancel = document.getElementById("printAllOptionsCancel");
const $printAllOptionsOk = document.getElementById("printAllOptionsOk");
const $groupBy = document.getElementById("groupBy");
const $sortBy = document.getElementById("sortBy");
const $sortTunesBy = document.getElementById("sortTunesBy");
const $librarySearch = document.getElementById("librarySearch");
const $btnLibraryRefresh = document.getElementById("btnLibraryRefresh");
const $libraryRoot = document.getElementById("libraryRoot");
const $btnLibraryClearFilter = document.getElementById("btnLibraryClearFilter");
const $btnToggleLibrary = document.getElementById("btnToggleLibrary");
const $btnFileNew = document.getElementById("btnFileNew");
const $btnFileOpen = document.getElementById("btnFileOpen");
const $btnFileSave = document.getElementById("btnFileSave");
const $btnFileClose = document.getElementById("btnFileClose");
const $btnToggleRaw = document.getElementById("btnToggleRaw");
const $btnPlay = document.getElementById("btnPlay");
const $btnPause = document.getElementById("btnPause");
const $btnStop = document.getElementById("btnStop");
const $btnPlayPause = document.getElementById("btnPlayPause");
const $selectionLoopWrap = document.getElementById("selectionLoopWrap");
const $selectionLoopEnabled = document.getElementById("selectionLoopEnabled");
const $selectionSuppressWrap = document.getElementById("selectionSuppressWrap");
const $selectionSuppressEnabled = document.getElementById("selectionSuppressEnabled");
const $selectionGchordsWrap = document.getElementById("selectionGchordsWrap");
const $selectionGchordsEnabled = document.getElementById("selectionGchordsEnabled");
const $selectionDrumsWrap = document.getElementById("selectionDrumsWrap");
const $selectionDrumsEnabled = document.getElementById("selectionDrumsEnabled");
const $selectionMutedWrap = document.getElementById("selectionMutedWrap");
const $selectionMutedVoices = document.getElementById("selectionMutedVoices");
const $practiceTempoWrap = document.getElementById("practiceTempoWrap");
const $practiceTempo = document.getElementById("practiceTempo");
const $practiceFocusRangeGroup = document.getElementById("practiceFocusRangeGroup");
const $practiceFocusOptionsGroup = document.getElementById("practiceFocusOptionsGroup");
const $practiceFocusVoicesGroup = document.getElementById("practiceFocusVoicesGroup");
const $practiceSelectionGroup = document.getElementById("practiceSelectionGroup");
const $practiceLoopWrap = document.getElementById("practiceLoopWrap");
const $practiceLoopEnabled = document.getElementById("practiceLoopEnabled");
const $practiceLoopFrom = document.getElementById("practiceLoopFrom");
const $practiceLoopTo = document.getElementById("practiceLoopTo");
const $btnRestart = document.getElementById("btnRestart");
	const $btnPrevMeasure = document.getElementById("btnPrevMeasure");
	const $btnNextMeasure = document.getElementById("btnNextMeasure");
const $btnResetLayout = document.getElementById("btnResetLayout");
const $btnToggleSplit = document.getElementById("btnToggleSplit");
	const $btnFocusMode = document.getElementById("btnFocusMode");
	const $btnFonts = document.getElementById("btnFonts");
	const $btnToggleFollow = document.getElementById("btnToggleFollow");
	const $btnToggleGlobals = document.getElementById("btnToggleGlobals");
	const $btnToggleErrors = document.getElementById("btnToggleErrors");
const $soundfontLabel = document.getElementById("soundfontLabel");
const $rightSplit = document.querySelector(".right-split");
const $splitDivider = document.getElementById("splitDivider");
const $errorPane = document.getElementById("errorPane");
const $errorList = document.getElementById("errorList");
const $scanErrorTunes = document.getElementById("scanErrorTunes");
const $fileNameMeta = document.getElementById("fileNameMeta");
const $sidebarSplit = document.getElementById("sidebarSplit");
const $toast = document.getElementById("toast");
const $errorsIndicator = document.getElementById("errorsIndicator");
const $errorsFocusMessage = document.getElementById("errorsFocusMessage");
const $errorsPopover = document.getElementById("errorsPopover");
const $errorsPopoverTitle = document.getElementById("errorsPopoverTitle");
const $errorsListPopover = document.getElementById("errorsList");
const $sidebarBody = document.querySelector(".sidebar-body");
const $moveTuneModal = document.getElementById("moveTuneModal");
const $moveTuneClose = document.getElementById("moveTuneClose");
const $moveTuneTarget = document.getElementById("moveTuneTarget");
const $moveTuneApply = document.getElementById("moveTuneApply");
const $moveTuneCancel = document.getElementById("moveTuneCancel");
const $aboutModal = document.getElementById("aboutModal");
const $aboutClose = document.getElementById("aboutClose");
const $aboutInfo = document.getElementById("aboutInfo");
const $aboutCopy = document.getElementById("aboutCopy");
const $setListModal = document.getElementById("setListModal");
const $setListClose = document.getElementById("setListClose");
const $setListEmpty = document.getElementById("setListEmpty");
const $setListItems = document.getElementById("setListItems");
const $setListHeader = document.getElementById("setListHeader");
const $setListClear = document.getElementById("setListClear");
const $setListSaveAbc = document.getElementById("setListSaveAbc");
const $setListExportPdf = document.getElementById("setListExportPdf");
const $makamDnaModal = document.getElementById("makamDnaModal");
const $makamDnaClose = document.getElementById("makamDnaClose");
const $makamDnaEditor = document.getElementById("makamDnaEditor");
const $makamDnaStatus = document.getElementById("makamDnaStatus");
const $makamDnaResetBuiltin = document.getElementById("makamDnaResetBuiltin");
const $makamDnaSave = document.getElementById("makamDnaSave");
const $makamDnaCancel = document.getElementById("makamDnaCancel");

const abcHighlightCompartment = new Compartment();
const abcDiagnosticsCompartment = new Compartment();
const abcCompletionCompartment = new Compartment();
const abcHoverCompartment = new Compartment();
const abcTuningModeCompartment = new Compartment();
const abcPayloadReadOnlyCompartment = new Compartment();
const UNTITLED_UNSAVED_LABEL = "Untitled (unsaved)";

function reconfigureAbcExtensions({
  highlightEnabled = true,
  diagnosticsEnabled = true,
  completionEnabled = true,
  hoverEnabled = false,
  tuningModeExtensions = [],
} = {}) {
  if (!editorView) return;

  const effects = [];
  effects.push(
    abcHighlightCompartment.reconfigure(highlightEnabled ? [abcHighlight] : [])
  );
  effects.push(
    abcDiagnosticsCompartment.reconfigure(
      diagnosticsEnabled
        ? [measureErrorPlugin, barMismatchPlugin, errorActivationHighlightPlugin, practiceBarHighlightPlugin]
        : []
    )
  );
  effects.push(
    abcCompletionCompartment.reconfigure(
      completionEnabled
        ? [autocompletion({ override: [buildAbcCompletionSource()], activateOnTyping: false })]
        : []
    )
  );
  effects.push(
    abcHoverCompartment.reconfigure(
      hoverEnabled
        ? [buildAbcHoverTooltip()]
        : []
    )
  );
  effects.push(
    abcTuningModeCompartment.reconfigure(Array.isArray(tuningModeExtensions) ? tuningModeExtensions : [])
  );

  editorView.dispatch({
    effects,
    scrollIntoView: false,
  });
}
const $setListPrint = document.getElementById("setListPrint");
const $setListPageBreaks = document.getElementById("setListPageBreaks");
const $setListCompact = document.getElementById("setListCompact");
const $setListHeaderModal = document.getElementById("setListHeaderModal");
const $setListHeaderClose = document.getElementById("setListHeaderClose");
const $setListHeaderText = document.getElementById("setListHeaderText");
const $setListHeaderReset = document.getElementById("setListHeaderReset");
const $setListHeaderSave = document.getElementById("setListHeaderSave");
const $disclaimerModal = document.getElementById("disclaimerModal");
const $disclaimerOk = document.getElementById("disclaimerOk");
const $headerStateMarker = document.getElementById("headerStateMarker");

const DEFAULT_ABC = "";
const NEW_FILE_MINIMAL_ABC = `X:1
T:Untitled
K:none
`;
const TEMPLATE_ABC = `X:1
T:Կատակային Պար
T:Humoresque Dance
R:Dance
C:Հայ ժողովրդական / Armenian Folk
S:YouTube (see link)
F:https://www.youtube.com/watch?v=HrPq4KFGYXQ
Z:ABC transcription: ABCarus
P:(A B C A B)
L:1/16
Q:1/4=100
M:6/8
K:A
%%stretchlast
%%MIDI program 71
%%MIDI bassvol 80
%%MIDI bassprog 32
%%MIDI chordvol 100
%%MIDI chordprog 46
%%MIDI gchord fcfc
%%MIDI beatstring fpmpmpfpmpmp
%%MIDI drumon
%%MIDI drum d3dd2d2d2d2   39 42 42 39 42 36   50 90 90 50 90 90
%%writefields P 1
%%partsbox 1
%--------------------------------------------------------
[P:A]
"A"    ee2e2d c2dcBA      | "E"  B2cBAG   "A"   AGABcd  |
ee2e2d c2dcBA             | "E"  B2cBAG   "A"   ABGA3  :|
%
[P:B]
"F#m"  FF2FcB "Bm" B2cBAG | "C#" A2GABG   "F#m" FcBABG  |
"F#m"  FF2FcA "Bm" BAcB2G | "C#" AGBABG   "F#m" ABGF3  :|
%
[P:C]
"E7"   EEE2FG "A" AGABcd  | "E"  e2dc2B   "A"   AGBAGF  |
"E7"   EEE2FG "A" ABcde2  | "E"  e2dc2B   "A"   AGBA3  :|
%--------------------------------------------------------
`;
let currentDoc = null;
let suppressDirty = false;
let transposePreviewBaseText = null;
let transposePreviewHeaderText = null;
let transposePreviewDelta = 0;

function resetTransposePreviewState() {
  transposePreviewBaseText = null;
  transposePreviewHeaderText = null;
  transposePreviewDelta = 0;
}

function getAccumulatedTransposePreview(options = {}) {
  const currentText = String(options.currentText != null ? options.currentText : getEditorValue());
  const currentHeaderText = String(options.currentHeaderText != null ? options.currentHeaderText : getHeaderEditorValue());
  if (transposePreviewBaseText == null) {
    transposePreviewBaseText = currentText;
    transposePreviewHeaderText = currentHeaderText;
    transposePreviewDelta = 0;
  }
  return {
    baseText: String(transposePreviewBaseText || ""),
    headerText: String(transposePreviewHeaderText || ""),
    delta: Number(transposePreviewDelta) || 0,
  };
}

function setAccumulatedTransposePreview(baseText, headerText, delta) {
  transposePreviewBaseText = String(baseText || "");
  transposePreviewHeaderText = String(headerText || "");
  transposePreviewDelta = Number(delta) || 0;
}
let editorView = null;
let headerEditorView = null;
let headerCollapsed = true;
let abandonFlowInProgress = false;
let headerDirty = false;
let suppressHeaderDirty = false;
let lastHeaderToastFilePath = null;
let headerEditorFilePath = null;
let lastErrors = [];
let isNewTuneDraft = false;
let rawMode = false;
let rawModeFilePath = null;
let rawModeHeaderEndOffset = 0;
let rawModeOriginalTuneId = null;

const payloadModeFeature = createPayloadModeFeature({
  elements: {
    bar: $payloadModeBar,
    renderTab: $payloadModeTabRender,
    playbackTab: $payloadModeTabPlayback,
    copyButton: $payloadModeCopy,
    exitButton: $payloadModeExit,
  },
  lockElements: [
    $btnToggleLibrary,
    $btnLibraryRefresh,
    $btnLibraryClearFilter,
    $groupBy,
    $sortBy,
    $sortTunesBy,
    $librarySearch,
    $fileTuneSelect,
    $btnFileNew,
    $btnNewTune,
    $btnTemplates,
    $btnFileOpen,
    $btnFileSave,
    $btnFileClose,
    $btnToggleRaw,
    $btnChordproPdf,
    $btnToggleErrors,
    $btnToggleFollow,
    $btnToggleGlobals,
    $fileHeaderToggle,
    $fileHeaderSave,
    $fileHeaderReload,
    $xIssuesAutoFix,
    $xIssuesJump,
    $xIssuesCopy,
  ],
  getCopyText: getPayloadModeCopyText,
  hasEditor: () => Boolean(editorView),
  getEditorText: () => getEditorValue(),
  getEditorSelection: () => editorView ? editorView.state.selection : null,
  setEditorText: setPayloadModeEditorValue,
  setEditorReadOnly: setPayloadEditorReadOnly,
  setEditorCursor: setPayloadModeEditorCursor,
  restoreEditorSelection: restorePayloadModeEditorSelection,
  getActiveTuneUid: () => activeTuneUid,
  isRawMode: () => rawMode,
  isFocusModeEnabled: () => focusModeEnabled,
  getHeaderText: () => {
    const entry = getActiveFileEntry();
    return entry ? getHeaderEditorValue() : "";
  },
  sanitizeHeaderText: sanitizeFileHeaderForInteractiveRender,
  buildHeaderPrefixWithLayerSpans,
  buildPlaybackPayload: buildPayloadModePlaybackPayload,
  stopPlayback: stopPlaybackTransport,
  resetPlaybackState,
  clearBarMismatchMarkers: () => setBarMismatchMarkers([]),
  refreshLayerDecorations: refreshPayloadLayerDecorations,
  scheduleRender: scheduleRenderNow,
  scheduleLibraryTree: () => scheduleRenderLibraryTree(sourceFiles),
  showToast,
  setStatus,
});

const chordProFeature = createChordProFeature({
  api: window.api,
  elements: {
    tuneSelect: $fileTuneSelect,
    rawButton: $btnToggleRaw,
    pdfButton: $btnChordproPdf,
    newTuneButton: $btnNewTune,
    templatesButton: $btnTemplates,
    fileHeaderToggle: $fileHeaderToggle,
    fileHeaderSave: $fileHeaderSave,
    fileHeaderReload: $fileHeaderReload,
    libraryTree: $libraryTree,
  },
  lockElements: [
    $btnToggleLibrary,
    $btnLibraryRefresh,
    $btnLibraryClearFilter,
    $groupBy,
    $sortBy,
    $sortTunesBy,
    $librarySearch,
  ],
  getEditorView: () => editorView,
  getEditorValue,
  setEditorValue,
  setSuppressDirty: (next) => { suppressDirty = Boolean(next); },
  getCurrentDoc: () => currentDoc,
  setCurrentDoc: (doc) => { currentDoc = doc; },
  setCurrentDocContent: (content) => { if (currentDoc) currentDoc.content = String(content || ""); },
  isPayloadMode,
  isLibraryVisible: () => isLibraryVisible,
  isHeaderCollapsed: () => headerCollapsed,
  setLibraryVisible,
  setHeaderCollapsed,
  updateFileContext,
  updateSourceLinkPanel: () => sourceLinkFeature.update(),
  updatePlaybackInteractionLock,
  updatePlayButton,
  scheduleRenderNow,
  scrollToPosInEditor,
  readFile,
  showOpenError,
  showSaveError,
  showToast,
  logError: logErr,
  setTuneMetaText,
  setFileNameMeta,
  stripFileExtension,
  safeBasename,
  setRawModeUI,
  resetRawModeState: () => {
    rawModeFilePath = null;
    rawModeHeaderEndOffset = 0;
    rawModeOriginalTuneId = null;
  },
  resetPlaybackState,
  clearErrors,
  clearActiveTuneState: (filePath) => {
    activeTuneMeta = null;
    activeTuneId = null;
    activeTuneUid = null;
    activeTuneIndex = null;
    activeFilePath = filePath || null;
    isNewTuneDraft = false;
  },
  setSaveSessionForChordPro: (filePath) => setSaveSession({
    intent: SAVE_INTENT.FULL_FILE,
    targetPath: String(filePath || ""),
    targetTuneUid: "",
    source: "chordpro_open",
  }),
  recordNavFilePath,
  setDirtyIndicator,
  setFileContentInCache,
  updateFileHeaderPanel,
  updateHeaderStateUI,
  suppressRecentEntries: () => suppressRecentEntries,
  ensureWorkingCopyOpenForPath,
  refreshWorkingCopySnapshot,
  getActiveFilePath: () => activeFilePath,
  setStatus,
  clearRenderOutput,
});

const PRINT_ALL_OPTIONS_STORAGE_KEY = "abcarus.printAllOptions.v1";
const printAllFeature = createPrintAllFeature({
  elements: {
    optionsModal: $printAllOptionsModal,
    pageBreaksSelect: $printAllPageBreaks,
    rememberCheckbox: $printAllRemember,
    cancelButton: $printAllOptionsCancel,
    okButton: $printAllOptionsOk,
  },
  api: window.api,
  readStorage: safeReadJsonLocalStorage,
  writeStorage: safeWriteJsonLocalStorage,
  storageKey: PRINT_ALL_OPTIONS_STORAGE_KEY,
  getActiveFileEntry,
  getCurrentDocDirty: () => Boolean(currentDoc && currentDoc.dirty),
  confirmUnsavedChanges,
  performSaveFlow,
  getFileContent: getFileContentCached,
  getEffectiveHeaderText: () => getHeaderEditorValue(),
  sanitizeHeaderText: sanitizeFileHeaderForPerTuneRender,
  buildHeaderPrefix,
  collectHeaderKeys,
  pathsEqual,
  getActiveFilePath: () => activeFilePath,
  renderAbcToSvgMarkup,
  buildSourceLinkMarkup: (abcText) => sourceLinkFeature.buildPrintMarkup(abcText),
  applyPrintDebugMarkup,
  getPrintBaseName: getSongbookSuggestedBaseName,
  setErrorLineOffsetFromHeader,
  setLibraryErrorIndexForTune,
  setStatus,
  showToast,
  logError: logErr,
  getDebugEnabled: () => Boolean(window.__abcarusDebugPrintAll),
  onDebug: (debugInfo, svg) => {
    console.info("[print-all]", debugInfo);
    window.__abcarusDebugPrintAllSvg = svg;
  },
});
const setListFeature = createSetListFeature({
  elements: {
    modal: $setListModal,
    closeButton: $setListClose,
    empty: $setListEmpty,
    itemsList: $setListItems,
    headerButton: $setListHeader,
    clearButton: $setListClear,
    saveAbcButton: $setListSaveAbc,
    exportPdfButton: $setListExportPdf,
    printButton: $setListPrint,
    pageBreaksSelect: $setListPageBreaks,
    compactCheckbox: $setListCompact,
    headerModal: $setListHeaderModal,
    headerCloseButton: $setListHeaderClose,
    headerText: $setListHeaderText,
    headerResetButton: $setListHeaderReset,
    headerSaveButton: $setListHeaderSave,
  },
  readStorage: safeReadJsonLocalStorage,
  writeStorage: safeWriteJsonLocalStorage,
  buildItemForTuneId: buildSetListItemForTuneId,
  renderItemToSvg: renderSetListItemToSvg,
  buildSourceLinkMarkup: (abcText) => sourceLinkFeature.buildPrintMarkup(abcText),
  outputPrint: outputSetListPrintMarkup,
  saveAbc: saveSetListAbcContent,
  getExportBaseName: getSuggestedBaseName,
  getPrintBaseName: getSongbookSuggestedBaseName,
  ensureXNumberInAbc,
  appendTuneToContent,
  applyPrintDebugMarkup: applyPrintDebugMarkupCore,
  sanitizeFileBaseName,
  setStatus,
  showToast,
  logError: logErr,
  confirm: (message) => window.confirm(message),
  enableDraggable: enableDraggableModal,
});

function isPayloadMode() {
  return payloadModeFeature.isEnabled();
}

function isMicrotonalNotationSupported(settings = latestSettingsSnapshot) {
  return Boolean(settings && (settings.supportMicrotonalNotation || settings.makamToolsEnabled || settings.studyToolsEnabled));
}

function safeReadJsonLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeWriteJsonLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

printAllFeature.loadOptionsFromStorage();
const selectionPlaybackRuntime = createSelectionPlaybackRuntime();
const abLoopRuntime = createAbLoopRuntime({ minLength: 2 });
const errorsNavigationState = createErrorsNavigationState();
const errorsHighlightState = createErrorsHighlightState();

// ---------------- A–B playback helpers ----------------

function isAbPlanValid() {
  return abLoopRuntime.isPlanValid({ rawMode, payloadMode: isPayloadMode() });
}

function updateAbUi() {}

function clearAbPlan({ toast } = {}) {
  const had = abLoopRuntime.clearPlan();
  refreshAbMarkers();
  toggleAbOptionsPopover(false);
  updateAbUi();
  if (had && toast) showToast("Markers cleared (score changed)", 2400);
  if (isPlaying && activePlaybackRange && activePlaybackRange.origin === "ab") {
    stopPlaybackTransport();
  }
}

function setAbPlanRange(startOffset, endOffset) {
  if (!editorView) return;
  const max = editorView.state.doc.length;
  const plan = abLoopRuntime.setPlanRange(startOffset, endOffset, max);
  if (!plan) {
    showToast("Select a longer region for A–B.", 2200);
    return;
  }
  refreshAbMarkers();
  updateAbUi();
  refreshAbOptionsUi();
}

function setAbPlanOptions(opts = {}) {
  if (!abLoopRuntime.setPlanOptions(opts)) return;
  updateAbUi();
  refreshAbOptionsUi();
}

function toggleAbOptionsPopover() {}
function refreshAbOptionsUi() {}

function getSelectionPlaybackSettings() {
  const settings = latestSettingsSnapshot || {};
  const loopFromUi = $selectionLoopEnabled ? Boolean($selectionLoopEnabled.checked) : null;
  const suppressFromUi = $selectionSuppressEnabled ? Boolean($selectionSuppressEnabled.checked) : null;
  const gchordsFromUi = $selectionGchordsEnabled ? Boolean($selectionGchordsEnabled.checked) : null;
  const drumsFromUi = $selectionDrumsEnabled ? Boolean($selectionDrumsEnabled.checked) : null;
  const mutedFromUi = $selectionMutedVoices
    ? parseMutedVoiceSetting(String($selectionMutedVoices.value || ""))
    : null;
  return {
    loop: (loopFromUi != null) ? loopFromUi : Boolean(settings.playbackSelectionLoopEnabled),
    suppressRepeats: (suppressFromUi != null) ? suppressFromUi : (settings.playbackSelectionSuppressRepeats !== false),
    muteGchords: (gchordsFromUi != null) ? !gchordsFromUi : Boolean(settings.playbackSelectionMuteGchords),
    allowMidiDrums: (drumsFromUi != null) ? drumsFromUi : Boolean(settings.playbackSelectionAllowMidiDrums),
    mutedVoices: Array.isArray(mutedFromUi) ? mutedFromUi : parseMutedVoiceSetting(settings.playbackSelectionMutedVoices),
  };
}

function getSelectionPlaybackRange() {
  if (!editorView) return null;
  if (rawMode || isPayloadMode()) return null;
  const sel = editorView.state.selection.main;
  const start = Math.min(sel.anchor, sel.head);
  const end = Math.max(sel.anchor, sel.head);
  if (end <= start) return null;
  return { startOffset: start, endOffset: end };
}

function withTempPlaybackFlags(flags, fn) {
  return selectionPlaybackRuntime.runWithTempFlags(flags, fn, window);
}

function setAbPoint(which) {
  if (!editorView) return;
  const pos = editorView.state.selection.main.head;
  const plan = abLoopRuntime.setPoint(which, pos);
  refreshAbMarkers();
  if (plan && Number.isFinite(plan.startOffset) && Number.isFinite(plan.endOffset) && plan.endOffset !== plan.startOffset) {
    setAbPlanRange(plan.startOffset, plan.endOffset);
  } else {
    updateAbUi();
  }
}

function setAbFromSelection() {
  if (!editorView) return;
  const sel = editorView.state.selection.main;
  const start = Math.min(sel.anchor, sel.head);
  const end = Math.max(sel.anchor, sel.head);
  setAbPlanRange(start, end);
}

async function playAbLoop() {
  const plan = abLoopRuntime.getPlan();
  if (plan && plan.revisionToken !== abLoopRuntime.getRevisionToken()) {
    clearAbPlan({ toast: true });
    return;
  }
  if (!isAbPlanValid()) {
    showToast("Set A and B first.", 2200);
    return;
  }
  if (rawMode || isPayloadMode()) {
    showToast("Switch to tune mode to play A–B.", 2400);
    return;
  }
  if (plan.mutedVoices && Object.values(plan.mutedVoices).some(Boolean)) {
    selectionPlaybackRuntime.setAbMutedVoiceMap(plan.mutedVoices);
  } else {
    selectionPlaybackRuntime.clearAbMutedVoices();
  }
  const text = getEditorValue();
  const hasRepeats = hasRepeatTokensInSlice(text, plan.startOffset, plan.endOffset);
  if (!plan.suppressRepeats && hasRepeats) {
    showToast("Range crosses repeat; suppress repeats or adjust B.", 3600);
    return;
  }

  const prevStripChord = window.__abcarusPlaybackStripChordSymbols;
  if (plan.muteGchords) window.__abcarusPlaybackStripChordSymbols = true;
  try {
    setPlaybackRange({
      startOffset: plan.startOffset,
      endOffset: plan.endOffset,
      origin: "ab",
      loop: true,
    });
    await startPlaybackFromRange({ startOffset: plan.startOffset, endOffset: plan.endOffset, origin: "ab", loop: true });
  } finally {
    window.__abcarusPlaybackStripChordSymbols = prevStripChord;
    selectionPlaybackRuntime.clearAbMutedVoices();
  }
}

async function playSelectionOnce() {
  const range = getSelectionPlaybackRange();
  if (!range) return false;
  if (rawMode || isPayloadMode()) return false;
  const selectionSettings = getSelectionPlaybackSettings();
  const max = editorView ? editorView.state.doc.length : 0;
  const start = Math.max(0, Math.min(max, range.startOffset));
  const end = Math.max(start + 1, Math.min(max, range.endOffset));
  const sel = editorView.state.selection.main;
  const text = getEditorValue();
  if (!hasIntentionalSelectionPlaybackSpan(text, start, end)) return false;
  selectionPlaybackRuntime.captureSelection(sel);
  if (selectionSettings.mutedVoices && selectionSettings.mutedVoices.length) {
    selectionPlaybackRuntime.setAbMutedVoiceIds(selectionSettings.mutedVoices);
  } else {
    selectionPlaybackRuntime.clearAbMutedVoices();
  }
  if (!selectionSettings.suppressRepeats && hasRepeatTokensInSlice(text, start, end)) {
    showToast("Range crosses repeat; consider enabling Suppress repeats.", 3600);
  }
  const prevStripChord = window.__abcarusPlaybackStripChordSymbols;
  if (selectionSettings.muteGchords) window.__abcarusPlaybackStripChordSymbols = true;
  try {
    showToast(buildSelectionPlaybackToast(selectionSettings), 2600);
    setPlaybackRange({ startOffset: start, endOffset: end, origin: "selection", loop: selectionSettings.loop });
    await startPlaybackFromRange({ startOffset: start, endOffset: end, origin: "selection", loop: selectionSettings.loop });
  } finally {
    window.__abcarusPlaybackStripChordSymbols = prevStripChord;
    selectionPlaybackRuntime.clearAbMutedVoices();
  }
  return true;
}

// PlaybackRange must be initialized before initEditor() runs (selection listeners fire early).
let playbackRange = {
  startOffset: 0,
  endOffset: null,
  origin: "cursor",
  loop: false,
};
let activePlaybackRange = null;
let activePlaybackEndAbcOffset = null;
let activePlaybackEndSymbol = null;
let activeLoopRange = null; // {startOffset,endOffset,origin,loop} - stable loop bounds (may differ from resume start)
var pendingPlaybackRangeOrigin = null;
let suppressPlaybackRangeSelectionSync = false;
let playbackStartArmed = false;
let playbackRunId = 0;
let lastTraceRunId = 0;
let lastTracePlaybackIdx = null;
let lastTraceTimestamp = null;
let playbackTraceSeq = 0;

	let practiceTempoMultiplier = 1;
let playbackLoopEnabled = false;
let playbackLoopFromMeasure = 0;
let playbackLoopToMeasure = 0;
let playbackLoopTuneId = null;
const FOCUS_LOOP_DEFAULT_FROM = 0;
const FOCUS_LOOP_DEFAULT_TO = 0;
let currentPlaybackPlan = null;
let pendingPlaybackPlan = null;
let playbackSkipGchordsOnce = false;
let playbackIgnoreRepeatsOnce = false;
let transportPlayheadOffset = 0; // editor offset used for next transport start
let transportJumpHighlightActive = false;
let suppressTransportJumpClearOnce = false;
let lastRhythmErrorSuggestion = null;
let errorsEnabled = false;

let practiceBarHighlightRange = null; // {from,to} editor offsets
let practiceBarHighlightVersion = 0;
let lastSvgPracticeBarEls = [];
let lastSvgFollowBarEls = [];
let lastSvgFollowMeasureEls = [];
let lastSvgPlayheadEl = null;
let lastSvgPlayheadSvg = null;
let lastSvgPlayheadXCenter = null;

function getSortedErrorsForNav() {
  return buildSortedErrorsForNav(lastErrors);
}

function syncActiveErrorNavIndex(sortedItemsArg) {
  const items = Array.isArray(sortedItemsArg) ? sortedItemsArg : getSortedErrorsForNav();
  errorsNavigationState.sync(items, errorsHighlightState.getActive());
}

async function activateErrorByNav(delta) {
  if (!errorsEnabled) return;
  if (isPlaying || isPaused) {
    showToast("Stop playback to navigate errors");
    return;
  }
  const items = getSortedErrorsForNav();
  if (!items.length) {
    if (errorsNavigationState.shouldShowNoErrorsToast()) showToast("No errors");
    return;
  }

  const nextIdx = errorsNavigationState.nextIndex(items, delta);

  await jumpToError(items[nextIdx].entry);
}

function clearActiveErrorHighlight(reason) {
  const allowed = new Set(["resolved", "abandon", "switch", "docReplaced"]);
  if (!allowed.has(reason)) {
    console.error("[abcarus] Error highlight cleared for disallowed reason:", reason);
  }
  const prev = errorsHighlightState.clear();
  errorsNavigationState.setActiveIndex(-1);
  if (reason === "resolved" && prev && Array.isArray(lastErrors) && lastErrors.length) {
    const items = getSortedErrorsForNav();
    if (items.length) {
      const targetPos = Number.isFinite(prev.from) ? prev.from : 0;
      const targetTune = prev.tuneId ? String(prev.tuneId) : "";
      let bestIdx = -1;
      let bestDist = Infinity;
      const consider = (x, idx) => {
        const dist = Math.abs((Number.isFinite(x.pos) ? x.pos : targetPos) - targetPos);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      };
      if (targetTune) {
        for (let i = 0; i < items.length; i += 1) {
          const it = items[i];
          const tuneId = it.entry && it.entry.tuneId ? String(it.entry.tuneId) : "";
          if (tuneId !== targetTune) continue;
          consider(it, i);
        }
      }
      if (bestIdx === -1) {
        for (let i = 0; i < items.length; i += 1) consider(items[i], i);
      }
      if (bestIdx !== -1) errorsNavigationState.setActiveIndex(bestIdx);
    }
  }
  clearSvgErrorActivationHighlight();
  clearErrorFocusMessage();
  if (!editorView) return;
  errorsHighlightState.setSuppressClear(true);
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
  setTimeout(() => { errorsHighlightState.setSuppressClear(false); }, 0);
}

function setActiveErrorHighlight(entry, from, to) {
  if (!editorView) return;
  const docLen = editorView.state.doc.length;
  const id = computeErrorId(entry);
  if (!id) return;

  const activeErrorHighlight = errorsHighlightState.getActive();
  if (activeErrorHighlight && activeErrorHighlight.id !== id) {
    clearActiveErrorHighlight("switch");
  }

  const next = errorsHighlightState.setActive(entry, from, to, docLen);
  if (!next) return;
  syncActiveErrorNavIndex();

  setErrorFocusMessage(entry, next.from);
  errorsPopoverController.refresh();
}

function clearErrorsFeatureState() {
  errorsPopoverController.close();
  clearActiveErrorHighlight("docReplaced");
  tuneErrorFilter = false;
  tuneErrorScanInFlight = false;
  tuneErrorScanToken += 1;
  setScanErrorButtonActive(false);
  setScanErrorButtonState(false);
  setBarMismatchMarkers([]);
  clearErrors();
  // Ensure any "errors-only" filtering in the tune dropdown is cleared immediately.
  updateFileContext();
  // Leaving "Errors" mode should also leave looped error playback mode.
  try {
    setPlaybackRange({
      startOffset: playbackRange.startOffset,
      endOffset: playbackRange.endOffset,
      origin: playbackRange.origin || "cursor",
      loop: false,
    });
  } catch {}
  updateLibraryStatus();
  updateErrorsIndicatorAndPopover();
}

function updateErrorsFeatureUI() {
  if ($btnToggleErrors) {
    $btnToggleErrors.classList.toggle("toggle-active", Boolean(errorsEnabled));
    setButtonText($btnToggleErrors, "Errors");
    $btnToggleErrors.setAttribute("aria-pressed", errorsEnabled ? "true" : "false");
  }
  if ($btnPrevMeasure) {
    $btnPrevMeasure.hidden = !errorsEnabled;
    $btnPrevMeasure.disabled = !errorsEnabled;
  }
  if ($btnNextMeasure) {
    $btnNextMeasure.hidden = !errorsEnabled;
    $btnNextMeasure.disabled = !errorsEnabled;
  }
  if ($scanErrorTunes) {
    $scanErrorTunes.hidden = !errorsEnabled;
    $scanErrorTunes.disabled = !errorsEnabled;
  }
  if ($errorsIndicator) {
    if (!errorsEnabled) {
      $errorsIndicator.hidden = true;
      $errorsIndicator.disabled = true;
    }
  }
  if ($errorsFocusMessage) {
    if (!errorsEnabled) {
      clearErrorFocusMessage();
    }
  }
}

function setErrorsEnabled(next, { triggerRefresh = false } = {}) {
  const enabled = Boolean(next);
  if (enabled === errorsEnabled) {
    updateErrorsFeatureUI();
    return;
  }
  errorsEnabled = enabled;
  if (!errorsEnabled) {
    clearErrorsFeatureState();
  } else {
    // On enable: lightweight refresh so errors appear immediately.
    if (triggerRefresh) {
      refreshErrorsNow();
    } else {
      scheduleRenderNow();
    }
    ensureDrumMismatchErrorVisible();
  }
  updateErrorsFeatureUI();
}

const errorActivationHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = errorsHighlightState.getVersion();
    this.decorations = buildErrorActivationDecorations(view.state, errorsHighlightState.getRange());
  }
  update(update) {
    if (update.docChanged && errorsHighlightState.hasActive() && errorsHighlightState.getRange()) {
      try {
        errorsHighlightState.mapRange(update.changes, update.state.doc.length);
      } catch {}
    }
    if (update.docChanged) {
      try {
        this.decorations = this.decorations.map(update.changes);
      } catch {}
    }
    if (this.version !== errorsHighlightState.getVersion()) {
      this.version = errorsHighlightState.getVersion();
      this.decorations = buildErrorActivationDecorations(update.state, errorsHighlightState.getRange());
    }
  }
}, {
  decorations: (v) => v.decorations,
});

const practiceBarHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = practiceBarHighlightVersion;
    this.decorations = buildPracticeBarDecorations(view.state, practiceBarHighlightRange);
  }
  update(update) {
    if (update.docChanged) {
      try {
        this.decorations = this.decorations.map(update.changes);
      } catch {}
      if (practiceBarHighlightRange) {
        try {
          const max = update.state.doc.length;
          const mappedFrom = update.changes.mapPos(Number(practiceBarHighlightRange.from), 1);
          const mappedTo = update.changes.mapPos(Number(practiceBarHighlightRange.to), -1);
          const from = Math.max(0, Math.min(mappedFrom, max));
          const to = Math.max(from, Math.min(mappedTo, max));
          practiceBarHighlightRange = (to > from) ? { from, to } : null;
        } catch {}
      }
    }
    if (update.docChanged || update.selectionSet || this.version !== practiceBarHighlightVersion) {
      this.version = practiceBarHighlightVersion;
      this.decorations = buildPracticeBarDecorations(update.state, practiceBarHighlightRange);
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function clearSvgErrorActivationHighlight() {
  errorsHighlightState.clearSvgElements("svg-error-activation");
}

function clearSvgPracticeBarHighlight() {
  for (const el of lastSvgPracticeBarEls) {
    try { el.classList.remove("svg-practice-bar"); } catch {}
  }
  lastSvgPracticeBarEls = [];
}

function clearSvgFollowBarHighlight() {
  for (const el of lastSvgFollowBarEls) {
    try { el.classList.remove("svg-follow-bar"); } catch {}
  }
  lastSvgFollowBarEls = [];
}

function clearSvgFollowMeasureHighlight() {
  for (const el of lastSvgFollowMeasureEls) {
    try { el.remove(); } catch {}
  }
  lastSvgFollowMeasureEls = [];
}

function clearSvgPlayhead() {
  if (lastSvgPlayheadEl) {
    try { lastSvgPlayheadEl.remove(); } catch {}
  }
  if ($out) {
    try {
      const leftovers = $out.querySelectorAll(".svg-playhead-line");
      leftovers.forEach((el) => {
        try { el.remove(); } catch {}
      });
    } catch {}
  }
  lastSvgPlayheadEl = null;
  lastSvgPlayheadSvg = null;
  lastSvgPlayheadXCenter = null;
}

	function getOrCreateSvgOverlayHost(svg, parentEl) {
	  if (!svg) return null;
	  const hostParent = (parentEl && parentEl.nodeType === 1 && svg.contains(parentEl)) ? parentEl : svg;
	  const existing = Array.from(hostParent.children || []).find((el) => {
	    try { return el && el.matches && el.matches("g.abcarus-svg-overlays"); } catch { return false; }
	  });
	  if (existing) return existing;
	  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
	  g.setAttribute("class", "abcarus-svg-overlays");
	  // Keep overlays in the same transform context as notes/bars by inserting into their parent group.
	  // Insert early so it stays behind notes.
	  try {
	    hostParent.insertBefore(g, hostParent.firstChild || null);
	  } catch {
	    try { hostParent.appendChild(g); } catch {}
	  }
	  return g;
	}

function getRectAttr(el, name) {
  const v = Number(el && typeof el.getAttribute === "function" ? el.getAttribute(name) : NaN);
  return Number.isFinite(v) ? v : null;
}

function rectsOverlap(aTop, aBottom, bTop, bBottom) {
  const top = Math.max(aTop, bTop);
  const bottom = Math.min(aBottom, bBottom);
  return bottom > top ? (bottom - top) : 0;
}

function findNearestBarElForNote(noteEl) {
  if (!noteEl || !$out) return null;
  const svg = noteEl.ownerSVGElement;
  if (!svg) return null;
  const nx = getRectAttr(noteEl, "x");
  const ny = getRectAttr(noteEl, "y");
  const nh = getRectAttr(noteEl, "height");
  if (nx == null || ny == null || nh == null) return null;
  const noteTop = ny;
  const noteBottom = ny + nh;
  const noteX = nx + (getRectAttr(noteEl, "width") || 0) * 0.5;

  const barEls = Array.from(svg.querySelectorAll(".bar-hl"));
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const el of barEls) {
    const by = getRectAttr(el, "y");
    const bh = getRectAttr(el, "height");
    const bx = getRectAttr(el, "x");
    const bw = getRectAttr(el, "width");
    if (by == null || bh == null || bx == null) continue;
    const overlap = rectsOverlap(noteTop, noteBottom, by, by + bh);
    if (overlap <= 0) continue;
    // Prefer bars whose vertical span covers the note and are horizontally near the note.
    const barX = (bw != null && bw > 0) ? (bx + bw / 2) : bx;
    const dx = Math.abs(barX - noteX);
    const dy = Math.abs(by - noteTop);
    const score = dx + dy * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

	function highlightSvgFollowMeasureForNote(noteEl, barEl) {
	  if (!noteEl) return false;
	  const svg = noteEl.ownerSVGElement;
	  if (!svg) return false;

  const b = barEl || findNearestBarElForNote(noteEl);
  if (!b) return false;

  const bandY = getRectAttr(b, "y");
  const bandH = getRectAttr(b, "height");
  if (bandY == null || bandH == null) return false;
  const bandTop = bandY;
  const bandBottom = bandY + bandH;

  const noteX = getRectAttr(noteEl, "x");
  const noteW = getRectAttr(noteEl, "width") || 0;
  if (noteX == null) return false;
  const noteCenterX = noteX + noteW * 0.5;

  const barsOnLine = Array.from(svg.querySelectorAll(".bar-hl")).map((el) => {
    const x = getRectAttr(el, "x");
    const w = getRectAttr(el, "width");
    const y = getRectAttr(el, "y");
    const h = getRectAttr(el, "height");
    if (x == null || y == null || h == null) return null;
    const overlap = rectsOverlap(bandTop, bandBottom, y, y + h);
    if (overlap <= 0) return null;
    const xCenter = (w != null && w > 0) ? (x + w / 2) : x;
    return { el, x, xCenter, y, h };
  }).filter(Boolean);

  // Collect notes on the same staff band to approximate the visible line extents.
  const notesOnLine = Array.from(svg.querySelectorAll(".note-hl")).map((el) => {
    const x = getRectAttr(el, "x");
    const y = getRectAttr(el, "y");
    const w = getRectAttr(el, "width");
    const h = getRectAttr(el, "height");
    if (x == null || y == null || w == null || h == null) return null;
    const overlap = rectsOverlap(bandTop, bandBottom, y, y + h);
    if (overlap <= 0) return null;
    return { x, y, w, h };
  }).filter(Boolean);

  let lineMinX = null;
  let lineMaxX = null;
  for (const n of notesOnLine) {
    const left = n.x;
    const right = n.x + n.w;
    lineMinX = (lineMinX == null) ? left : Math.min(lineMinX, left);
    lineMaxX = (lineMaxX == null) ? right : Math.max(lineMaxX, right);
  }

  let leftBarX = null;
  let rightBarX = null;
  for (const bar of barsOnLine) {
    const bx = Number.isFinite(bar.xCenter) ? bar.xCenter : bar.x;
    if (bx <= noteCenterX) {
      leftBarX = (leftBarX == null) ? bx : Math.max(leftBarX, bx);
    } else {
      rightBarX = (rightBarX == null) ? bx : Math.min(rightBarX, bx);
    }
  }

  const pad = 10;
  const fallbackLeft = lineMinX != null ? Math.max(0, lineMinX - pad) : Math.max(0, noteCenterX - 120);
  const fallbackRight = lineMaxX != null ? (lineMaxX + pad) : (noteCenterX + 120);
  const leftX = (leftBarX != null) ? leftBarX : fallbackLeft;
  const rightX = (rightBarX != null) ? rightBarX : fallbackRight;
	  const width = Math.max(0, rightX - leftX);
	  if (width < 4) return false;

	  clearSvgFollowMeasureHighlight();
	  const host = getOrCreateSvgOverlayHost(svg, b && b.parentNode);
	  if (!host) return false;
	  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	  rect.setAttribute("class", "svg-follow-measure");
	  rect.setAttribute("x", String(leftX));
  rect.setAttribute("y", String(bandTop));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(bandH));
  rect.setAttribute("pointer-events", "none");
  try { host.appendChild(rect); } catch {}
  lastSvgFollowMeasureEls = [rect];
  return true;
}

function highlightSvgFollowBarAtEditorOffset(editorOffset) {
  if (!$out || !$renderPane) return false;
  if (!Number.isFinite(editorOffset)) return false;
  if (!editorView) return false;
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const editorText = editorView.state.doc.toString();
  const measure = findMeasureRangeAt(editorText, editorOffset);
  const barEls = measure ? Array.from($out.querySelectorAll(".bar-hl")) : [];
  if (measure && barEls.length) {
    const start = mapEditorOffsetToRenderIdx(measure.start);
    const end = mapEditorOffsetToRenderIdx(measure.end);
    const hits = barEls.filter((el) => {
      const s = Number(el.dataset && el.dataset.start);
      const e = Number(el.dataset && el.dataset.end);
      if (!Number.isFinite(s)) return false;
      const stop = Number.isFinite(e) ? e : s + 1;
      return s < end && stop > start;
    });
    if (hits.length) {
      clearSvgFollowBarHighlight();
      lastSvgFollowBarEls = hits;
      for (const el of lastSvgFollowBarEls) {
        try { el.classList.add("svg-follow-bar"); } catch {}
      }
      return true;
    }
  }
  clearSvgFollowBarHighlight();
  return false;
}

	function setSvgPlayheadFromElements(noteEl, preferredBarEl) {
	  if (!noteEl) {
	    clearSvgPlayhead();
	    return;
	  }
	  const svg = noteEl.ownerSVGElement;
	  if (!svg) return;
	  const hostParent = (noteEl.parentNode && noteEl.parentNode.nodeType === 1 && svg.contains(noteEl.parentNode))
	    ? noteEl.parentNode
	    : svg;

  const xRaw = Number(noteEl.getAttribute("x"));
  const wRaw = Number(noteEl.getAttribute("width"));
  const yRaw = Number(noteEl.getAttribute("y"));
  const hRaw = Number(noteEl.getAttribute("height"));
  if (!Number.isFinite(xRaw)) return;
  const xCenter = xRaw + (Number.isFinite(wRaw) ? (wRaw / 2) : 0);
  const width = Number.isFinite(wRaw) ? wRaw : 0;

  let y = Number.isFinite(yRaw) ? yRaw : 0;
  let h = Number.isFinite(hRaw) ? hRaw : 0;
  const barEl = preferredBarEl && preferredBarEl.ownerSVGElement === svg ? preferredBarEl : null;
  if (barEl) {
    const by = Number(barEl.getAttribute("y"));
    const bh = Number(barEl.getAttribute("height"));
    if (Number.isFinite(by)) y = by;
    if (Number.isFinite(bh)) h = bh;
  }
  const pad = clampNumber(followPlayheadPad, 0, 24, 8);
  const yTop = Math.max(0, y - pad);
  const height = Math.max(1, h + pad * 2);

	  if (lastSvgPlayheadSvg && lastSvgPlayheadSvg !== svg) {
	    clearSvgPlayhead();
	  }
	  if (lastSvgPlayheadEl && lastSvgPlayheadEl.parentNode && lastSvgPlayheadEl.parentNode !== hostParent) {
	    try { lastSvgPlayheadEl.remove(); } catch {}
	    lastSvgPlayheadEl = null;
	  }
	  if (!lastSvgPlayheadEl || lastSvgPlayheadSvg !== svg || (lastSvgPlayheadEl && lastSvgPlayheadEl.parentNode !== hostParent)) {
	    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	    rect.setAttribute("class", "svg-playhead-line");
	    rect.setAttribute("width", String(clampNumber(followPlayheadWidth, 1, 6, 2)));
	    rect.setAttribute("rx", "1");
	    rect.setAttribute("ry", "1");
	    rect.setAttribute("pointer-events", "none");
	    try { hostParent.appendChild(rect); } catch { try { svg.appendChild(rect); } catch {} }
	    lastSvgPlayheadEl = rect;
	    lastSvgPlayheadSvg = svg;
	  }
	  try {
	    // Place the playhead between the previous and current note positions when possible.
	    // Fallback: bias slightly left of the current note for better readability.
    const wSetting = clampNumber(followPlayheadWidth, 1, 6, 2);
    const halfW = wSetting / 2;
    const shift = clampNumber(followPlayheadShift, -20, 20, 0);
    // Keep rhythm accuracy, but offset slightly left so the current notehead remains clearly visible.
    const leadGap = Math.max(3, Math.min(8, width * 0.28));
    const xTarget = xCenter - leadGap + shift;
    lastSvgPlayheadXCenter = xCenter;

    lastSvgPlayheadEl.setAttribute("width", String(wSetting));
    lastSvgPlayheadEl.setAttribute("rx", String(Math.max(0, Math.min(2, halfW))));
    lastSvgPlayheadEl.setAttribute("ry", String(Math.max(0, Math.min(2, halfW))));
    lastSvgPlayheadEl.setAttribute("x", String(xTarget - halfW));
    lastSvgPlayheadEl.setAttribute("y", String(yTop));
    lastSvgPlayheadEl.setAttribute("height", String(height));
  } catch {}
}

function highlightSvgAtEditorOffset(editorOffset) {
  if (!$out || !$renderPane) return false;
  if (!Number.isFinite(editorOffset)) return false;
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const renderIdx = mapEditorOffsetToRenderIdx(editorOffset);

  // Prefer measure-wide highlighting when possible (easier to spot than a single glyph).
  if (editorView) {
    try {
      const editorText = editorView.state.doc.toString();
      const measure = findMeasureRangeAt(editorText, editorOffset);
      const barEls = measure ? Array.from($out.querySelectorAll(".bar-hl")) : [];
      if (measure && barEls.length) {
        const start = mapEditorOffsetToRenderIdx(measure.start);
        const end = mapEditorOffsetToRenderIdx(measure.end);
        const hits = barEls.filter((el) => {
          const s = Number(el.dataset && el.dataset.start);
          return Number.isFinite(s) && s >= start && s < end;
        });
        if (hits.length) {
          clearSvgErrorActivationHighlight();
          const activeEls = errorsHighlightState.setSvgElements(hits);
          for (const el of activeEls) {
            try { el.classList.add("svg-error-activation"); } catch {}
          }
          const chosen = pickClosestNoteElement(activeEls);
          if (chosen) maybeScrollRenderToNote(chosen);
          errorsHighlightState.setLastSvgRenderIdx(start);
          return true;
        }
      }
    } catch {}
  }

  let els = $out.querySelectorAll("._" + renderIdx + "_");
  if ((!els || !els.length) && Number.isFinite(renderIdx)) {
    // Small, deterministic fallback: search backward for a nearby mapped glyph.
    // This helps when the error points into a token but the SVG mapping only exists at the token start.
    const maxBack = 200;
    for (let d = 1; d <= maxBack; d += 1) {
      const probe = renderIdx - d;
      if (probe < 0) break;
      els = $out.querySelectorAll("._" + probe + "_");
      if (els && els.length) break;
    }
  }
  if (!els || !els.length) return false;

  clearSvgErrorActivationHighlight();
  const activeEls = errorsHighlightState.setSvgElements(Array.from(els));
  for (const el of activeEls) {
    try { el.classList.add("svg-error-activation"); } catch {}
  }
  const chosen = pickClosestNoteElement(activeEls);
  if (chosen) maybeScrollRenderToNote(chosen);
  errorsHighlightState.setLastSvgRenderIdx(renderIdx);
  return true;
}

let diagnosticsController = null;

function recordDebugLog(level, args, stackOverride) {
  if (diagnosticsController) diagnosticsController.recordDebugLog(level, args, stackOverride);
}

function recordRecentAction(type, details) {
  if (diagnosticsController) diagnosticsController.recordRecentAction(type, details);
}

function perfNowMs() {
  return diagnosticsController ? diagnosticsController.perfNowMs() : Date.now();
}

function isIntonationPerfEnabled() {
  try { return window.__abcarusPerfIntonation === true; } catch { return false; }
}

function logIntonationPerf(label, data) {
  if (diagnosticsController) diagnosticsController.logIntonationPerf(label, data);
}

function isStartupPerfEnabled() {
  return diagnosticsController ? diagnosticsController.isStartupPerfEnabled() : false;
}
function logStartupPerf(label, data) {
  if (diagnosticsController) diagnosticsController.logStartupPerf(label, data);
}

function reportStartupStatus(text) {
  if (diagnosticsController) diagnosticsController.reportStartupStatus(text);
}

function abbreviatePathForLog(fullPath, tailSegments = 3) {
  if (!fullPath) return "";
  const raw = String(fullPath);
  const sep = raw.includes("\\") ? "\\" : "/";
  const parts = raw.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= tailSegments) return raw;
  return ["…", ...parts.slice(-tailSegments)].join(sep);
}

function setUiFontsFromSettings(settings) {
  const root = document && document.documentElement ? document.documentElement : null;
  if (!root) return;
  const family = settings && typeof settings.uiFontFamily === "string" ? settings.uiFontFamily.trim() : "";
  const size = settings && Number.isFinite(Number(settings.uiFontSize)) ? Number(settings.uiFontSize) : NaN;
  const libraryFamily = settings && typeof settings.libraryUiFontFamily === "string" ? settings.libraryUiFontFamily.trim() : "";
  const librarySize = settings && Number.isFinite(Number(settings.libraryUiFontSize)) ? Number(settings.libraryUiFontSize) : NaN;
  try {
    if (family) root.style.setProperty("--font-family-ui", family);
    else root.style.removeProperty("--font-family-ui");
  } catch {}
  try {
    if (Number.isFinite(size) && size > 0) root.style.setProperty("--font-size-ui", `${Math.round(size)}px`);
    else root.style.removeProperty("--font-size-ui");
  } catch {}
  try {
    if (libraryFamily) root.style.setProperty("--library-font-family", libraryFamily);
    else root.style.removeProperty("--library-font-family");
  } catch {}
  try {
    if (Number.isFinite(librarySize) && librarySize > 0) root.style.setProperty("--library-font-size", `${Math.round(librarySize)}px`);
    else root.style.removeProperty("--library-font-size");
  } catch {}

  // Belt-and-suspenders: apply directly to the Library Tree element too.
  // This avoids “it didn't change” reports if CSS vars are overridden elsewhere.
  try {
    const tree = document.getElementById("libraryTree");
    if (tree) {
      tree.style.fontFamily = libraryFamily || "";
      tree.style.fontSize = (Number.isFinite(librarySize) && librarySize > 0) ? `${Math.round(librarySize)}px` : "";
    }
  } catch {}
}

function setEditorHelpFromSettings(settings) {
  const enabled = settings ? Boolean(settings.editorHelpEnabled) : true;
  // Keep this narrow: only toggle "Editor Help" surfaces.
  // Do not touch other compartments (tuning mode, payload read-only, etc.).
  try {
    reconfigureAbcExtensions({
      completionEnabled: enabled,
      hoverEnabled: enabled,
    });
  } catch {}
}

const devConfig = (() => {
  try {
    return (window.api && typeof window.api.getDevConfig === "function") ? (window.api.getDevConfig() || {}) : {};
  } catch {
    return {};
  }
})();
const AUTO_DUMP_DEFAULT_ENABLED = String(devConfig.ABCARUS_DEV_AUTO_DUMP || "") === "1";
const AUTO_DUMP_DIR_OVERRIDE = String(devConfig.ABCARUS_DEV_AUTO_DUMP_DIR || "");
const NATIVE_MIDI_DRUMS_DEFAULT_ENABLED = String(devConfig.ABCARUS_DEV_NATIVE_MIDI_DRUMS || "") !== "0";
const debugDumpFeature = createDebugDumpFeature({
  api: window.api,
  windowRef: window,
  getAutoDumpDirOverride: () => AUTO_DUMP_DIR_OVERRIDE,
  getActiveTuneMeta: () => activeTuneMeta,
  getCurrentDoc: () => currentDoc,
  getDebugLogBuffer: () => diagnosticsController ? diagnosticsController.debugLogBuffer : [],
  getRecentActions: () => diagnosticsController ? diagnosticsController.recentActions : [],
  getEditorView: () => editorView,
  getHeaderDirty: () => headerDirty,
  getHeaderCollapsed: () => headerCollapsed,
  getEditorValue,
  getHeaderEditorValue,
  getWorkingCopySnapshot: () => workingCopySnapshot,
  getPlaybackPayload,
  getLastPlaybackPayloadCache: () => lastPlaybackPayloadCache,
  getFollowPipelineVersion: () => FOLLOW_PIPELINE_VERSION,
  getIsPlaying: () => isPlaying,
  getIsPaused: () => isPaused,
  getWaitingForFirstNote: () => waitingForFirstNote,
  getFollowPlayback: () => followPlayback,
  getFollowVoiceId: () => followVoiceId,
  getFollowVoiceIndex: () => followVoiceIndex,
  getPlaybackState: () => playbackState,
  getPracticeTempoMultiplier: () => practiceTempoMultiplier,
  getPlaybackLoopEnabled: () => playbackLoopEnabled,
  getPlaybackLoopFromMeasure: () => playbackLoopFromMeasure,
  getPlaybackLoopToMeasure: () => playbackLoopToMeasure,
  getSoundfontName: () => soundfontName,
  getSoundfontSource: () => soundfontSource,
  getSoundfontReadyName: () => soundfontReadyName,
  getLastSoundfontApplied: () => lastSoundfontApplied,
  getPlaybackIndexOffset: () => playbackIndexOffset,
  getPlaybackRange: () => playbackRange,
  getActivePlaybackRange: () => activePlaybackRange,
  getActivePlaybackEndAbcOffset: () => activePlaybackEndAbcOffset,
  getLastStartPlaybackIdx: () => lastStartPlaybackIdx,
  getResumeStartIdx: () => resumeStartIdx,
  getDesiredPlayerSpeed: () => desiredPlayerSpeed,
  getCurrentPlaybackPlan: () => currentPlaybackPlan,
  getPendingPlaybackPlan: () => pendingPlaybackPlan,
  getLastPlaybackGuardMessage: () => lastPlaybackGuardMessage,
  getLastPlaybackAbortMessage: () => lastPlaybackAbortMessage,
  getLastPlaybackException: () => lastPlaybackException,
  getPlaybackNoteTrace: () => playbackNoteTrace,
  getPlaybackParseErrors: () => playbackParseErrors,
  getPlaybackSanitizeWarnings: () => playbackSanitizeWarnings,
  getLastDrumInjectResult: () => lastDrumInjectResult,
  getLastDrumPlaybackActive: () => lastDrumPlaybackActive,
  getLastDrumSignatureDiff: () => lastDrumSignatureDiff,
  getLastRhythmErrorSuggestion: () => lastRhythmErrorSuggestion,
  getLastRenderPayload: () => lastRenderPayload,
  getBarMismatchMarkers: () => barMismatchMarkers,
  getErrorEntries: () => errorEntries,
  getActiveErrorHighlight: () => errorsHighlightState.getActive(),
  getActiveFileEntry,
  isPayloadMode,
  computeHeaderPresence,
  buildHeaderPrefix,
  injectGchordOn,
  shouldUseNativeMidiDrums,
  normalizeLeadingInlineDirectivesForPlayback,
  normalizeDollarLineBreaksForPlayback,
  normalizeBlankLinesForPlayback,
  sanitizeAbcForPlayback,
  extractDrumPlaybackBars,
  computeExpectedBarSignatureFromInfo,
  buildDrumVoiceText,
  extractBarSignatureFromText,
  diffSignatures,
  clonePlaybackRange,
  clampInt,
  mkdirp,
  writeFile,
  showSaveDialog,
  showSaveError,
  showToast,
  safeBasename,
  safeDirname,
});
diagnosticsController = createDiagnosticsController({
  api: window.api,
  storage: typeof localStorage !== "undefined" ? localStorage : null,
  autoDumpDefaultEnabled: AUTO_DUMP_DEFAULT_ENABLED,
  autoWcDumpDefaultEnabled: () => Boolean(latestSettingsSnapshot && latestSettingsSnapshot.autoWcDumpsEnabled),
  getAutoWcDumpLimit,
  getSuggestedDebugDumpDir: debugDumpFeature.getSuggestedDir,
  writeDebugDumpSnapshotToPath: debugDumpFeature.writeSnapshotToPath,
  nowCompactStamp: debugDumpFeature.nowCompactStamp,
  safeString: debugDumpFeature.safeString,
});
diagnosticsController.installConsoleCapture();

// ---------------------------------------------------------------------------
// A–B playback (Issue #21, MVP)
// ---------------------------------------------------------------------------

function getAutoWcDumpLimit() {
  const raw = latestSettingsSnapshot && Number.isFinite(Number(latestSettingsSnapshot.autoWcDumpsLimit))
    ? Number(latestSettingsSnapshot.autoWcDumpsLimit)
    : 12;
  return clampInt(raw, 3, 50, 12);
}

function shouldUseNativeMidiDrums() {
  // Runtime override via DevTools (no reload): window.__abcarusNativeMidiDrums = true/false
  if (window.__abcarusNativeMidiDrums === true) return true;
  if (window.__abcarusNativeMidiDrums === false) return false;
  // If the user explicitly touched the setting, it wins over env defaults.
  if (latestSettingsSnapshot && latestSettingsSnapshot.playbackNativeMidiDrumsSetByUser) {
    return Boolean(latestSettingsSnapshot.playbackNativeMidiDrums);
  }
  return NATIVE_MIDI_DRUMS_DEFAULT_ENABLED;
}

function scheduleAutoDump(reason, extra) {
  if (diagnosticsController) diagnosticsController.scheduleAutoDump(reason, extra);
}

function scheduleAutoWcDump(reason, extra) {
  if (diagnosticsController) diagnosticsController.scheduleAutoWcDump(reason, extra);
}

// Auto-dumps are cheap when disabled and invaluable when debugging: opt-in via ABCARUS_DEV_AUTO_DUMP=1.
window.addEventListener("error", (e) => {
  try {
    const msg = e && e.message ? String(e.message) : "window.error";
    scheduleAutoDump("window-error", msg);
  } catch {}
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    const reason = e && e.reason ? e.reason : null;
    const msg = reason && reason.message ? String(reason.message) : String(reason || "unhandledrejection");
    scheduleAutoDump("unhandledrejection", msg);
  } catch {}
});

const MIN_PANE_WIDTH = 220;
const MIN_RIGHT_PANE_WIDTH = 220;
const MIN_RIGHT_PANE_HEIGHT = 180;
const MIN_ERROR_PANE_HEIGHT = 120;
const USE_ERROR_OVERLAY = true;
const LIBRARY_SEARCH_DEBOUNCE_MS = 180;
let settingsController = null;
let disclaimerShown = false;
const layoutController = createLayoutController({
  main: $main,
  divider: $divider,
  sidebar: $sidebar,
  rightSplit: $rightSplit,
  splitDivider: $splitDivider,
  editorPane: $editorPane,
  renderPane: $renderPane,
  sidebarBody: $sidebarBody,
  sidebarSplit: $sidebarSplit,
  errorPane: $errorPane,
  libraryTree: $libraryTree,
  toggleSplitButton: $btnToggleSplit,
  minPaneWidth: MIN_PANE_WIDTH,
  minRightPaneWidth: MIN_RIGHT_PANE_WIDTH,
  minRightPaneHeight: MIN_RIGHT_PANE_HEIGHT,
  minErrorPaneHeight: MIN_ERROR_PANE_HEIGHT,
  useErrorOverlay: USE_ERROR_OVERLAY,
  getLibraryVisible: () => isLibraryVisible,
  getSidebarWidth: () => lastSidebarWidth,
  setSidebarWidth: (value) => { lastSidebarWidth = value; },
  saveLibraryPrefs: (patch) => scheduleSaveLibraryPrefs(patch),
  saveLayoutPrefs: async (patch) => {
    if (!window.api || typeof window.api.updateSettings !== "function") return;
    await window.api.updateSettings(patch);
  },
});

let decorationCatalogEnrichment = null;
let decorationCatalogEnrichmentTried = false;

async function loadDecorationCatalogEnrichment() {
  if (decorationCatalogEnrichmentTried) return decorationCatalogEnrichment;
  decorationCatalogEnrichmentTried = true;

  try {
    if (!window.api || typeof window.api.pathJoin !== "function" || typeof window.api.pathDirname !== "function") return null;
    const href = String(window.location && window.location.href ? window.location.href : "");
    if (!href.startsWith("file://")) return null;
    const p = decodeURIComponent(new URL(href).pathname || "");
    if (!p.includes("/src/renderer/")) return null;
    const rendererDir = window.api.pathDirname(p);
    const srcDir = window.api.pathDirname(rendererDir);
    const rootDir = window.api.pathDirname(srcDir);
    const jsonPath = window.api.pathJoin(rootDir, "kitchen", "derived", "abc2svg-decorations-catalog.json");

    const res = await readFile(jsonPath);
    if (!res || !res.ok || !res.data) return null;
    const map = parseDecorationCatalogEnrichment(res.data);
    decorationCatalogEnrichment = map;
    return map;
  } catch {
    return null;
  }
}

function setPaneSizes(leftWidth) {
  layoutController.setPaneSizes(leftWidth);
}

function initPaneResizer() {
  layoutController.initPaneResizer();
}

let suppressFollowScrollUntilMs = 0;

function scheduleSaveLayoutPrefs(patch) {
  layoutController.scheduleSaveLayoutPrefs(patch);
}

function isNormalModeForSplitToggle() {
  return !rawMode && !focusModeEnabled;
}

function applyRightSplitOrientation(next) {
  layoutController.applyRightSplitOrientation(next);
}

function applyRightSplitSizesFromRatio() {
  if (rawMode) {
    if ($rightSplit) {
      $rightSplit.style.gridTemplateColumns = "1fr";
      $rightSplit.style.gridTemplateRows = "1fr";
    }
    return;
  }
  layoutController.applyRightSplitSizesFromRatio();
}

function setRightPaneSizes(leftWidth) {
  layoutController.setRightPaneSizes(leftWidth, { rawMode });
}

function initRightPaneResizer() {
  layoutController.initRightPaneResizer({ isRawMode: () => rawMode });
}

function resetRightPaneSplit() {
  layoutController.resetRightPaneSplit();
}

function setSidebarSplitSizes(topHeight) {
  layoutController.setSidebarSplitSizes(topHeight);
}

function initSidebarResizer() {
  layoutController.initSidebarResizer();
}

let libraryIndex = null;
let libraryFilter = null;
let libraryFilterLabel = "";
let libraryTextFilter = "";
let tuneErrorFilter = false;
let tuneErrorScanToken = 0;
let tuneErrorScanInFlight = false;
let libraryFullScanInFlight = false;
let libraryFullScanToken = "";
let suppressRecentEntries = false;
let toastTimer = null;
let errorLineOffset = 0;
let measureErrorRanges = [];
let measureErrorVersion = 0;
let measureErrorRenderRanges = [];
let barMismatchMarkers = [];
let barMismatchVersion = 0;
let lastRenderPayload = null;
let noteHighlightIndexCache = null;
const FOLLOW_PIPELINE_VERSION = "follow-2026-02-21-r3";
let globalHeaderText = "";
let globalHeaderEnabled = true;
let globalHeaderLocalText = "";
let globalHeaderUserText = "";
let globalHeaderGlobalText = "";
let abc2svgNotationFontFile = "";
let abc2svgTextFontFile = "";
let fontDirs = { bundledDir: "", userDir: "" };
let soundfontName = "TimGM6mb.sf2";
let soundfontSource = "abc2svg.sf2";
let soundfontReadyName = null;
let soundfontLoadPromise = null;
let soundfontLoadTarget = null;
let soundfontStatusTimer = null;
const STREAMING_SF2 = new Set();
const MAX_FILE_CONTENT_CACHE_ENTRIES = 12;
const fileContentCache = new Map();

function getRenderCompatMap() {
  return lastRenderPayload && lastRenderPayload.compatMap ? lastRenderPayload.compatMap : null;
}

function mapSourceOffsetToRenderOffset(offset, compatMap = getRenderCompatMap()) {
  const raw = Number(offset);
  if (!Number.isFinite(raw)) return raw;
  const map = compatMap;
  if (!map || !Array.isArray(map.shifts) || !map.shifts.length) return raw;
  let lo = 0;
  let hi = map.shifts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((map.shifts[mid].srcPos || 0) <= raw) lo = mid + 1;
    else hi = mid;
  }
  const shift = lo > 0 ? map.shifts[lo - 1] : null;
  const delta = shift && Number.isFinite(shift.delta) ? shift.delta : 0;
  return raw + delta;
}

function mapRenderOffsetToSourceOffset(offset, compatMap = getRenderCompatMap()) {
  const raw = Number(offset);
  if (!Number.isFinite(raw)) return raw;
  const map = compatMap;
  if (!map || !Array.isArray(map.shifts) || !map.shifts.length) return raw;
  let lo = 0;
  let hi = map.shifts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((map.shifts[mid].outPos || 0) <= raw) lo = mid + 1;
    else hi = mid;
  }
  const shift = lo > 0 ? map.shifts[lo - 1] : null;
  const delta = shift && Number.isFinite(shift.delta) ? shift.delta : 0;
  return raw - delta;
}

function mapEditorOffsetToRenderIdx(editorOffset, payload = lastRenderPayload) {
  const raw = Number(editorOffset);
  if (!Number.isFinite(raw)) return raw;
  const renderOffset = payload && Number.isFinite(payload.offset) ? payload.offset : 0;
  const sourcePos = raw + renderOffset;
  return mapSourceOffsetToRenderOffset(sourcePos, payload && payload.compatMap ? payload.compatMap : null);
}

function mapRenderIdxToEditorOffset(renderIdx, payload = lastRenderPayload) {
  const raw = Number(renderIdx);
  if (!Number.isFinite(raw)) return raw;
  const renderOffset = payload && Number.isFinite(payload.offset) ? payload.offset : 0;
  const sourcePos = mapRenderOffsetToSourceOffset(raw, payload && payload.compatMap ? payload.compatMap : null);
  return Math.max(0, sourcePos - renderOffset);
}

function lruGet(map, key) {
  if (!map.has(key)) return undefined;
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

function lruSet(map, key, value, maxEntries) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > maxEntries) {
    const firstKey = map.keys().next().value;
    if (firstKey == null) break;
    map.delete(firstKey);
  }
}

function getFileContentFromCache(filePath) {
  return lruGet(fileContentCache, filePath);
}

function setFileContentInCache(filePath, content) {
  lruSet(fileContentCache, filePath, content, MAX_FILE_CONTENT_CACHE_ENTRIES);
}

function countLinesForPrefix(text) {
  const src = String(text || "");
  if (!src.trim()) return 0;
  const trimmed = src.replace(/[\r\n]+$/, "");
  return trimmed ? trimmed.split(/\r\n|\n|\r/).length : 0;
}

let workingCopySnapshot = null;
const diskConflictPaths = new Set();

function markDiskConflictPath(filePath, hasConflict) {
  const p = filePath ? normalizeLibraryPath(filePath) : "";
  if (!p) return;
  if (hasConflict) diskConflictPaths.add(p);
  else diskConflictPaths.delete(p);
  renderUnifiedStatus();
}

function hasDiskConflictPath(filePath) {
  const p = filePath ? normalizeLibraryPath(filePath) : "";
  if (!p) return false;
  return diskConflictPaths.has(p);
}

async function refreshWorkingCopySnapshot() {
  if (!window.api || typeof window.api.getWorkingCopySnapshot !== "function") return null;
  try {
    const res = await window.api.getWorkingCopySnapshot();
    if (!res || !res.ok || !res.snapshot) {
      workingCopySnapshot = null;
      renderUnifiedStatus();
      recordRecentAction("wc.snapshot.missing", {
        ok: Boolean(res && res.ok),
        error: (res && res.error) ? String(res.error) : null,
      });
      return null;
    }
    workingCopySnapshot = res.snapshot;
    renderUnifiedStatus();
    recordRecentAction("wc.snapshot", {
      path: workingCopySnapshot && workingCopySnapshot.path ? String(workingCopySnapshot.path) : null,
      version: workingCopySnapshot && Number.isFinite(Number(workingCopySnapshot.version)) ? Number(workingCopySnapshot.version) : null,
      dirty: workingCopySnapshot ? Boolean(workingCopySnapshot.dirty) : null,
    });
    return workingCopySnapshot;
  } catch (err) {
    logErr(err);
    workingCopySnapshot = null;
    renderUnifiedStatus();
    recordRecentAction("wc.snapshot.error", { error: err && err.message ? String(err.message) : String(err) });
    return null;
  }
}

async function ensureWorkingCopyOpenForPath(filePath) {
  const p = String(filePath || "");
  if (!p) return false;
  if (
    !window.api
    || typeof window.api.getWorkingCopyMeta !== "function"
    || typeof window.api.openWorkingCopy !== "function"
  ) return false;

  try {
    const metaRes = await window.api.getWorkingCopyMeta();
    const metaPath = (metaRes && metaRes.ok && metaRes.meta && metaRes.meta.path) ? String(metaRes.meta.path) : "";
    recordRecentAction("wc.meta", {
      ok: Boolean(metaRes && metaRes.ok),
      path: metaPath || null,
      dirty: (metaRes && metaRes.ok && metaRes.meta) ? Boolean(metaRes.meta.dirty) : null,
      version: (metaRes && metaRes.ok && metaRes.meta && Number.isFinite(Number(metaRes.meta.version))) ? Number(metaRes.meta.version) : null,
    });
    if (metaPath && pathsEqual(metaPath, p)) return true;
  } catch {}

  try {
    recordRecentAction("wc.open", { path: p, reason: "ensureWorkingCopyOpenForPath" });
    await window.api.openWorkingCopy(p);
    const metaRes2 = await window.api.getWorkingCopyMeta();
    const metaPath2 = (metaRes2 && metaRes2.ok && metaRes2.meta && metaRes2.meta.path) ? String(metaRes2.meta.path) : "";
    if (metaPath2 && pathsEqual(metaPath2, p)) {
      await refreshWorkingCopySnapshot();
      return true;
    }
  } catch {}

  return false;
}

async function confirmReloadFromDisk(filePath) {
  if (!window.api || typeof window.api.confirmReloadFromDisk !== "function") return false;
  return Boolean(await window.api.confirmReloadFromDisk(filePath));
}

async function resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId = null } = {}) {
  const p = String(filePath || "");
  if (!p) return { ok: false, cancelled: true, action: "cancel" };
  const forced = await window.api.commitWorkingCopyToDisk({ force: true });
  if (forced && forced.ok) {
    markDiskConflictPath(p, false);
    return { ok: true, action: "overwrite" };
  }
  markDiskConflictPath(p, true);
  return { ok: false, action: "overwrite", error: (forced && forced.error) ? forced.error : "Unable to save file." };
}

async function discardAndReloadWorkingCopyFromDisk(filePath, { restoreTuneId = null } = {}) {
  const p = String(filePath || "");
  if (!p) return { ok: false, error: "Missing file path." };
  if (
    !window.api
    || typeof window.api.openWorkingCopy !== "function"
    || typeof window.api.reloadWorkingCopyFromDisk !== "function"
  ) return { ok: false, error: "Working copy reload is unavailable." };

  await window.api.openWorkingCopy(p);
  const reloaded = await window.api.reloadWorkingCopyFromDisk();
  if (!reloaded || !reloaded.ok) return { ok: false, error: "Unable to reload from disk." };

  const snapReloaded = await refreshWorkingCopySnapshot();
  if (snapReloaded && snapReloaded.path && pathsEqual(snapReloaded.path, p)) {
    setFileContentInCache(p, snapReloaded.text);
    attachTuneUidsToLibraryFile(p, snapReloaded);
  }

  const updatedFile = await refreshLibraryFile(p, { force: true });
  if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) {
    rawModeHeaderEndOffset = Number(updatedFile.headerEndOffset) || 0;
  }
  if (rawMode) {
    const parts = splitFileIntoHeaderAndBody((snapReloaded && snapReloaded.text) ? snapReloaded.text : "");
    suppressHeaderDirty = true;
    setHeaderEditorValue(parts.headerText);
    suppressHeaderDirty = false;
    suppressDirty = true;
    setEditorValue(parts.bodyText);
    suppressDirty = false;
    headerDirty = false;
    updateHeaderStateUI();
    if (currentDoc) {
      currentDoc.path = p;
      currentDoc.content = parts.bodyText;
      currentDoc.dirty = false;
    }
    setDirtyIndicator(false);
  } else if (restoreTuneId) {
    try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
  }

  markDiskConflictPath(p, false);
  return { ok: true, updatedFile };
}

async function saveWorkingCopyCopyAsAndSwitch(sourcePath, { restoreTuneId = null } = {}) {
  const fromPath = String(sourcePath || "");
  if (!fromPath) return { ok: false, error: "Missing file path." };
  if (
    !window.api
    || typeof window.api.showSaveDialog !== "function"
    || typeof window.api.openWorkingCopy !== "function"
    || typeof window.api.writeWorkingCopyToPathAndSwitch !== "function"
  ) return { ok: false, error: "Save Copy As is unavailable." };

  const dir = safeDirname(fromPath);
  const base = stripFileExtension(safeBasename(fromPath));
  const suggestedName = `${base || "Untitled"}_Copy.abc`;
  const targetPath = await window.api.showSaveDialog(suggestedName, dir || undefined);
  if (!targetPath) return { ok: false, cancelled: true };

  await withFileLock(targetPath, async () => {
    if (await fileExists(targetPath)) {
      const confirm = (window.api && typeof window.api.confirmOverwrite === "function")
        ? await window.api.confirmOverwrite(targetPath)
        : "cancel";
      if (confirm !== "replace") throw new Error("Cancelled.");
    }
    await window.api.openWorkingCopy(fromPath);
    const writeRes = await window.api.writeWorkingCopyToPathAndSwitch(targetPath);
    if (!writeRes || !writeRes.ok) throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to save copy.");
  });

  const snap = await refreshWorkingCopySnapshot();
  if (snap && snap.path && pathsEqual(snap.path, targetPath)) {
    setFileContentInCache(targetPath, snap.text);
    attachTuneUidsToLibraryFile(targetPath, snap);
  }
  const updatedFile = await refreshLibraryFile(targetPath, { force: true });
  if (updatedFile && updatedFile.basename) {
    setFileNameMeta(stripFileExtension(updatedFile.basename || ""));
  }
  if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) {
    rawModeHeaderEndOffset = Number(updatedFile.headerEndOffset) || 0;
  }
  activeFilePath = targetPath;
  recordNavFilePath(targetPath);

  if (rawMode) {
    rawModeFilePath = targetPath;
    const parts = splitFileIntoHeaderAndBody((snap && snap.text) ? snap.text : "");
    suppressHeaderDirty = true;
    setHeaderEditorValue(parts.headerText);
    suppressHeaderDirty = false;
    suppressDirty = true;
    setEditorValue(parts.bodyText);
    suppressDirty = false;
    headerDirty = false;
    updateHeaderStateUI();
    if (currentDoc) {
      currentDoc.path = targetPath;
      currentDoc.content = parts.bodyText;
      currentDoc.dirty = false;
    }
    setDirtyIndicator(false);
  } else if (restoreTuneId) {
    try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
  }

  markDiskConflictPath(fromPath, false);
  markDiskConflictPath(targetPath, false);
  return { ok: true, updatedFile, targetPath };
}

let workingCopyTuneSyncTimer = null;
let workingCopyTuneSyncInFlight = false;
let workingCopyTuneSyncQueued = false;
let workingCopyTuneSyncEpoch = 0;
let workingCopyTuneSyncRunPromise = null;
const WORKING_COPY_TUNE_SYNC_DEBOUNCE_MS = 450;

let workingCopyFullSyncTimer = null;
let workingCopyFullSyncInFlight = false;
let workingCopyFullSyncQueued = false;
let workingCopyFullSyncEpoch = 0;
const WORKING_COPY_FULL_SYNC_DEBOUNCE_MS = 450;

function scheduleWorkingCopyTuneSync() {
  if (rawMode) return;
  if (isPayloadMode()) return;
  if (chordProFeature.isEnabled()) return;
  if (!activeTuneUid) return;
  if (!activeTuneMeta || !activeTuneMeta.path) return;
  if (!window.api || typeof window.api.applyWorkingCopyTuneText !== "function") return;
  if (workingCopyTuneSyncTimer) clearTimeout(workingCopyTuneSyncTimer);
  workingCopyTuneSyncTimer = setTimeout(() => {
    workingCopyTuneSyncTimer = null;
    flushWorkingCopyTuneSync().catch(() => {});
  }, WORKING_COPY_TUNE_SYNC_DEBOUNCE_MS);
}

function scheduleWorkingCopyFullSync() {
  if (rawMode) return;
  if (isPayloadMode()) return;
  if (!chordProFeature.isEnabled()) return;
  if (!window.api || typeof window.api.applyWorkingCopyFullText !== "function") return;
  const filePath = String(activeFilePath || (currentDoc && currentDoc.path) || "");
  if (!filePath) return;
  if (workingCopyFullSyncTimer) clearTimeout(workingCopyFullSyncTimer);
  workingCopyFullSyncTimer = setTimeout(() => {
    workingCopyFullSyncTimer = null;
    flushWorkingCopyFullSync().catch(() => {});
  }, WORKING_COPY_FULL_SYNC_DEBOUNCE_MS);
}

function tryResolveActiveTuneUidFromWorkingCopySnapshot() {
  if (rawMode) return false;
  if (isPayloadMode()) return false;
  if (!activeTuneMeta || !activeTuneMeta.path) return false;
  if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)) return false;

  if (activeTuneUid) {
    const byUid = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
      tuneUid: activeTuneUid,
      tuneIndex: null,
      startOffset: null,
    });
    if (byUid && byUid.tuneUid) {
      if (Number.isFinite(Number(byUid.tuneIndex))) activeTuneIndex = Number(byUid.tuneIndex);
      if (activeTuneMeta) {
        activeTuneMeta.startOffset = byUid.start;
        activeTuneMeta.endOffset = byUid.end;
      }
      return true;
    }
  }

  const resolved = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
    tuneUid: null,
    tuneIndex: activeTuneIndex,
    startOffset: activeTuneMeta.startOffset,
  });
  if (!resolved || !resolved.tuneUid) return false;
  activeTuneUid = resolved.tuneUid;
  if (Number.isFinite(Number(resolved.tuneIndex))) activeTuneIndex = Number(resolved.tuneIndex);
  try {
    if (activeTuneMeta) {
      activeTuneMeta.startOffset = Number(resolved.start);
      activeTuneMeta.endOffset = Number(resolved.end);
    }
  } catch {}
  return true;
}

async function flushWorkingCopyTuneSync() {
  if (workingCopyTuneSyncTimer) {
    clearTimeout(workingCopyTuneSyncTimer);
    workingCopyTuneSyncTimer = null;
  }
  const epoch = workingCopyTuneSyncEpoch;
  if (workingCopyTuneSyncInFlight) {
    workingCopyTuneSyncQueued = true;
    if (workingCopyTuneSyncRunPromise) {
      return workingCopyTuneSyncRunPromise;
    }
    return { ok: false, error: "Tune sync is already running." };
  }
  if (rawMode) return { ok: false, skipped: true, reason: "raw_mode" };
  if (isPayloadMode()) return { ok: false, skipped: true, reason: "payload_mode" };
  if (chordProFeature.isEnabled()) return { ok: false, skipped: true, reason: "chordpro_mode" };
  if (!activeTuneUid) {
    // Some open paths (e.g., recents / stale library metadata) may not have a tuneUid yet.
    // Try to self-heal from the current working copy snapshot; otherwise refuse to sync.
    if (!tryResolveActiveTuneUidFromWorkingCopySnapshot()) {
      return { ok: false, error: "Unable to resolve active tune in working copy." };
    }
  }
  if (!activeTuneMeta || !activeTuneMeta.path) return { ok: false, error: "Active tune path is missing." };
  if (!window.api || typeof window.api.applyWorkingCopyTuneText !== "function") {
    return { ok: false, error: "Working copy tune sync is unavailable." };
  }

  const filePath = String(activeTuneMeta.path || "");
  if (!filePath) return { ok: false, error: "Active tune path is missing." };
  if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, filePath)) {
    return { ok: false, error: "Working copy snapshot does not match the active tune file." };
  }

  const tuneTextRaw = getEditorValue();
  const targetX = (activeTuneMeta && activeTuneMeta.xNumber != null)
    ? String(activeTuneMeta.xNumber || "").trim()
    : "";
  const tuneText = targetX
    ? ensureXNumberInAbc(tuneTextRaw, targetX)
    : ensureXNumberInAbc(tuneTextRaw, "");
  workingCopyTuneSyncInFlight = true;
  const runPromise = (async () => {
    let result = { ok: false, error: "Working copy tune sync did not complete." };
    try {
      const res = await window.api.applyWorkingCopyTuneText({
        tuneUid: activeTuneUid,
        tuneIndex: activeTuneIndex,
        text: tuneText,
      });
      if (epoch !== workingCopyTuneSyncEpoch) {
        result = { ok: false, stale: true, error: "Working copy tune sync was superseded." };
        return result;
      }
      if (!res || !res.ok) {
        result = { ok: false, error: (res && res.error) ? String(res.error) : "Unable to apply tune text to working copy." };
        return result;
      }

      const snapshot = await refreshWorkingCopySnapshot();
      if (epoch !== workingCopyTuneSyncEpoch) {
        result = { ok: false, stale: true, error: "Working copy tune sync was superseded." };
        return result;
      }
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
        setFileContentInCache(filePath, snapshot.text);
        const tuneEntry = resolveTuneEntryFromSnapshot(snapshot, {
          tuneUid: activeTuneUid,
          tuneIndex: activeTuneIndex,
          startOffset: activeTuneMeta && activeTuneMeta.startOffset,
        });
        if (tuneEntry && Number.isFinite(Number(tuneEntry.tuneIndex))) {
          activeTuneIndex = tuneEntry.tuneIndex;
        }
        if (tuneEntry && activeTuneMeta) {
          activeTuneMeta.startOffset = tuneEntry.start;
          activeTuneMeta.endOffset = tuneEntry.end;
        }
        result = { ok: true, path: filePath };
      } else {
        result = { ok: false, error: "Working copy snapshot was not refreshed after tune sync." };
      }
    } finally {
      workingCopyTuneSyncInFlight = false;
      if (epoch === workingCopyTuneSyncEpoch && workingCopyTuneSyncQueued) {
        workingCopyTuneSyncQueued = false;
        result = await flushWorkingCopyTuneSync();
      }
    }
    return result;
  })();
  workingCopyTuneSyncRunPromise = runPromise;
  try {
    return await runPromise;
  } finally {
    if (workingCopyTuneSyncRunPromise === runPromise) {
      workingCopyTuneSyncRunPromise = null;
    }
  }
}

async function flushWorkingCopyFullSync() {
  const epoch = workingCopyFullSyncEpoch;
  if (workingCopyFullSyncInFlight) {
    workingCopyFullSyncQueued = true;
    return;
  }
  if (rawMode) return;
  if (isPayloadMode()) return;
  if (!chordProFeature.isEnabled()) return;
  if (!window.api || typeof window.api.applyWorkingCopyFullText !== "function") return;

  const filePath = String(activeFilePath || (currentDoc && currentDoc.path) || "");
  if (!filePath) return;
  if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, filePath)) return;

  workingCopyFullSyncInFlight = true;
  try {
    const nextText = chordProFeature.isFullView() ? getEditorValue() : chordProFeature.getFullText();
    const res = await window.api.applyWorkingCopyFullText(String(nextText || ""));
    if (epoch !== workingCopyFullSyncEpoch) return;
    if (!res || !res.ok) return;
    const snapshot = await refreshWorkingCopySnapshot();
    if (epoch !== workingCopyFullSyncEpoch) return;
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
      setFileContentInCache(filePath, snapshot.text);
    }
  } finally {
    workingCopyFullSyncInFlight = false;
    if (epoch === workingCopyFullSyncEpoch && workingCopyFullSyncQueued) {
      workingCopyFullSyncQueued = false;
      await flushWorkingCopyFullSync();
    }
  }
}

async function discardWorkingCopyChangesForActiveFile() {
  workingCopyTuneSyncEpoch += 1;
  if (workingCopyTuneSyncTimer) {
    clearTimeout(workingCopyTuneSyncTimer);
    workingCopyTuneSyncTimer = null;
  }
  workingCopyTuneSyncQueued = false;
  workingCopyFullSyncEpoch += 1;
  if (workingCopyFullSyncTimer) {
    clearTimeout(workingCopyFullSyncTimer);
    workingCopyFullSyncTimer = null;
  }
  workingCopyFullSyncQueued = false;

  if (rawMode) return false;
  if (chordProFeature.isEnabled()) return false;
  if (!activeTuneMeta || !activeTuneMeta.path) return false;
  if (!window.api || typeof window.api.reloadWorkingCopyFromDisk !== "function") return false;

  try {
    const res = await window.api.reloadWorkingCopyFromDisk();
    if (!res || !res.ok) return false;
    const snapshot = await refreshWorkingCopySnapshot();
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, activeTuneMeta.path)) {
      setFileContentInCache(snapshot.path, snapshot.text);
    }
    if (currentDoc) {
      currentDoc.dirty = false;
      setDirtyIndicator(false);
    }
    return true;
  } catch {
    return false;
  }
}

function reloadActiveTuneTextFromWorkingCopySnapshot() {
  if (rawMode) return false;
  if (!workingCopySnapshot || !workingCopySnapshot.path || !workingCopySnapshot.text) return false;
  if (!activeTuneMeta || !activeTuneMeta.path) return false;
  if (!pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)) return false;

  const tuneIndex = Number.isFinite(Number(activeTuneIndex)) ? Number(activeTuneIndex) : null;
  if (tuneIndex == null) return false;
  const t = Array.isArray(workingCopySnapshot.tunes) ? workingCopySnapshot.tunes[tuneIndex] : null;
  if (!t || !Number.isFinite(Number(t.start)) || !Number.isFinite(Number(t.end))) return false;

  const from = Number(t.start);
  const to = Number(t.end);
  const text = String(workingCopySnapshot.text).slice(from, to);
  suppressDirty = true;
  setEditorValue(text);
  suppressDirty = false;
  if (currentDoc) {
    currentDoc.content = text;
    currentDoc.dirty = false;
  }
  if (activeTuneMeta) {
    activeTuneMeta.startOffset = from;
    activeTuneMeta.endOffset = to;
  }
  setDirtyIndicator(false);
  return true;
}

function attachTuneUidsToLibraryFile(filePath, snapshot) {
  if (!libraryIndex || !libraryIndex.files || !filePath || !snapshot) return;
  const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath));
  if (!fileEntry || !Array.isArray(fileEntry.tunes)) return;
  const wcTunes = Array.isArray(snapshot.tunes) ? snapshot.tunes : [];
  if (!wcTunes.length) return;
  if (fileEntry.tunes.length !== wcTunes.length) return;
  for (let i = 0; i < fileEntry.tunes.length; i += 1) {
    const tune = fileEntry.tunes[i];
    const wcTune = wcTunes[i];
    if (!tune || !wcTune) continue;
    tune.tuneIndex = i;
    tune.tuneUid = wcTune.tuneUid;
    try {
      const xMatch = String(wcTune.xLabel || "").match(/^\s*X:\s*(\d+)/);
      if (xMatch) tune.xNumber = xMatch[1];
    } catch {}
  }
}

function syncLibraryFileFromWorkingCopySnapshot(filePath, snapshot) {
  if (!libraryIndex || !libraryIndex.files || !filePath || !snapshot) return null;
  const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath));
  if (!fileEntry) return null;

  const fullText = String(snapshot.text || "");
  const wcTunes = Array.isArray(snapshot.tunes) ? snapshot.tunes : [];
  const preambleEnd = snapshot.preambleSlice && Number.isFinite(Number(snapshot.preambleSlice.end))
    ? Number(snapshot.preambleSlice.end)
    : 0;
  fileEntry.headerEndOffset = preambleEnd;
  fileEntry.headerText = fullText.slice(0, Math.min(fullText.length, Math.max(0, preambleEnd)));

  const prevTunes = Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
  const prevByUid = new Map();
  for (const t of prevTunes) {
    if (t && t.tuneUid) prevByUid.set(String(t.tuneUid), t);
  }

  const lineStarts = [0];
  for (let i = 0; i < fullText.length; i += 1) {
    if (fullText[i] === "\n") lineStarts.push(i + 1);
  }
  const lineNumberAtOffset = (offset) => {
    const off = Math.max(0, Math.min(fullText.length, Number(offset) || 0));
    let lo = 0;
    let hi = lineStarts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= off) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(1, lo);
  };

  const nextTunes = [];
  for (let i = 0; i < wcTunes.length; i += 1) {
    const wcTune = wcTunes[i];
    if (!wcTune) continue;
    const startOffset = Number(wcTune.start) || 0;
    const endOffset = Number(wcTune.end) || 0;
    const tuneText = fullText.slice(startOffset, Math.min(fullText.length, Math.max(startOffset, endOffset)));
    const parsed = (() => {
      try { return parseTuneIdentityFields(tuneText); } catch { return null; }
    })();
    const xMatch = String(wcTune.xLabel || "").match(/^\s*X:\s*(\d+)/);
    const existing = wcTune.tuneUid ? prevByUid.get(String(wcTune.tuneUid)) : null;

    const title = (existing && existing.title) ? String(existing.title) : (parsed && parsed.title ? String(parsed.title) : "");
    const composer = (existing && existing.composer) ? String(existing.composer) : (parsed && parsed.composer ? String(parsed.composer) : "");
    const key = (existing && existing.key) ? String(existing.key) : (parsed && parsed.key ? String(parsed.key) : "");

    let preview = (existing && existing.preview) ? String(existing.preview) : "";
    if (!preview) {
      preview = title || (xMatch ? `X:${xMatch[1]}` : "");
      if (!preview) {
        const lines = tuneText.split(/\r\n|\n|\r/);
        for (const line of lines) {
          const trimmed = String(line || "").trim();
          if (trimmed) {
            preview = trimmed;
            break;
          }
        }
      }
    }

    const startLine = lineNumberAtOffset(startOffset);
    const endLine = startLine + countLines(tuneText) - 1;
    const xNumber = xMatch ? xMatch[1] : (parsed && parsed.xNumber ? String(parsed.xNumber) : "");

    nextTunes.push({
      ...(existing && typeof existing === "object" ? existing : {}),
      id: `${filePath}::${startOffset}`,
      indexInFile: i + 1,
      tuneIndex: i,
      tuneUid: wcTune.tuneUid || null,
      xNumber,
      title,
      composer,
      key,
      preview,
      startLine,
      endLine,
      startOffset,
      endOffset,
    });
  }

  fileEntry.tunes = nextTunes;
  libraryViewStore.invalidate();
  scheduleRenderLibraryTree();
  updateLibraryStatus();
  scheduleSaveLibraryUiState();
  return fileEntry;
}

function resolveTuneEntryFromSnapshot(snapshot, { tuneUid, tuneIndex, startOffset } = {}) {
  if (!snapshot || !Array.isArray(snapshot.tunes)) return null;
  const tunes = snapshot.tunes;
  let idx = -1;
  if (tuneUid) {
    idx = tunes.findIndex((t) => t && t.tuneUid && t.tuneUid === tuneUid);
  }
  if (idx < 0 && Number.isFinite(Number(tuneIndex))) {
    const candidate = Number(tuneIndex);
    if (candidate >= 0 && candidate < tunes.length) idx = candidate;
  }
  if (idx < 0 && Number.isFinite(Number(startOffset))) {
    const target = Number(startOffset);
    if (Number.isFinite(target)) {
      idx = tunes.findIndex((t) => Number.isFinite(Number(t && t.start)) && Number(t.start) === target);
    }
  }
  if (idx < 0 || idx >= tunes.length) return null;
  const tune = tunes[idx];
  if (!tune) return null;
  const start = Number(tune.start);
  const end = Number(tune.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
  return {
    tuneUid: tune.tuneUid || "",
    tuneIndex: idx,
    start,
    end,
  };
}

async function verifyWorkingCopySaveReachedDisk(filePath) {
  const p = String(filePath || "");
  if (!p) return { ok: false, error: "Missing file path for save verification." };

  const snapshot = await refreshWorkingCopySnapshot();
  if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) {
    return { ok: false, error: "Unable to verify save: working copy snapshot is unavailable." };
  }

  const readRes = await readFile(p);
  if (!readRes || !readRes.ok) {
    return { ok: false, error: (readRes && readRes.error) ? readRes.error : "Unable to verify save: cannot read file from disk." };
  }
  if (String(readRes.data || "") !== String(snapshot.text || "")) {
    return { ok: false, error: "Save verification failed: disk file does not match the committed working copy." };
  }

  if (activeTuneMeta && activeTuneMeta.path && pathsEqual(activeTuneMeta.path, p)) {
    const tuneEntry = resolveTuneEntryFromSnapshot(snapshot, {
      tuneUid: activeTuneUid,
      tuneIndex: activeTuneIndex,
      startOffset: activeTuneMeta.startOffset,
    });
    if (!tuneEntry) {
      return { ok: false, error: "Save verification failed: active tune was not found in the committed file." };
    }
    const targetX = activeTuneMeta && activeTuneMeta.xNumber != null
      ? String(activeTuneMeta.xNumber || "").trim()
      : "";
    const expectedTuneText = targetX
      ? ensureXNumberInAbc(getEditorValue(), targetX)
      : ensureXNumberInAbc(getEditorValue(), "");
    const actualTuneText = String(snapshot.text || "").slice(tuneEntry.start, tuneEntry.end);
    if (actualTuneText !== expectedTuneText) {
      return { ok: false, error: "Save verification failed: the active editor text is not in the committed file." };
    }
  }

  return { ok: true, snapshot };
}
let activeTuneId = null;
let activeTuneUid = null;
let activeTuneIndex = null;
let activeTuneMeta = null;
let activeFilePath = null;
const SAVE_INTENT = Object.freeze({
  NONE: "none",
  REPLACE_TUNE: "replace_tune",
  APPEND_TO_FILE: "append_to_file",
  FULL_FILE: "full_file",
});
let saveSession = {
  intent: SAVE_INTENT.NONE,
  targetPath: "",
  targetTuneUid: "",
  source: "",
};
const MAX_NAV_FILE_HISTORY = 20;
const navFileHistory = [];
let isLibraryVisible = true;
let lastSidebarWidth = 280;
const collapsedFiles = new Set();
const collapsedGroups = new Set();
let groupMode = "file";
let sortMode = "update_desc";
let tuneSortMode = "x_asc";
let toolHealth = null;
let toolHealthError = "";
let toolWarningShown = false;
const groupSortPrefs = new Map();
const groupTuneSortPrefs = new Map();
let renamingFilePath = null;
let renameInFlight = false;
let librarySearchTimer = null;
let pendingLibrarySearch = "";
let suppressLibraryPrefsWrite = true;
let pendingLibraryPrefsPatch = null;
let libraryPrefsSaveTimer = null;
const LIBRARY_PREFS_SAVE_DEBOUNCE_MS = 400;
let lastAppliedLibraryPrefsSig = "";
let latestSettingsSnapshot = null;
let libraryUiStateTimer = null;
let libraryUiStateDirty = false;
const LIBRARY_UI_STATE_DEBOUNCE_MS = 300;

const templatesFeature = createTemplatesFeature({
  elements: {
    modal: $templatesModal,
    list: $templatesList,
    search: $templatesSearch,
    folderLabel: $templatesFolderLabel,
    previewTitle: $templatesPreviewTitle,
    previewText: $templatesPreviewText,
    closeButton: $templatesClose,
    cancelButton: $templatesCancel,
    manageButton: $templatesManage,
    reloadButton: $templatesReload,
    insertButton: $templatesInsert,
    replaceButton: $templatesReplace,
    appendButton: $templatesAppend,
    editButton: $templatesEdit,
  },
  api: window.api,
  readFile,
  safeBasename,
  enableDraggableModal,
  logError: (message) => logErr(message),
  showToast,
  getActiveFileEntry,
  isPayloadMode,
  ensureXNumberInAbc,
  ensureSafeToAbandonCurrentDoc,
  insertTextAtEditorSelection,
  setEditorText: setEditorValue,
  appendTuneTextToFile: appendTuneTextToFileNow,
  showContextMenuAt,
  showSaveError,
});

const libraryViewStore = createLibraryViewStore({
  getIndex: () => libraryIndex,
  safeBasename,
});
const libraryActions = createLibraryActions({
  openTuneFromSelection: openTuneFromLibrarySelection,
});
window.libraryActions = libraryActions;
const moveTuneModalController = createMoveTuneModalController({
  modal: $moveTuneModal,
  closeButton: $moveTuneClose,
  cancelButton: $moveTuneCancel,
  targetSelect: $moveTuneTarget,
  applyButton: $moveTuneApply,
  safeBasename,
  enableDraggableModal,
  showError: showSaveError,
  onMove: moveTuneToFile,
});
const xIssuesModalController = createXIssuesModalController({
  modal: $xIssuesModal,
  infoElement: $xIssuesInfo,
  closeButton: $xIssuesClose,
  copyButton: $xIssuesCopy,
  jumpButton: $xIssuesJump,
  autoFixButton: $xIssuesAutoFix,
  safeBasename,
  enableDraggableModal,
  getFileEntry: (filePath) => libraryIndex && Array.isArray(libraryIndex.files)
    ? libraryIndex.files.find((f) => pathsEqual(f.path, filePath))
    : null,
  refreshFile: refreshLibraryFile,
  loadFile: requestLoadLibraryFile,
  selectTune,
  autoFixFile: renumberXInActiveFile,
  showToast,
});
const errorsPopoverController = createErrorsPopoverController({
  indicator: $errorsIndicator,
  popover: $errorsPopover,
  titleElement: $errorsPopoverTitle,
  listElement: $errorsListPopover,
  getErrors: () => lastErrors,
  getActiveErrorId: () => {
    const active = errorsHighlightState.getActive();
    return active && active.id ? active.id : "";
  },
  computeErrorId,
  onJump: jumpToError,
});
const aboutModalController = createAboutModalController({
  modal: $aboutModal,
  infoElement: $aboutInfo,
  closeButton: $aboutClose,
  copyButton: $aboutCopy,
  api: window.api,
  enableDraggableModal,
  setStatus,
  logError: logErr,
});
const errorsListController = createErrorsListController({
  listElement: $errorList,
  getErrors: () => errorEntries,
  getActiveTuneId: () => activeTuneId,
  getGroupKey: getErrorGroupKey,
  getGroupLabel: getErrorGroupLabel,
  onActivate: async (entry) => {
    if (entry.tuneId && entry.tuneId !== activeTuneId) {
      await selectTune(entry.tuneId);
    }
    if (entry.loc) {
      setEditorSelectionAtLineCol(entry.loc.line, entry.loc.col);
    }
    if (entry.renderLoc && lastRenderPayload && lastRenderPayload.text) {
      const renderIdx = getTextIndexFromLoc(lastRenderPayload.text, entry.renderLoc);
      if (Number.isFinite(renderIdx)) highlightRenderNoteAtIndex(renderIdx);
    }
  },
});
const errorsFocusMessageController = createErrorsFocusMessageController({
  element: $errorsFocusMessage,
  getEditorText: () => editorView ? editorView.state.doc.toString() : "",
  getNavItems: getSortedErrorsForNav,
  computeErrorId,
  parseMeterParts,
  computeMeasureStats: computeMeasureStatsAt,
});
const goToMeasureModalController = createGoToMeasureModalController();

const GROUP_LABELS = {
  file: "File",
  x: "X",
  titlekey: "T",
  composer: "C",
  meter: "M",
  key: "K",
  unit: "L",
  tempo: "Q",
  rhythm: "R",
  source: "S",
  origin: "O",
  group: "G",
};

let libraryTitleKeyLength = 25;
let libraryTitleKeyStrict = false;

function normalizeTitleKey(raw, maxLen = libraryTitleKeyLength, strict = libraryTitleKeyStrict) {
  const input = String(raw || "");
  if (!input.trim()) return "";
  if (strict) {
    const cleaned = input.replace(/\s+/g, " ").trim();
    if (maxLen > 0 && cleaned.length > maxLen) return cleaned.slice(0, maxLen);
    return cleaned;
  }
  let normalized = "";
  try {
    normalized = input.normalize("NFKD");
  } catch {
    normalized = input;
  }
  try {
    normalized = normalized.replace(/\p{M}+/gu, "");
  } catch {
    normalized = normalized.replace(/[\u0300-\u036f]+/g, "");
  }
  normalized = normalized.toLowerCase();
  normalized = normalized
    .replace(/[’‘ʻʼ´`]/g, "'")
    .replace(/[‐-‒–—―]/g, "-")
    .replace(/[。．｡․·•∙⋅]/g, ".")
    .replace(/ı/g, "i");
  try {
    normalized = normalized.replace(/[^0-9a-z\u00c0-\u024f\u0370-\u03ff\u1f00-\u1fff\u0400-\u04ff\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u10a0-\u10ff\u2d00-\u2d2f\uFB50-\uFDFF\uFE70-\uFEFF]+/giu, " ");
  } catch {
    normalized = normalized.replace(/[^0-9a-z]+/gi, " ");
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (maxLen > 0 && normalized.length > maxLen) return normalized.slice(0, maxLen);
  return normalized;
}

function formatPathTail(filePath, segments = 3) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return normalized;
  const tail = parts.slice(Math.max(0, parts.length - Math.max(1, segments))).join("/");
  return parts.length > segments ? `…/${tail}` : tail;
}

function recordNavFilePath(filePath) {
  const normalized = normalizeLibraryPath(filePath);
  if (!normalized) return;
  const last = navFileHistory.length ? navFileHistory[navFileHistory.length - 1] : "";
  if (last && pathsEqual(last, normalized)) return;
  const existingIdx = navFileHistory.findIndex((p) => pathsEqual(p, normalized));
  if (existingIdx >= 0) navFileHistory.splice(existingIdx, 1);
  navFileHistory.push(normalized);
  while (navFileHistory.length > MAX_NAV_FILE_HISTORY) navFileHistory.shift();
}

function getCurrentNavFilePath() {
  try {
    if (activeTuneMeta && activeTuneMeta.path) return String(activeTuneMeta.path);
    if (activeFilePath) return String(activeFilePath);
    if (currentDoc && currentDoc.path) return String(currentDoc.path);
  } catch {}
  return "";
}

function clearSaveSession() {
  saveSession = {
    intent: SAVE_INTENT.NONE,
    targetPath: "",
    targetTuneUid: "",
    source: "",
  };
}

function setSaveSession(next) {
  const n = next || {};
  const intent = String(n.intent || SAVE_INTENT.NONE);
  saveSession = {
    intent: Object.values(SAVE_INTENT).includes(intent) ? intent : SAVE_INTENT.NONE,
    targetPath: String(n.targetPath || ""),
    targetTuneUid: String(n.targetTuneUid || ""),
    source: String(n.source || ""),
  };
}

function resolveSaveSession() {
  if (chordProFeature.isEnabled()) {
    const path = String(activeFilePath || (currentDoc && currentDoc.path) || getCurrentNavFilePath() || "");
    if (path) return { intent: SAVE_INTENT.FULL_FILE, targetPath: path, targetTuneUid: "", source: "chordpro" };
  }
  if (rawMode) {
    const path = String(rawModeFilePath || activeFilePath || (currentDoc && currentDoc.path) || getCurrentNavFilePath() || "");
    if (path) return { intent: SAVE_INTENT.FULL_FILE, targetPath: path, targetTuneUid: "", source: "raw" };
  }
  if (isNewTuneDraft) {
    const path = String(activeFilePath || getCurrentNavFilePath() || "");
    if (path) return { intent: SAVE_INTENT.APPEND_TO_FILE, targetPath: path, targetTuneUid: "", source: "draft" };
  }
  if (activeTuneMeta && activeTuneMeta.path) {
    const path = String(activeTuneMeta.path || "");
    if (path) {
      return {
        intent: SAVE_INTENT.REPLACE_TUNE,
        targetPath: path,
        targetTuneUid: String(activeTuneUid || ""),
        source: "active_tune",
      };
    }
  }
  if (currentDoc && currentDoc.path) {
    return { intent: SAVE_INTENT.FULL_FILE, targetPath: String(currentDoc.path), targetTuneUid: "", source: "doc_path" };
  }
  if (saveSession && saveSession.intent && saveSession.intent !== SAVE_INTENT.NONE) {
    return { ...saveSession };
  }
  return { intent: SAVE_INTENT.NONE, targetPath: "", targetTuneUid: "", source: "none" };
}

function getLibraryRootKey() {
  if (!libraryIndex || !libraryIndex.root) return null;
  const root = String(libraryIndex.root || "");
  const normalized = normalizeLibraryPath(root);
  return normalized || null;
}

function hasFullLibraryIndex() {
  return Boolean(libraryIndex && libraryIndex.indexMode === "full");
}

async function ensureFullLibraryIndex({ reason = "" } = {}) {
  const perfOn = isStartupPerfEnabled();
  const t0 = perfOn ? perfNowMs() : 0;
  if (!window.api || typeof window.api.scanLibrary !== "function") return false;
  if (!libraryIndex || !libraryIndex.root) return false;
  if (hasFullLibraryIndex()) return true;
  if (libraryFullScanInFlight) return false;

  libraryFullScanInFlight = true;
  const scanToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  libraryFullScanToken = scanToken;
  const root = libraryIndex.root;
  setScanStatus(reason ? `Indexing… (${reason})` : "Indexing…");
  try {
    const result = await window.api.scanLibrary(root, { token: scanToken });
    if (!result || !result.root || result.root !== root) return false;
    if (libraryFullScanToken !== scanToken) return false;
    libraryIndex = { ...result, indexMode: "full" };
    libraryViewStore.invalidate();
    updateLibraryRootUI();
    scheduleRenderLibraryTree();
    updateLibraryStatus();
    try {
      if (document.body.classList.contains("library-list-open")) {
        const rows = libraryViewStore.getModalRows();
        document.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
      }
    } catch {}
    return true;
  } catch (e) {
    logErr(e && e.message ? e.message : String(e));
    setScanStatus("Indexing failed.");
    return false;
  } finally {
    if (perfOn) {
      logStartupPerf("ensureFullLibraryIndex()", {
        reason: String(reason || ""),
        ms: Math.round(perfNowMs() - t0),
        root: root ? safeBasename(root) : "",
        ok: hasFullLibraryIndex(),
        files: libraryIndex && libraryIndex.files ? libraryIndex.files.length : 0,
      });
    }
    if (libraryFullScanToken === scanToken) {
      libraryFullScanToken = "";
      libraryFullScanInFlight = false;
    }
  }
}

function isPathWithinRoot(filePath, rootPath) {
  const file = normalizeLibraryPath(String(filePath || ""));
  const root = normalizeLibraryPath(String(rootPath || ""));
  if (!file || !root) return false;
  if (pathsEqual(file, root)) return true;
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return file.startsWith(prefix);
}

function scheduleSaveLibraryPrefs(patch) {
  if (suppressLibraryPrefsWrite) return;
  if (!patch || typeof patch !== "object") return;
  if (!window.api || typeof window.api.updateSettings !== "function") return;

  pendingLibraryPrefsPatch = { ...(pendingLibraryPrefsPatch || {}), ...patch };
  if (libraryPrefsSaveTimer) clearTimeout(libraryPrefsSaveTimer);
  libraryPrefsSaveTimer = setTimeout(async () => {
    const nextPatch = pendingLibraryPrefsPatch;
    pendingLibraryPrefsPatch = null;
    libraryPrefsSaveTimer = null;
    if (!nextPatch) return;
    try {
      await window.api.updateSettings(nextPatch);
    } catch {}
  }, LIBRARY_PREFS_SAVE_DEBOUNCE_MS);
}

function computeLibraryUiStateSnapshot() {
  if (!libraryIndex || !libraryIndex.root) return null;
  const rootKey = getLibraryRootKey();
  if (!rootKey) return null;

  const files = Array.isArray(libraryIndex.files) ? libraryIndex.files : [];
  const expandedFiles = [];
  for (const file of files) {
    if (!file || !file.path) continue;
    if (!collapsedFiles.has(file.path)) expandedFiles.push(file.path);
  }

  const expandedGroupsByMode = {};
  if (groupMode !== "file" && files.length) {
    const groups = buildGroupEntries(files, groupMode);
    const expandedGroups = [];
    for (const group of groups) {
      if (!group || !group.id) continue;
      if (!collapsedGroups.has(group.id)) expandedGroups.push(group.id);
    }
    expandedGroupsByMode[groupMode] = expandedGroups;
  }

  const active = (activeFilePath && isPathWithinRoot(activeFilePath, libraryIndex.root)) ? activeFilePath : null;
  const activeTune = (activeTuneMeta && activeTuneMeta.path && isPathWithinRoot(activeTuneMeta.path, libraryIndex.root))
    ? {
      tuneId: activeTuneId || null,
      filePath: activeTuneMeta.path || null,
      xNumber: activeTuneMeta.xNumber != null ? String(activeTuneMeta.xNumber) : "",
      title: activeTuneMeta.title != null ? String(activeTuneMeta.title) : "",
      startOffset: Number.isFinite(Number(activeTuneMeta.startOffset)) ? Number(activeTuneMeta.startOffset) : null,
    }
    : {
      tuneId: activeTuneId || null,
      filePath: (active && isPathWithinRoot(active, libraryIndex.root)) ? active : null,
      xNumber: "",
      title: "",
      startOffset: null,
    };
  return {
    rootKey,
    state: {
      expandedFiles,
      expandedGroupsByMode,
      activeFilePath: active,
      activeTune,
    },
  };
}

function scheduleSaveLibraryUiState() {
  if (suppressLibraryPrefsWrite) return;
  if (!libraryIndex || !libraryIndex.root) return;
  if (!window.api || typeof window.api.updateSettings !== "function") return;

  libraryUiStateDirty = true;
  if (libraryUiStateTimer) clearTimeout(libraryUiStateTimer);
  libraryUiStateTimer = setTimeout(() => {
    libraryUiStateTimer = null;
    if (!libraryUiStateDirty) return;
    libraryUiStateDirty = false;
    const snap = computeLibraryUiStateSnapshot();
    if (!snap) return;
    scheduleSaveLibraryPrefs({
      libraryUiStateByRoot: {
        [snap.rootKey]: snap.state,
      },
    });
  }, LIBRARY_UI_STATE_DEBOUNCE_MS);
}

function applyLibraryUiStateFromSettings(settings) {
  if (!settings || !libraryIndex || !libraryIndex.root) return false;
  const rootKey = getLibraryRootKey();
  if (!rootKey) return false;
  const byRoot = settings.libraryUiStateByRoot && typeof settings.libraryUiStateByRoot === "object"
    ? settings.libraryUiStateByRoot
    : null;
  const entry = byRoot && byRoot[rootKey] && typeof byRoot[rootKey] === "object"
    ? byRoot[rootKey]
    : null;
  if (!entry) return { restoredFile: false, tuneSelection: null };

  const files = Array.isArray(libraryIndex.files) ? libraryIndex.files : [];
  const filePaths = files.map((f) => f && f.path).filter(Boolean);

  const expandedFiles = Array.isArray(entry.expandedFiles) ? entry.expandedFiles : [];
  const expandedFilesSet = new Set(expandedFiles.map((p) => String(p || "")).filter(Boolean));

  collapsedFiles.clear();
  for (const p of filePaths) collapsedFiles.add(p);
  for (const p of expandedFilesSet) collapsedFiles.delete(p);

  collapsedGroups.clear();
  if (groupMode !== "file" && files.length) {
    const groups = buildGroupEntries(files, groupMode);
    for (const group of groups) collapsedGroups.add(group.id);
    const byMode = entry.expandedGroupsByMode && typeof entry.expandedGroupsByMode === "object"
      ? entry.expandedGroupsByMode
      : null;
    const expandedGroups = byMode && Array.isArray(byMode[groupMode]) ? byMode[groupMode] : [];
    for (const id of expandedGroups) {
      if (!id) continue;
      collapsedGroups.delete(String(id));
    }
  }

  const savedActivePath = entry.activeFilePath ? String(entry.activeFilePath) : "";
  const hasFile = savedActivePath && filePaths.some((p) => pathsEqual(p, savedActivePath));
  if (hasFile) {
    activeFilePath = savedActivePath;
    collapsedFiles.delete(savedActivePath);
  }

  const activeTune = entry.activeTune && typeof entry.activeTune === "object" ? entry.activeTune : null;
  const tuneSelection = activeTune
    ? {
      tuneId: activeTune.tuneId ? String(activeTune.tuneId) : "",
      filePath: activeTune.filePath ? String(activeTune.filePath) : (hasFile ? savedActivePath : ""),
      xNumber: activeTune.xNumber != null ? String(activeTune.xNumber) : "",
      title: activeTune.title != null ? String(activeTune.title) : "",
      startOffset: Number.isFinite(Number(activeTune.startOffset)) ? Number(activeTune.startOffset) : null,
    }
    : null;

  return { restoredFile: Boolean(hasFile), tuneSelection };
}

async function restoreLibraryTuneSelection(selection) {
  if (!libraryIndex || !libraryIndex.root) return false;
  if (!selection) return false;

  const tuneId = selection.tuneId ? String(selection.tuneId) : "";
  const filePath = selection.filePath ? String(selection.filePath) : "";
  const xNumber = selection.xNumber ? String(selection.xNumber) : "";
  const title = selection.title ? String(selection.title) : "";
  const startOffset = selection.startOffset;

  const trySelect = async (id) => {
    if (!id) return false;
    try {
      const res = await selectTune(id, { skipConfirm: true, suppressRecent: true });
      if (res && res.ok) {
        renderLibraryTree();
        return true;
      }
    } catch {}
    return false;
  };

  if (tuneId) {
    const ok = await trySelect(tuneId);
    if (ok) return true;
  }

  let fileEntry = null;
  if (filePath && libraryIndex && Array.isArray(libraryIndex.files)) {
    fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath)) || null;
  }

  if (fileEntry && (!fileEntry.tunes || !fileEntry.tunes.length) && window.api && typeof window.api.parseLibraryFile === "function") {
    try {
      const updated = await refreshLibraryFile(filePath);
      if (updated) fileEntry = updated;
    } catch {}
  }

  const tunes = fileEntry && Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
  if (!tunes.length) return false;

  let candidate = null;
  if (Number.isFinite(startOffset)) {
    candidate = tunes.find((t) => Number(t.startOffset) === Number(startOffset)) || null;
  }
  if (!candidate && xNumber) {
    const matches = tunes.filter((t) => String(t.xNumber || "") === xNumber);
    if (matches.length === 1) candidate = matches[0];
    else if (matches.length > 1 && title) {
      const want = title.trim().toLowerCase();
      candidate = matches.find((t) => String(t.title || "").trim().toLowerCase() === want) || matches[0];
    } else if (matches.length) {
      candidate = matches[0];
    }
  }

  if (!candidate) return false;
  const id = candidate.id ? String(candidate.id) : "";
  return trySelect(id);
}

async function flushLibraryPrefsSave() {
  if (!window.api || typeof window.api.updateSettings !== "function") return;
  if (libraryUiStateTimer) {
    clearTimeout(libraryUiStateTimer);
    libraryUiStateTimer = null;
  }
  if (libraryUiStateDirty) {
    libraryUiStateDirty = false;
    const snap = computeLibraryUiStateSnapshot();
    if (snap) {
      pendingLibraryPrefsPatch = {
        ...(pendingLibraryPrefsPatch || {}),
        libraryUiStateByRoot: {
          [snap.rootKey]: snap.state,
        },
      };
    }
  }
  if (libraryPrefsSaveTimer) {
    clearTimeout(libraryPrefsSaveTimer);
    libraryPrefsSaveTimer = null;
  }
  const nextPatch = pendingLibraryPrefsPatch;
  pendingLibraryPrefsPatch = null;
  if (!nextPatch) return;
  try {
    await window.api.updateSettings(nextPatch);
  } catch {}
}

function applyLibraryPrefsFromSettings(settings) {
  if (!settings) return;
  const normalized = {
    libraryPaneVisible: Boolean(settings.libraryPaneVisible),
    libraryPaneWidth: Number.isFinite(Number(settings.libraryPaneWidth)) ? Math.round(Number(settings.libraryPaneWidth)) : null,
    libraryGroupBy: String(settings.libraryGroupBy || "").trim() || null,
    librarySortBy: String(settings.librarySortBy || "").trim() || null,
    libraryTuneSortBy: String(settings.libraryTuneSortBy || "").trim() || null,
    libraryFilterText: String(settings.libraryFilterText || ""),
    libraryTitleKeyLength: Number.isFinite(Number(settings.libraryTitleKeyLength))
      ? Math.round(Number(settings.libraryTitleKeyLength))
      : null,
    libraryTitleKeyStrict: Boolean(settings.libraryTitleKeyStrict),
    libraryCacheEnabled: Boolean(settings.libraryCacheEnabled),
  };
  const sig = JSON.stringify(normalized);
  if (sig === lastAppliedLibraryPrefsSig) return;
  lastAppliedLibraryPrefsSig = sig;

  const prevSuppress = suppressLibraryPrefsWrite;
  suppressLibraryPrefsWrite = true;
  try {
    const nextGroup = normalized.libraryGroupBy || "";
    if (nextGroup && GROUP_LABELS[nextGroup]) groupMode = nextGroup;
    if ($groupBy) $groupBy.value = groupMode;

    const nextSort = normalizeGroupSortMode(normalized.librarySortBy) || getDefaultGroupSortMode(groupMode);
    setSortMode(nextSort);
    groupSortPrefs.set(groupMode, nextSort);
    const nextTuneSort = normalizeTuneSortMode(normalized.libraryTuneSortBy) || getDefaultTuneSortMode(groupMode);
    setTuneSortMode(nextTuneSort);
    groupTuneSortPrefs.set(groupMode, nextTuneSort);

    const nextFilter = normalized.libraryFilterText;
    if ($librarySearch) $librarySearch.value = nextFilter;
    if (librarySearchTimer) {
      clearTimeout(librarySearchTimer);
      librarySearchTimer = null;
    }
    pendingLibrarySearch = "";
    applyLibrarySearch(nextFilter);

    const keyLen = normalized.libraryTitleKeyLength;
    libraryTitleKeyLength = Number.isFinite(keyLen) && keyLen > 0 ? keyLen : 25;
    libraryTitleKeyStrict = Boolean(normalized.libraryTitleKeyStrict);
    window.__abcarusLibraryTitleKeyLength = libraryTitleKeyLength;
    window.__abcarusLibraryTitleKeyStrict = libraryTitleKeyStrict;
    window.__abcarusLibraryCacheEnabled = Boolean(normalized.libraryCacheEnabled);

    const width = normalized.libraryPaneWidth;
    if (Number.isFinite(width) && width > 0) lastSidebarWidth = width;

    const visible = normalized.libraryPaneVisible;
    setLibraryVisible(visible);
    scheduleRenderLibraryTree();
    try {
      libraryViewStore.invalidate();
      if (document.body.classList.contains("library-list-open")) {
        const rows = libraryViewStore.getModalRows();
        document.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
      }
    } catch {}
  } finally {
    suppressLibraryPrefsWrite = prevSuppress;
  }
}

function updateLibraryRootUI() {
  if (!$libraryRoot) return;
  const root = libraryIndex && libraryIndex.root ? String(libraryIndex.root) : "";
  const tail = formatPathTail(root, 3);
  $libraryRoot.textContent = tail ? `Library: ${tail}` : "Library: (none)";
  $libraryRoot.title = root;
}

function setScanStatus(text, title) {
  const value = String(text || "");
  const titleValue = title == null ? value : String(title || "");
  updateLibraryRootUI();
  const display = value || "";
  if ($scanStatus) {
    $scanStatus.textContent = display;
    $scanStatus.title = titleValue;
  }
}

function setLibraryErrorIndexForTune(tuneId, count) {
  if (!tuneId) return;
  if (count > 0) libraryErrorIndex.set(tuneId, count);
  else libraryErrorIndex.delete(tuneId);
  if (tuneErrorFilter && !tuneErrorScanInFlight) {
    updateFileContext();
  }
}

function clearErrorIndexForFile(entry) {
  if (!entry || !entry.tunes) return;
  for (const tune of entry.tunes) {
    if (tune && tune.id) libraryErrorIndex.delete(tune.id);
  }
}

function updateLibraryErrorIndexFromCurrentErrors() {
  if (!activeTuneId) return;
  let count = 0;
  for (const entry of errorEntries) {
    if (entry.tuneId === activeTuneId) count += entry.count || 1;
  }
  setLibraryErrorIndexForTune(activeTuneId, count);
}

function stripFileExtension(name) {
  const value = String(name || "");
  return value.replace(/\.[^.]+$/, "");
}

function setFileNameMeta(name) {
  if (!$fileNameMeta) return;
  $fileNameMeta.textContent = name || "Untitled";
  updateWindowTitle();
}

		function updateWindowTitle() {
		  const tuneDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(isNewTuneDraft);
		  const dirtyTag = (tuneDirty || headerDirty) ? "*" : "";
		  const filePath = (currentDoc && currentDoc.path) ? String(currentDoc.path) : "";
		  const fileNameWithExt = filePath ? safeBasename(filePath) : UNTITLED_UNSAVED_LABEL;
		  const dirPath = filePath ? safeDirname(filePath) : (libraryIndex && libraryIndex.root ? String(libraryIndex.root) : "");
		  const dirShort = formatPathTail(dirPath, 3);
		  const display = dirShort ? `${dirShort}/${fileNameWithExt}` : fileNameWithExt;
		  document.title = `ABCarus — ${display}${dirtyTag}`;
		}

function buildTuneMetaLabel(metadata) {
  if (!metadata) return "Untitled";
  const xPart = metadata.xNumber ? `X:${metadata.xNumber}` : "";
  const title = metadata.title || "";
  const label = `${xPart} ${title}`.trim();
  return label || "Untitled";
}

let tuneBadgeText = "";
let bufferStatusText = "";

let appStatusText = "Ready";
let midiImportInProgress = false;
let startupUiLoading = true;
let startupSettingsApplied = false;
let startupAutoLoadStarted = false;
let startupRecentOpenStarted = false;

function markStartupUiReady() {
  if (!startupUiLoading) return;
  startupUiLoading = false;
  renderUnifiedStatus();
}

function markStartupSettingsApplied() {
  if (startupSettingsApplied) return;
  startupSettingsApplied = true;
  if (!startupRecentOpenStarted && !startupAutoLoadStarted) {
    markStartupUiReady();
  } else {
    renderUnifiedStatus();
  }
}

function computeWorkingCopyFileState() {
  const filePath = rawMode
    ? (rawModeFilePath || (currentDoc && currentDoc.path) || activeFilePath || "")
    : ((activeTuneMeta && activeTuneMeta.path) || (currentDoc && currentDoc.path) || activeFilePath || "");
  if (!filePath) return { kind: "ready", label: "Ready", filePath: "" };

  const tuneDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(isNewTuneDraft);
  const hdrDirty = Boolean(headerDirty);
  const conflict = hasDiskConflictPath(filePath);

  if ($editorPane) {
    $editorPane.classList.toggle("unsaved", Boolean(tuneDirty));
    $editorPane.classList.toggle("conflict", Boolean(conflict));
  }

  let label = "";
  let kind = "";
  if (conflict) {
    label = "Changed on disk";
    kind = "conflict";
  } else if (tuneDirty || hdrDirty) {
    label = "Unsaved changes";
    kind = "dirty";
  } else {
    label = "Saved";
    kind = "saved";
  }

  return { kind, label, filePath };
}

function renderUnifiedStatus() {
  if (!$status) return;

  const raw = String(appStatusText || "");
  const normalized = raw.trim();
  const display = normalized === "OK" ? "Ready" : raw;
  const displayNorm = String(display || "").trim();

  const fileState = computeWorkingCopyFileState();

  const isNeutral = !displayNorm || /^ready\b/i.test(displayNorm);
  const label = startupUiLoading && isNeutral
    ? "Loading…"
    : (isNeutral ? "Ready" : display);
  const kind = startupUiLoading && isNeutral
    ? "loading"
    : (isNeutral ? "ready" : (fileState.kind === "conflict" ? "conflict" : (fileState.kind === "dirty" ? "dirty" : "ready")));

  $status.textContent = label || "Ready";

  $status.classList.toggle("status-ready", kind === "ready");
  $status.classList.toggle("status-saved", kind === "saved");
  $status.classList.toggle("status-dirty", kind === "dirty");
  $status.classList.toggle("status-conflict", kind === "conflict");

  const loading = kind === "loading" || String(label || "").toLowerCase().startsWith("loading the sound font");
  $status.classList.toggle("status-loading", loading);
}

function renderBufferStatus() {
  if (!$bufferStatus) return;
  if (bufferStatusText) {
    $bufferStatus.textContent = bufferStatusText;
    return;
  }
  if (!isLibraryVisible && tuneBadgeText) {
    $bufferStatus.textContent = tuneBadgeText;
    return;
  }
  $bufferStatus.textContent = "";
}

function setTuneMetaText(text) {
  tuneBadgeText = String(text || "");
  renderBufferStatus();
}

const sourceLinkFeature = createSourceLinkFeature({
  documentRef: document,
  api: window.api,
  parseAbcHeaderFields,
  showToast,
  getEditorText: getEditorValue,
  hasEditor: () => Boolean(editorView),
  isDisabled: () => Boolean(rawMode || chordProFeature.isEnabled()),
  shouldIncludePrintQr: () => Boolean(latestSettingsSnapshot && latestSettingsSnapshot.printSourceQrCodes),
});

function setDirtyIndicator(isDirty) {
  if (!$dirtyIndicator) return;
  const tuneDirty = Boolean(isDirty);
  const hdrDirty = Boolean(headerDirty);
  if (rawMode) {
    // In raw mode, the file-level dirty state is shown by the File State indicator.
    // Keep this chip only for header-specific unsaved state to avoid redundant UI.
    if (hdrDirty) {
      $dirtyIndicator.textContent = "Header: Unsaved";
      $dirtyIndicator.classList.add("active");
    } else {
      $dirtyIndicator.textContent = "";
      $dirtyIndicator.classList.remove("active");
    }
    updateLibraryDirtyState(tuneDirty || hdrDirty);
    updateWindowTitle();
    renderUnifiedStatus();
    return;
  }

  // In normal mode, the file-level dirty state is shown by the File State indicator.
  // Keep this chip only for header-specific unsaved state to avoid redundant UI.
  if (hdrDirty) {
    $dirtyIndicator.textContent = tuneDirty ? "Header+Tune: Unsaved" : "Header: Unsaved";
    $dirtyIndicator.classList.add("active");
  } else {
    $dirtyIndicator.textContent = "";
    $dirtyIndicator.classList.remove("active");
  }
  updateLibraryDirtyState(tuneDirty || hdrDirty);
  updateWindowTitle();
  renderUnifiedStatus();
}

function computeHeaderPresence() {
  const entry = getActiveFileEntry();
  if (!entry) return "none";
  const currentHeader = getHeaderEditorValue();
  const hasHeader = Boolean(String(currentHeader || "").trim());
  if (hasHeader || headerDirty) return "present";
  return "none";
}

function updateHeaderStateUI({ announce = false } = {}) {
  const presence = computeHeaderPresence();
  const state = (presence === "present")
    ? (headerDirty ? "present_dirty" : "present_clean")
    : "none";

  if ($fileHeaderToggle) {
    $fileHeaderToggle.classList.toggle("present", presence === "present");
    $fileHeaderToggle.classList.toggle("dirty", Boolean(headerDirty));
    if (state === "none") {
      $fileHeaderToggle.title = "No file header in this file.";
    } else if (state === "present_clean") {
      $fileHeaderToggle.title = "File header present (affects rendering & playback).";
    } else {
      $fileHeaderToggle.title = "File header modified (unsaved) — affects rendering & playback.";
    }
  }
  if ($headerStateMarker) {
    $headerStateMarker.textContent = (state === "none") ? "—" : (state === "present_clean" ? "✓" : "✓*");
  }

  setDirtyIndicator(Boolean(currentDoc && currentDoc.dirty));

  // Intentionally no toast: header presence is visible via the chip title/state.
  // (Previously this was gated behind debug messages, but it was still noisy.)
  void announce;
}

function updateLibraryDirtyState(isDirty) {
  if (!activeFilePath || !$libraryTree) return;
  const fileNodes = $libraryTree.querySelectorAll(".tree-file");
  for (const node of fileNodes) {
    const label = node.querySelector(".tree-label");
    if (!label) continue;
    const isActive = label.dataset && label.dataset.filePath === activeFilePath;
    node.classList.toggle("dirty", isActive && Boolean(isDirty));
  }
}

function buildTuneSelectOptions(fileEntry) {
  if (!$fileTuneSelect) return;
  $fileTuneSelect.textContent = "";
  if (!fileEntry || !fileEntry.tunes || !fileEntry.tunes.length) {
    $fileTuneSelect.disabled = true;
    return;
  }
  const sourceTunes = fileEntry.tunes.slice().sort((a, b) => (Number(a.xNumber) || 0) - (Number(b.xNumber) || 0));
  const tunes = tuneErrorFilter
    ? sourceTunes.filter((tune) => libraryErrorIndex.has(tune.id))
    : sourceTunes;
  if (isNewTuneDraft) {
    const option = document.createElement("option");
    option.value = "__new__";
    option.textContent = "(New tune draft)";
    option.selected = true;
    $fileTuneSelect.appendChild(option);
  }
  if (tuneErrorFilter && tuneErrorScanInFlight && !libraryErrorIndex.size) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "(Scanning errors…)";
    option.disabled = true;
    option.selected = true;
    $fileTuneSelect.appendChild(option);
    $fileTuneSelect.disabled = true;
    return;
  }
  if (!tunes.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = tuneErrorFilter ? "(No error tunes)" : "(No tunes)";
    option.disabled = true;
    option.selected = true;
    $fileTuneSelect.appendChild(option);
    $fileTuneSelect.disabled = true;
    return;
  }
  for (const tune of tunes) {
    const option = document.createElement("option");
    option.value = rawMode ? tune.id : (tune.tuneUid || tune.id);
    const title = tune.title || tune.preview || "";
    const label = tune.xNumber ? `X:${tune.xNumber} ${title}`.trim() : title || tune.id;
    option.textContent = label;
    $fileTuneSelect.appendChild(option);
  }
  $fileTuneSelect.disabled = false;
  if (!isNewTuneDraft && (activeTuneUid || activeTuneId)) {
    $fileTuneSelect.value = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
  }
  if (!isNewTuneDraft && !$fileTuneSelect.value) {
    $fileTuneSelect.selectedIndex = 0;
  }
}

function updateFileContext() {
  if (chordProFeature.isEnabled()) {
    chordProFeature.updateSelectOptions();
    setScanErrorButtonVisibility(null);
    setScanErrorButtonActive(false);
    return;
  }
  const entry = getActiveFileEntry();
  if (!entry) {
    if ($fileTuneSelect) {
      $fileTuneSelect.textContent = "";
      $fileTuneSelect.disabled = true;
    }
    setScanErrorButtonVisibility(null);
    setScanErrorButtonActive(false);
    return;
  }
  buildTuneSelectOptions(entry);
  setScanErrorButtonVisibility(entry);
  setScanErrorButtonActive(tuneErrorFilter);
}

function getNavigableTuneIdsFromFileSelect() {
  if (!$fileTuneSelect || $fileTuneSelect.disabled) return [];
  const ids = [];
  for (const opt of Array.from($fileTuneSelect.options || [])) {
    if (!opt || opt.disabled) continue;
    const value = opt.value != null ? String(opt.value) : "";
    if (!value || value === "__new__") continue;
    ids.push(value);
  }
  return ids;
}

async function navigateTuneByDelta(delta) {
  if (chordProFeature.isEnabled()) {
    chordProFeature.setActiveBlock(chordProFeature.getActiveIndex() + delta, { scroll: true });
    return;
  }
  // Prefer file order navigation based on the active tune metadata.
  // This stays stable even if the tune `<select>` temporarily drifts (filters, rebuilds, etc).
  const filePath = (activeTuneMeta && activeTuneMeta.path)
    ? String(activeTuneMeta.path)
    : (activeFilePath ? String(activeFilePath) : "");
  const fileEntry = (filePath && libraryIndex && Array.isArray(libraryIndex.files))
    ? (libraryIndex.files.find((f) => pathsEqual(f && f.path, filePath)) || null)
    : null;

  const orderedTunes = fileEntry && Array.isArray(fileEntry.tunes)
    ? fileEntry.tunes.slice().sort((a, b) => (Number(a.startOffset) || 0) - (Number(b.startOffset) || 0))
    : [];

  const selectedValue = ($fileTuneSelect && $fileTuneSelect.value != null) ? String($fileTuneSelect.value) : "";
  const activeKey = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
  const findCurrentInOrdered = () => {
    if (!orderedTunes.length) return -1;
    if (activeKey) {
      const idx = orderedTunes.findIndex((t) => {
        if (!t) return false;
        if (!rawMode && t.tuneUid && t.tuneUid === activeKey) return true;
        return Boolean(t.id && t.id === activeKey);
      });
      if (idx >= 0) return idx;
    }
    if (activeTuneMeta && Number.isFinite(Number(activeTuneMeta.startOffset))) {
      const off = Number(activeTuneMeta.startOffset);
      const idx = orderedTunes.findIndex((t) => Number(t && t.startOffset) === off);
      if (idx >= 0) return idx;
    }
    if (selectedValue) {
      const idx = orderedTunes.findIndex((t) => {
        if (!t) return false;
        if (!rawMode && t.tuneUid && t.tuneUid === selectedValue) return true;
        return Boolean(t.id && t.id === selectedValue);
      });
      if (idx >= 0) return idx;
    }
    return -1;
  };

  let nextId = "";
  let nextTune = null;
  if (orderedTunes.length) {
    const currentIdx = findCurrentInOrdered();
    const startIdx = currentIdx >= 0 ? currentIdx : (delta > 0 ? 0 : orderedTunes.length - 1);
    const nextIdx = Math.max(0, Math.min(orderedTunes.length - 1, startIdx + delta));
    nextTune = orderedTunes[nextIdx];
    nextId = nextTune
      ? String(rawMode ? nextTune.id : (nextTune.tuneUid || nextTune.id) || "")
      : "";
    if (!nextId) return;
    if (currentIdx === nextIdx) {
      showToast(delta > 0 ? "Already at last tune." : "Already at first tune.", 1400);
      return;
    }
  } else {
    // Fallback: navigate within the tune `<select>` (respects error filtering).
    const ids = getNavigableTuneIdsFromFileSelect();
    if (!ids.length) {
      showToast(tuneErrorFilter ? "No error tunes in selection." : "No tunes to navigate.", 2000);
      return;
    }
    const selectedIsNavigable = selectedValue && ids.includes(selectedValue);
    const activeIsNavigable = activeKey && ids.includes(activeKey);
    const current = selectedIsNavigable ? selectedValue : (activeIsNavigable ? activeKey : "");
    const currentIdx = current ? ids.indexOf(current) : -1;
    const startIdx = currentIdx >= 0 ? currentIdx : (delta > 0 ? 0 : ids.length - 1);
    const nextIdx = Math.max(0, Math.min(ids.length - 1, startIdx + delta));
    nextId = ids[nextIdx];
    if (!nextId) return;
    if (currentIdx === nextIdx) {
      showToast(delta > 0 ? "Already at last tune." : "Already at first tune.", 1400);
      return;
    }
  }

  if (rawMode) {
    const rawTuneId = nextTune && nextTune.id ? String(nextTune.id) : String(nextId);
    if ($fileTuneSelect) $fileTuneSelect.value = rawTuneId;
    setActiveTuneInRaw(rawTuneId);
    scrollToTuneInRaw(rawTuneId);
    return;
  }
  await selectTune(nextId);
}

function setHeaderEditorValue(text) {
  if (!headerEditorView) return;
  if (text != null && typeof text !== "string") {
    console.error("[abcarus] setHeaderEditorValue received non-string; dropped:", Object.prototype.toString.call(text));
    return;
  }
  const doc = headerEditorView.state.doc;
  headerEditorView.dispatch({
    changes: { from: 0, to: doc.length, insert: text || "" },
  });
}

const measureErrorPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = measureErrorVersion;
    this.decorations = buildMeasureErrorDecorations(view.state, measureErrorRanges);
  }
  update(update) {
    if (update.docChanged) {
      try {
        this.decorations = this.decorations.map(update.changes);
      } catch {}
      if (measureErrorRanges && measureErrorRanges.length) {
        try {
          const max = update.state.doc.length;
          const mapped = [];
          for (const r of measureErrorRanges) {
            const start = update.changes.mapPos(Number(r.start), 1);
            const end = update.changes.mapPos(Number(r.end), -1);
            const s = Math.max(0, Math.min(start, max));
            const e = Math.max(s, Math.min(end, max));
            if (e > s) mapped.push({ start: s, end: e });
          }
          measureErrorRanges = mapped;
        } catch {}
      }
    }
    if (update.docChanged || update.selectionSet || this.version !== measureErrorVersion) {
      this.version = measureErrorVersion;
      this.decorations = buildMeasureErrorDecorations(update.state, measureErrorRanges);
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function setMeasureErrorRanges(ranges) {
  measureErrorRanges = ranges || [];
  measureErrorVersion += 1;
  if (!editorView) return;
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
}

const abPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = abLoopRuntime.getMarkerVersion();
    this.decorations = buildAbDecorations(view.state, abLoopRuntime.getMarkers());
  }
  update(update) {
    if (update.docChanged || update.selectionSet || this.version !== abLoopRuntime.getMarkerVersion()) {
      this.version = abLoopRuntime.getMarkerVersion();
      this.decorations = buildAbDecorations(update.state, abLoopRuntime.getMarkers());
    } else if (update.docChanged && abLoopRuntime.getMarkers()) {
      // map markers to new positions
      try {
        abLoopRuntime.mapMarkers(update.changes, update.state.doc.length);
      } catch {}
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function refreshAbMarkers() {
  if (editorView) {
    editorView.dispatch({ selection: editorView.state.selection, scrollIntoView: false });
  }
}

const barMismatchPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = barMismatchVersion;
    this.decorations = buildBarMismatchDecorations(view.state, barMismatchMarkers);
  }
  update(update) {
    if (update.docChanged && barMismatchMarkers && barMismatchMarkers.length) {
      try {
        const max = update.state.doc.length;
        const mapped = [];
        for (const marker of barMismatchMarkers) {
          if (!marker || !Number.isFinite(marker.offset)) continue;
          const nextOffset = update.changes.mapPos(Number(marker.offset), 1);
          if (!Number.isFinite(nextOffset)) continue;
          const clamped = Math.max(0, Math.min(max, nextOffset));
          mapped.push({ ...marker, offset: clamped });
        }
        barMismatchMarkers = mapped;
      } catch {}
    }
    if (update.docChanged || this.version !== barMismatchVersion) {
      this.version = barMismatchVersion;
      this.decorations = buildBarMismatchDecorations(update.state, barMismatchMarkers);
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function setBarMismatchMarkers(markers) {
  barMismatchMarkers = Array.isArray(markers) ? markers : [];
  barMismatchVersion += 1;
  if (!editorView) return;
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
}

let intonationHighlightRanges = [];
let intonationHighlightVersion = 0;

const intonationHighlightPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = intonationHighlightVersion;
    this.decorations = buildIntonationHighlightDecorations(view.state, intonationHighlightRanges);
  }
  update(update) {
    if (update.docChanged || this.version !== intonationHighlightVersion) {
      this.version = intonationHighlightVersion;
      this.decorations = buildIntonationHighlightDecorations(update.state, intonationHighlightRanges);
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function setIntonationHighlightRanges(ranges) {
  intonationHighlightRanges = Array.isArray(ranges) ? ranges : [];
  intonationHighlightVersion += 1;
  if (!editorView) return;
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
}

let payloadLayerVersion = 0;
function getPayloadLayerDecorationOptions() {
  return payloadModeFeature.getLayerDecorationOptions();
}

const payloadLayerPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.version = payloadLayerVersion;
    this.decorations = buildPayloadLayerDecorations(view.state, getPayloadLayerDecorationOptions());
  }
  update(update) {
    if (update.docChanged || this.version !== payloadLayerVersion) {
      this.version = payloadLayerVersion;
      this.decorations = buildPayloadLayerDecorations(update.state, getPayloadLayerDecorationOptions());
    }
  }
}, {
  decorations: (v) => v.decorations,
});

function refreshPayloadLayerDecorations() {
  payloadLayerVersion += 1;
  if (!editorView) return;
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
}

let intonationExplorerFeature = null;

const microtonalToolsFeature = createMicrotonalToolsFeature({
  makamDna: {
    modal: $makamDnaModal,
    closeButton: $makamDnaClose,
    cancelButton: $makamDnaCancel,
    editor: $makamDnaEditor,
    status: $makamDnaStatus,
    resetBuiltinButton: $makamDnaResetBuiltin,
    saveButton: $makamDnaSave,
  },
  api: window.api,
  enableDraggable: enableDraggableModal,
  logError: (e) => logErr(e && e.message ? e.message : String(e)),
  showToast: (message, timeout) => showToast(message, timeout),
  onMakamDnaChanged: async () => {
    if (intonationExplorerFeature) {
      intonationExplorerFeature.populateMakams();
      if (intonationExplorerFeature.isVisible()) {
        try { await intonationExplorerFeature.refresh(); } catch {}
      }
    }
  },
});

const perdeService = createPerdeService();

let lastSvgIntonationBarEls = [];
let lastSvgIntonationNoteEls = [];
function clearSvgIntonationBarHighlight() {
  if (!lastSvgIntonationBarEls || !lastSvgIntonationBarEls.length) return;
  for (const el of lastSvgIntonationBarEls) {
    try { el.classList.remove("svg-intonation-bar"); } catch {}
  }
  lastSvgIntonationBarEls = [];
}

function clearSvgIntonationNoteHighlight() {
  if (!lastSvgIntonationNoteEls || !lastSvgIntonationNoteEls.length) return;
  for (const el of lastSvgIntonationNoteEls) {
    try { el.classList.remove("svg-intonation-note"); } catch {}
  }
  lastSvgIntonationNoteEls = [];
}

function getIntonationSelectionScope() {
  if (!editorView || rawMode || isPayloadMode()) return null;
  try {
    const sel = editorView.state && editorView.state.selection ? editorView.state.selection.main : null;
    if (!sel || sel.empty) return null;
    const docLen = editorView.state && editorView.state.doc ? editorView.state.doc.length : 0;
    const start = Math.max(0, Math.min(docLen, Math.min(sel.anchor, sel.head)));
    const end = Math.max(start, Math.min(docLen, Math.max(sel.anchor, sel.head)));
    if (end <= start) return null;
    const selectedText = editorView.state.doc.sliceString(start, end);
    if (!/[A-Ga-gxzZ]/.test(selectedText)) return null;
    return { start, end, label: "selection" };
  } catch {
    return null;
  }
}

function highlightSvgIntonationBarsAtEditorOffsets(offsets) {
  if (!$out || !$renderPane) return false;
  if (!editorView) return false;
  const list = Array.isArray(offsets) ? offsets.filter((n) => Number.isFinite(n)) : [];
  if (!list.length) {
    clearSvgIntonationBarHighlight();
    return false;
  }
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const editorText = editorView.state.doc.toString();
  const measures = new Map();
  for (const offset of list) {
    const measure = findMeasureRangeAt(editorText, offset);
    if (!measure) continue;
    const key = `${measure.start}:${measure.end}`;
    if (!measures.has(key)) measures.set(key, measure);
  }
  const uniqMeasures = Array.from(measures.values());
  const barEls = uniqMeasures.length ? Array.from($out.querySelectorAll(".bar-hl")) : [];
  if (!uniqMeasures.length || !barEls.length) {
    clearSvgIntonationBarHighlight();
    return false;
  }
  const hits = new Set();
  for (const measure of uniqMeasures) {
    const start = mapEditorOffsetToRenderIdx(measure.start);
    const end = mapEditorOffsetToRenderIdx(measure.end);
    for (const el of barEls) {
      const s = Number(el.dataset && el.dataset.start);
      const e = Number(el.dataset && el.dataset.end);
      if (!Number.isFinite(s)) continue;
      const stop = Number.isFinite(e) ? e : s + 1;
      if (s < end && stop > start) hits.add(el);
    }
  }
  clearSvgIntonationBarHighlight();
  lastSvgIntonationBarEls = Array.from(hits);
  for (const el of lastSvgIntonationBarEls) {
    try { el.classList.add("svg-intonation-bar"); } catch {}
  }
  return lastSvgIntonationBarEls.length > 0;
}

function highlightSvgIntonationNotesAtEditorOffsets(offsets) {
  if (!$out || !$renderPane) return false;
  if (!Number.isFinite(lastRenderIdx)) {
    // Rendering may not be ready yet; avoid highlighting stale DOM.
  }
  const list = Array.isArray(offsets) ? offsets.filter((n) => Number.isFinite(n)) : [];
  clearSvgIntonationNoteHighlight();
  if (!list.length) return false;

  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const hits = new Set();
  const maxHits = 800; // keep UI responsive for very dense tunes
  const maxBack = 120;

  for (const editorOffset of list) {
    if (hits.size >= maxHits) break;
    const renderIdx = mapEditorOffsetToRenderIdx(Number(editorOffset));
    if (!Number.isFinite(renderIdx)) continue;
    let els = $out.querySelectorAll("._" + renderIdx + "_");
    if ((!els || !els.length) && Number.isFinite(renderIdx)) {
      for (let d = 1; d <= maxBack; d += 1) {
        const probe = renderIdx - d;
        if (probe < 0) break;
        els = $out.querySelectorAll("._" + probe + "_");
        if (els && els.length) break;
      }
    }
    if (!els || !els.length) continue;
    for (const el of Array.from(els)) {
      if (hits.size >= maxHits) break;
      if (!el) continue;
      // Prefer note overlay elements for highlighting (more precise than bar-wide regions).
      if (el.classList && el.classList.contains("note-hl")) {
        hits.add(el);
        continue;
      }
      const noteEls = el.querySelectorAll ? el.querySelectorAll(".note-hl") : [];
      if (noteEls && noteEls.length) {
        for (const n of Array.from(noteEls)) {
          if (hits.size >= maxHits) break;
          hits.add(n);
        }
      }
    }
  }

  lastSvgIntonationNoteEls = Array.from(hits);
  for (const el of lastSvgIntonationNoteEls) {
    try { el.classList.add("svg-intonation-note"); } catch {}
  }
  return lastSvgIntonationNoteEls.length > 0;
}

intonationExplorerFeature = createIntonationExplorerFeature({
  elements: {
    document,
  },
  host: {
    clearSvgBarHighlight: clearSvgIntonationBarHighlight,
    clearSvgNoteHighlight: clearSvgIntonationNoteHighlight,
    enableDraggableToolPanel,
    ensureToolPanelDefaultLeftPosition,
    focusEditorAt: (offset) => {
      if (!editorView || !Number.isFinite(offset)) return;
      const docLen = editorView.state && editorView.state.doc ? editorView.state.doc.length : 0;
      const safeOff = Math.max(0, Math.min(docLen, offset));
      editorView.dispatch({ selection: { anchor: safeOff, head: safeOff }, scrollIntoView: true });
      try { editorView.focus(); } catch {}
    },
    getSelectionScope: getIntonationSelectionScope,
    highlightBarsAtOffsets: highlightSvgIntonationBarsAtEditorOffsets,
    highlightNotesAtOffsets: highlightSvgIntonationNotesAtEditorOffsets,
    isPerfEnabled: isIntonationPerfEnabled,
    isRawMode: () => rawMode,
    logError: (e) => logErr(e && e.message ? e.message : String(e)),
    logPerf: logIntonationPerf,
    nowMs: perfNowMs,
    refreshWorkingCopySnapshot,
    resolveActiveTune: (snapshot) => resolveTuneEntryFromSnapshot(snapshot, {
      tuneUid: activeTuneUid,
      tuneIndex: activeTuneIndex,
      startOffset: activeTuneMeta && activeTuneMeta.startOffset,
    }),
    scrollToCurrentHighlight: () => {
      const note = lastSvgIntonationNoteEls && lastSvgIntonationNoteEls.length ? lastSvgIntonationNoteEls[0] : null;
      const bar = lastSvgIntonationBarEls && lastSvgIntonationBarEls.length ? lastSvgIntonationBarEls[0] : null;
      if (note) maybeScrollRenderToNote(note);
      else if (bar) maybeScrollRenderToNote(bar);
    },
    setHighlightRanges: setIntonationHighlightRanges,
    showToast: (message, timeout) => showToast(message, timeout),
  },
  microtonalTools: microtonalToolsFeature,
  perdeService,
  clipboard: navigator && navigator.clipboard ? navigator.clipboard : null,
});
intonationExplorerFeature.wire();

function ensureToolPanelDefaultLeftPosition(panelEl) {
  if (!panelEl) return;
  const hasInlinePos = Boolean(panelEl.style.left || panelEl.style.top || panelEl.style.right || panelEl.style.bottom);
  requestAnimationFrame(() => {
    try {
      const rect = panelEl.getBoundingClientRect();
      const margin = 24;
      const defaultTop = 72;
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      const currentLeft = hasInlinePos && Number.isFinite(rect.left) ? rect.left : margin;
      const currentTop = hasInlinePos && Number.isFinite(rect.top) ? rect.top : defaultTop;
      const left = Math.max(0, Math.min(maxLeft, currentLeft));
      const top = Math.max(0, Math.min(maxTop, currentTop));
      panelEl.style.left = `${left}px`;
      panelEl.style.top = `${top}px`;
      panelEl.style.right = "auto";
      panelEl.style.bottom = "auto";
    } catch {}
  });
}

function getHeaderEditorValue() {
  if (!headerEditorView) return "";
  return headerEditorView.state.doc.toString();
}

function setHeaderCollapsed(collapsed) {
  headerCollapsed = collapsed;
  if ($fileHeaderPanel) {
    $fileHeaderPanel.classList.toggle("collapsed", headerCollapsed);
  }
}

function toggleHeaderCollapsed() {
  setHeaderCollapsed(!headerCollapsed);
}

function sortTunes(list, mode) {
  return sortTunesCore(list, mode, { groupMode, safeBasename });
}

function sortLibraryFiles(files) {
  return sortLibraryFilesCore(files, { groupMode, sortMode, tuneSortMode, safeBasename });
}

function sortGroupEntries(entries) {
  return sortGroupEntriesCore(entries, { groupMode, sortMode });
}

function setSortMode(mode) {
  const normalized = normalizeGroupSortMode(mode) || getDefaultGroupSortMode(groupMode);
  sortMode = normalized;
  if ($sortBy) $sortBy.value = normalized;
}

function setTuneSortMode(mode) {
  const normalized = normalizeTuneSortMode(mode) || getDefaultTuneSortMode(groupMode);
  tuneSortMode = normalized;
  if ($sortTunesBy) $sortTunesBy.value = normalized;
}

function getVisibleLibraryFiles() {
  if (libraryFilter) return libraryFilter;
  return libraryIndex ? (libraryIndex.files || []) : [];
}

function setLibraryFilter(filteredFiles, label) {
  libraryFilter = filteredFiles;
  libraryFilterLabel = label || "";
  scheduleRenderLibraryTree();
  updateLibraryStatus();
}

function clearLibraryFilter() {
  libraryFilter = null;
  libraryFilterLabel = "";
  scheduleRenderLibraryTree();
  updateLibraryStatus();
}

function getActiveFileEntry() {
  if (chordProFeature.isEnabled()) return null;
  if (!libraryIndex || !libraryIndex.files || !activeFilePath) return null;
  return libraryIndex.files.find((file) => pathsEqual(file.path, activeFilePath)) || null;
}

function updateFileHeaderPanel() {
  if (!$fileHeaderPanel || !$fileHeaderEditor) return;
  // Ensure the CodeMirror instance exists before we attempt to sync text into it.
  // Otherwise, `setHeaderEditorValue()` is a no-op and we can end up with a blank header until Reload.
  initHeaderEditor();
  if (chordProFeature.isEnabled()) {
    $fileHeaderPanel.classList.add("active");
    suppressHeaderDirty = true;
    setHeaderEditorValue("");
    suppressHeaderDirty = false;
    headerDirty = false;
    headerEditorFilePath = null;
    updateHeaderStateUI();
    if ($fileHeaderToggle) {
      $fileHeaderToggle.title = "ChordPro file (no ABC file header).";
    }
    return;
  }
  const entry = getActiveFileEntry();
  if (!entry) {
    $fileHeaderPanel.classList.remove("active");
    suppressHeaderDirty = true;
    setHeaderEditorValue("");
    suppressHeaderDirty = false;
    headerDirty = false;
    headerEditorFilePath = null;
    updateHeaderStateUI();
    return;
  }
  $fileHeaderPanel.classList.add("active");
  const nextHeaderText = entry.headerText || "";
  const currentHeaderText = getHeaderEditorValue();
  // Header editor is authoritative for the active file: once loaded, do not auto-overwrite it
  // (avoid "snap-back" and invisible edits). Reload is always explicit via the Reload button.
  if (headerEditorFilePath !== entry.path) {
    suppressHeaderDirty = true;
    setHeaderEditorValue(nextHeaderText);
    suppressHeaderDirty = false;
    headerDirty = false;
    headerEditorFilePath = entry.path || null;
  } else if (!headerDirty && !String(currentHeaderText || "").trim() && String(nextHeaderText || "").trim()) {
    // Initial-load recovery: library scanning/parsing can populate `entry.headerText` after the panel first shows.
    // If the header editor is still empty and not dirty, hydrate it once (without requiring a manual Reload).
    suppressHeaderDirty = true;
    setHeaderEditorValue(nextHeaderText);
    suppressHeaderDirty = false;
    headerDirty = false;
  }
  updateHeaderStateUI({ announce: true });
}

function findHeaderEndOffset(content) {
  // Avoid `\s*` which can consume newlines and shift the boundary into blank lines.
  const match = String(content || "").match(/^[\t ]*X:/m);
  if (!match) return String(content || "").length;
  return Number.isFinite(match.index) ? match.index : 0;
}

function updateLibraryStatus() {
  if (libraryFilterLabel) {
    setScanStatus(`Filter: ${libraryFilterLabel}`);
    return;
  }
  if (tuneErrorFilter) {
    if (!tuneErrorScanInFlight) setScanStatus("Filter: Error tunes");
    return;
  }
  if (libraryTextFilter) {
    setScanStatus(`Search: ${libraryTextFilter}`);
    return;
  }
  if (libraryIndex) {
    const count = (libraryIndex.files || []).length;
    setScanStatus("Ready", `Ready (${count} files)`);
    return;
  }
  setScanStatus("Idle");
}

function highlightSvgPracticeBarAtEditorOffset(editorOffset) {
  if (!$out || !$renderPane) return false;
  if (!Number.isFinite(editorOffset)) return false;
  if (!editorView) return false;
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const editorText = editorView.state.doc.toString();
  const measure = findMeasureRangeAt(editorText, editorOffset);
  const barEls = measure ? Array.from($out.querySelectorAll(".bar-hl")) : [];
  if (measure && barEls.length) {
    const start = mapEditorOffsetToRenderIdx(measure.start);
    const end = mapEditorOffsetToRenderIdx(measure.end);
    const hits = barEls.filter((el) => {
      const s = Number(el.dataset && el.dataset.start);
      const e = Number(el.dataset && el.dataset.end);
      if (!Number.isFinite(s)) return false;
      const stop = Number.isFinite(e) ? e : s + 1;
      return s < end && stop > start;
    });
    if (hits.length) {
      clearSvgPracticeBarHighlight();
      lastSvgPracticeBarEls = hits;
      for (const el of lastSvgPracticeBarEls) {
        try { el.classList.add("svg-practice-bar"); } catch {}
      }
      return true;
    }
  }
  clearSvgPracticeBarHighlight();
  return false;
}

function setPracticeBarHighlight(range) {
  const next = range && Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from
    ? { from: range.from, to: range.to }
    : null;
  if (
    practiceBarHighlightRange
    && next
    && practiceBarHighlightRange.from === next.from
    && practiceBarHighlightRange.to === next.to
  ) return;
  if (!practiceBarHighlightRange && !next) return;
  practiceBarHighlightRange = next;
  practiceBarHighlightVersion += 1;
  if (!editorView) return;
  editorView.dispatch({
    selection: editorView.state.selection,
    scrollIntoView: false,
  });
}

function applyLibraryTextFilter(files, query) {
  return applyLibraryTextFilterCore(files, query, {
    normalizeTitleKey,
    titleKeyStrict: libraryTitleKeyStrict,
  });
}


function getEditorValue() {
  if (!editorView) return "";
  return editorView.state.doc.toString();
}

function openFindPanel(view) {
  openSearchPanel(view);
  applySearchPanelHints(view);
  return true;
}

function openReplacePanel(view) {
  openSearchPanel(view);
  applySearchPanelHints(view);
  setTimeout(() => {
    const panel = view.dom.querySelector(".cm-search");
    if (!panel) return;
    const replace = panel.querySelector("input[name='replace']");
    if (replace) {
      replace.focus();
      replace.select();
    }
  }, 0);
  return true;
}

function getSelectedLines(state) {
  const lines = [];
  const seen = new Set();
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from);
    const toLine = state.doc.lineAt(range.to);
    const last = (range.to === toLine.from && range.to > range.from)
      ? Math.max(fromLine.number, toLine.number - 1)
      : toLine.number;
    for (let lineNo = fromLine.number; lineNo <= last; lineNo += 1) {
      const line = state.doc.line(lineNo);
      if (seen.has(line.from)) continue;
      seen.add(line.from);
      lines.push(line);
    }
  }
  return lines;
}

function indentSelectionMore(view) {
  if (view.state.readOnly) return false;
  const unit = view.state.facet(indentUnit);
  const changes = getSelectedLines(view.state).map((line) => ({
    from: line.from,
    insert: unit,
  }));
  if (!changes.length) return false;
  view.dispatch({ changes, userEvent: "input.indent" });
  return true;
}

function indentSelectionLess(view) {
  if (view.state.readOnly) return false;
  const unit = view.state.facet(indentUnit);
  const unitSize = unit.length;
  const changes = [];
  for (const line of getSelectedLines(view.state)) {
    const match = /^[\t ]+/.exec(line.text);
    if (!match) continue;
    const prefix = match[0];
    let remove = 0;
    if (prefix.startsWith("\t")) remove = 1;
    else remove = Math.min(prefix.length, unitSize);
    if (remove > 0) {
      changes.push({ from: line.from, to: line.from + remove, insert: "" });
    }
  }
  if (!changes.length) return false;
  view.dispatch({ changes, userEvent: "delete.dedent" });
  return true;
}

function setSearchQueryPattern(pattern, useRegex = true) {
  if (!editorView) return;
  openSearchPanel(editorView);
  setTimeout(() => {
    const panel = editorView.dom.querySelector(".cm-search");
    if (!panel) return;
    const searchInput = panel.querySelector("input[name='search']");
    const regexInput = panel.querySelector("input[name='re']");
    if (!searchInput || !regexInput) return;
    searchInput.value = pattern;
    regexInput.checked = useRegex;
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    if (useRegex) {
      regexInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    searchInput.focus();
    searchInput.select();
  }, 0);
}

function foldBeginTextBlocks(state, lineStart, lineEnd) {
  const line = state.doc.lineAt(lineStart);
  if (!/^%%\s*begintext\b/i.test(line.text)) return null;
  for (let i = line.number + 1; i <= state.doc.lines; i += 1) {
    const next = state.doc.line(i);
    if (/^%%\s*endtext\b/i.test(next.text)) {
      return { from: line.to, to: next.from };
    }
  }
  return null;
}

function isInBeginTextBlockAtLine(state, lineNumber) {
  const n = Math.max(1, Math.min(state.doc.lines, Number(lineNumber) || 1));
  for (let i = n; i >= 1; i -= 1) {
    const text = String(state.doc.line(i).text || "");
    if (/^%%\s*endtext\b/i.test(text)) return false;
    if (/^%%\s*begintext\b/i.test(text)) return true;
  }
  return false;
}

function moveLineSelection(view, delta) {
  const { state } = view;
  const ranges = [];
  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.head);
    const targetLineNumber = Math.max(1, Math.min(state.doc.lines, line.number + delta));
    const targetLine = state.doc.line(targetLineNumber);
    const col = range.head - line.from;
    const pos = Math.min(targetLine.to, targetLine.from + col);
    ranges.push(EditorSelection.cursor(pos));
  }
  view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
  return true;
}

function resetLayout() {
  if (settingsController) settingsController.zoomReset();
  resetRightPaneSplit();
}

let startupLayoutResetDone = false;
let startupLayoutResetScheduled = false;

function scheduleStartupLayoutReset() {
  if (startupLayoutResetDone || startupLayoutResetScheduled) return;
  startupLayoutResetScheduled = true;
  requestAnimationFrame(() => {
    startupLayoutResetScheduled = false;
    if (startupLayoutResetDone) return;
    startupLayoutResetDone = true;
    try {
      // On startup, respect persisted zoom and split preferences.
      applyRightSplitSizesFromRatio();
    } catch {}
    requestAnimationFrame(() => {
      try { centerRenderPaneOnCurrentAnchor(); } catch {}
    });
  });
}

function refreshErrorsNow() {
  if (rawMode) {
    showToast("Raw mode: switch to tune mode for errors.", 2200);
    return;
  }
  if (!errorsEnabled) {
    showToast("Errors disabled");
    return;
  }
  if (t) {
    clearTimeout(t);
    t = null;
  }
  scheduleRenderNow();
  if (tuneErrorFilter && !tuneErrorScanInFlight) {
    const entry = getActiveFileEntry();
    if (entry) {
      tuneErrorScanToken += 1;
      tuneErrorScanInFlight = true;
      setScanErrorButtonActive(true);
      scanActiveFileForTuneErrors(entry, { filterToErrorTunes: tuneErrorFilter }).catch(() => {});
      updateLibraryStatus();
    }
  }
}

async function loadLastRecentEntry() {
  if (!window.api) return false;
  reportStartupStatus("Checking recent files…");
  let candidates = [];
  if (typeof window.api.getRecentCandidates === "function") {
    const list = await window.api.getRecentCandidates();
    if (Array.isArray(list)) candidates = list;
  }
  if (!candidates.length && typeof window.api.getLastRecent === "function") {
    const res = await window.api.getLastRecent();
    if (res && res.entry) candidates = [res];
  }
  for (const res of candidates) {
    if (!res || !res.entry) continue;
    if (res.type === "tune") {
      reportStartupStatus("Opening recent tune…");
      const opened = await openRecentTune(res.entry);
      if (opened && opened.ok) {
        startupRecentOpenStarted = true;
        return true;
      }
      continue;
    }
    if (res.type === "file") {
      reportStartupStatus("Opening recent file…");
      const opened = await openRecentFile(res.entry);
      if (opened && opened.ok) {
        startupRecentOpenStarted = true;
        return true;
      }
      continue;
    }
    if (res.type === "folder") {
      reportStartupStatus("Opening recent folder…");
      const opened = await openRecentFolder(res.entry);
      if (opened && opened.ok) {
        startupRecentOpenStarted = true;
        return true;
      }
    }
  }
  return false;
}

function setEditorValue(text) {
  if (!editorView) return;
  if (text != null && typeof text !== "string") {
    console.error("[abcarus] setEditorValue received non-string; dropped:", Object.prototype.toString.call(text));
    return;
  }
  const doc = editorView.state.doc;
  editorView.dispatch({
    changes: { from: 0, to: doc.length, insert: text || "" },
  });
}

function setRawModeUI(enabled) {
  rawMode = Boolean(enabled);
  if (rawMode && focusModeEnabled) setFocusModeEnabled(false);
  if (rawMode) setBarMismatchMarkers([]);
  document.body.classList.toggle("raw-mode", rawMode);
  if ($btnToggleRaw) $btnToggleRaw.classList.toggle("toggle-active", rawMode);
  applyRightSplitSizesFromRatio();
  const disablePlayback = rawMode;
  if ($btnPlayPause) $btnPlayPause.disabled = disablePlayback;
  if ($btnStop) $btnStop.disabled = disablePlayback;
  if ($btnToggleFollow) $btnToggleFollow.disabled = disablePlayback;
  if ($btnToggleErrors) $btnToggleErrors.disabled = rawMode;
  if ($scanErrorTunes) $scanErrorTunes.disabled = rawMode;
  if ($errorsIndicator) $errorsIndicator.disabled = rawMode;
  sourceLinkFeature.update();
}

function getPayloadModeCopyText() {
  if (!editorView) return { text: "", selectionText: "" };
  const doc = editorView.state.doc;
  const ranges = editorView.state.selection && editorView.state.selection.ranges
    ? editorView.state.selection.ranges
    : [];
  let selectionText = "";
  for (const r of ranges) {
    if (r && Number.isFinite(r.from) && Number.isFinite(r.to) && r.from !== r.to) {
      selectionText = doc.sliceString(r.from, r.to);
      break;
    }
  }
  return { text: selectionText || getEditorValue(), selectionText };
}

function setPayloadModeEditorValue(text) {
  suppressDirty = true;
  setEditorValue(text);
  suppressDirty = false;
}

function setPayloadModeEditorCursor(pos, { scrollIntoView = true } = {}) {
  if (!editorView) return;
  try {
    const safePos = Math.max(0, Math.min(Number(pos) || 0, editorView.state.doc.length));
    editorView.dispatch({
      selection: { anchor: safePos, head: safePos },
      scrollIntoView,
    });
  } catch {}
}

function restorePayloadModeEditorSelection(selection) {
  if (!editorView || !selection) return;
  try {
    editorView.dispatch({ selection, scrollIntoView: false });
  } catch {}
}

function setPayloadEditorReadOnly(enabled) {
  if (!editorView) return;
  try {
    const readonly = Boolean(enabled);
    editorView.dispatch({
      effects: abcPayloadReadOnlyCompartment.reconfigure(
        readonly
          ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
          : []
      ),
      scrollIntoView: false,
    });
  } catch {}
}

function buildRawFileText({ headerText, bodyText }) {
  let header = String(headerText || "");
  const body = String(bodyText || "");
  if (header && !/[\r\n]$/.test(header) && /^\s*X:/.test(body)) {
    header += "\n";
  }
  return header ? header + body : body;
}

async function performRawSaveFlow() {
  const filePath = rawModeFilePath || (currentDoc && currentDoc.path) || activeFilePath;
  if (!filePath) {
    await showSaveError("No file path available for raw save.");
    return false;
  }
  const preferred = (activeTuneMeta && pathsEqual(activeTuneMeta.path, filePath))
    ? { xNumber: activeTuneMeta.xNumber || "", indexInFile: activeTuneMeta.indexInFile || 0 }
    : { xNumber: "", indexInFile: 0 };
  const headerText = getHeaderEditorValue();
  const bodyText = getEditorValue();
  const fullText = buildRawFileText({ headerText, bodyText });
  return withFileLock(filePath, async () => {
    if (
      !window.api
      || typeof window.api.openWorkingCopy !== "function"
      || typeof window.api.applyWorkingCopyFullText !== "function"
      || typeof window.api.commitWorkingCopyToDisk !== "function"
    ) {
      await showSaveError("Internal error: working copy raw save is unavailable.");
      return false;
    }

    await window.api.openWorkingCopy(filePath);
    const applyRes = await window.api.applyWorkingCopyFullText(fullText);
    if (!applyRes || !applyRes.ok) {
      await showSaveError((applyRes && applyRes.error) ? applyRes.error : "Unable to update working copy for raw save.");
      return false;
    }

    const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
    if (saveRes && saveRes.missingOnDisk) {
      const handled = await handleMissingWorkingCopySave(filePath);
      if (handled && handled.ok) {
        const nextPath = handled.path || filePath;
        headerDirty = false;
        updateHeaderStateUI();
        if (currentDoc) {
          currentDoc.path = nextPath;
          currentDoc.content = bodyText;
          currentDoc.dirty = false;
        }
        setDirtyIndicator(false);
        setStatus("File saved.");
        return true;
      }
      return false;
    }
    if (!saveRes || !saveRes.ok) {
      if (saveRes && saveRes.conflict) {
        const resolved = await resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId: null });
        if (resolved && resolved.ok && resolved.action === "overwrite") {
          // continue below (post-save snapshot/refresh)
        } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
          setStatus("Saved copy.");
          return true;
        } else {
          if (resolved && resolved.action === "discard_reload") {
            setStatus("Reloaded from disk.");
          } else if (resolved && resolved.error) {
            await showSaveError(resolved.error);
          } else {
            setStatus("Save canceled.");
          }
          return false;
        }
      }
      await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
      return false;
    }

    markDiskConflictPath(filePath, false);
    const snapshot = await refreshWorkingCopySnapshot();
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
      setFileContentInCache(filePath, snapshot.text);
      attachTuneUidsToLibraryFile(filePath, snapshot);
    } else {
      setFileContentInCache(filePath, fullText);
    }
    headerDirty = false;
    updateHeaderStateUI();
    if (currentDoc) {
      currentDoc.path = filePath;
      currentDoc.content = bodyText;
      currentDoc.dirty = false;
    }
    setDirtyIndicator(false);
    const updatedFile = await refreshLibraryFile(filePath, { force: true });
    if (updatedFile && Number.isFinite(updatedFile.headerEndOffset)) {
      rawModeHeaderEndOffset = Number(updatedFile.headerEndOffset) || 0;
    }
    if (rawMode) {
      const entry = updatedFile || (libraryIndex && libraryIndex.files
        ? libraryIndex.files.find((f) => pathsEqual(f.path, filePath))
        : null);
      const tunes = entry && entry.tunes ? entry.tunes : [];
      if (tunes.length) {
        let next = null;
        if (!next && Number.isFinite(Number(preferred.indexInFile)) && Number(preferred.indexInFile) > 0) {
          next = tunes[Math.min(tunes.length - 1, Math.max(0, Number(preferred.indexInFile) - 1))];
        }
        if (!next && preferred.xNumber) {
          next = tunes.find((t) => String(t.xNumber || "") === String(preferred.xNumber));
        }
        if (!next) next = tunes[0];
        if (next && next.id) {
          if ($fileTuneSelect) $fileTuneSelect.value = next.id;
          setActiveTuneInRaw(next.id);
        }
      }
    }
    setStatus("File saved.");
    return true;
  });
}

function scrollToPosInEditor(pos, { y = "start" } = {}) {
  if (!editorView) return;
  const docLen = editorView.state.doc.length;
  const safePos = Math.max(0, Math.min(Number(pos) || 0, docLen));
  const effects = [];
  if (typeof EditorView.scrollIntoView === "function") {
    try {
      effects.push(EditorView.scrollIntoView(safePos, { y }));
    } catch {}
  }
  editorView.dispatch({
    selection: EditorSelection.cursor(safePos),
    effects,
    scrollIntoView: true,
  });
}

function setActiveTuneInRaw(tuneId) {
  if (!tuneId) return;
  const res = findTuneById(tuneId);
  if (!res) return;
  activeTuneId = tuneId;
  activeTuneUid = null;
  activeTuneIndex = null;
  activeTuneMeta = {
    id: res.tune.id,
    path: res.file.path,
    basename: res.file.basename,
    indexInFile: res.tune.indexInFile,
    xNumber: res.tune.xNumber,
    title: res.tune.title || "",
    composer: res.tune.composer || "",
    key: res.tune.key || "",
    startLine: res.tune.startLine,
    endLine: res.tune.endLine,
    startOffset: res.tune.startOffset,
    endOffset: res.tune.endOffset,
  };
  markActiveTuneButton(activeTuneId);
  setTuneMetaText(buildTuneMetaLabel(activeTuneMeta));
}

function scrollToTuneInRaw(tuneId) {
  const res = findTuneById(tuneId);
  if (!res) return;
  const bodyStart = Number(rawModeHeaderEndOffset) || 0;
  const pos = Math.max(0, Number(res.tune.startOffset) - bodyStart);
  scrollToPosInEditor(pos, { y: "start" });
}

async function enterRawMode() {
  const filePath = (activeTuneMeta && activeTuneMeta.path)
    ? activeTuneMeta.path
    : (activeFilePath || (currentDoc && currentDoc.path) || null);
  if (!filePath) {
    showToast("No active file to open in raw mode.", 2200);
    return;
  }
  const ok = await ensureSafeToAbandonCurrentDoc("switching to raw mode");
  if (!ok) return;

  try { stopPlaybackTransport(); } catch {}
  try { await flushWorkingCopyTuneSync(); } catch {}
  try { await flushWorkingCopyFullSync(); } catch {}

  // Raw mode must reflect what is saved on disk (source of truth after Save).
  const readRes = await readFile(filePath);
  if (!readRes || !readRes.ok) {
    await showOpenError((readRes && readRes.error) ? readRes.error : "Unable to read file.");
    return;
  }
  const fullText = String(readRes.data || "");

  // Keep working copy aligned with disk so subsequent operations don't reopen stale content.
  try {
    await ensureWorkingCopyOpenForPath(filePath);
    if (window.api && typeof window.api.reloadWorkingCopyFromDisk === "function") {
      await window.api.reloadWorkingCopyFromDisk();
    }
    await refreshWorkingCopySnapshot();
  } catch {}

  activeFilePath = filePath;
  setSaveSession({
    intent: SAVE_INTENT.FULL_FILE,
    targetPath: String(filePath || ""),
    targetTuneUid: "",
    source: "raw_mode",
  });
  setFileContentInCache(filePath, fullText);
  const updatedFile = await refreshLibraryFile(filePath, { force: true });
  const entry = updatedFile || getActiveFileEntry();
  const headerEndOffset = entry && Number.isFinite(entry.headerEndOffset) ? Number(entry.headerEndOffset) : findHeaderEndOffset(fullText);
  const bodyText = String(fullText || "").slice(headerEndOffset);

  rawModeFilePath = filePath;
  rawModeHeaderEndOffset = headerEndOffset;
  rawModeOriginalTuneId = activeTuneId;

  suppressDirty = true;
  setEditorValue(bodyText);
  suppressDirty = false;
  if (currentDoc) {
    currentDoc.path = filePath;
    currentDoc.content = bodyText;
    currentDoc.dirty = false;
  }
  setRawModeUI(true);
  updateFileHeaderPanel();
  setDirtyIndicator(false);
  if (rawModeOriginalTuneId) {
    setActiveTuneInRaw(rawModeOriginalTuneId);
    scrollToTuneInRaw(rawModeOriginalTuneId);
  }
  setStatus("Raw mode.");
}

async function exitRawMode() {
  if (!rawMode) return;
  const fileDirty = Boolean(currentDoc && currentDoc.dirty);
  const hdrDirty = Boolean(headerDirty);
  if (fileDirty || hdrDirty) {
    const choice = await confirmUnsavedChanges("leaving raw mode");
    if (choice === "cancel") return;
    if (choice === "save") {
      const saved = await performRawSaveFlow();
      if (!saved) return;
    } else if (choice === "dont_save") {
      headerEditorFilePath = null;
      headerDirty = false;
      if (currentDoc) currentDoc.dirty = false;
      updateFileHeaderPanel();
      setDirtyIndicator(false);
    }
  }
  setRawModeUI(false);
  const tuneToRestore = activeTuneId || rawModeOriginalTuneId;
  rawModeFilePath = null;
  rawModeHeaderEndOffset = 0;
  rawModeOriginalTuneId = null;
  if (tuneToRestore) {
    const res = await selectTune(tuneToRestore, { skipConfirm: true });
    if (!res || !res.ok) {
      const entry = getActiveFileEntry();
      const firstId = entry && entry.tunes && entry.tunes[0] ? entry.tunes[0].id : null;
      if (firstId) await selectTune(firstId, { skipConfirm: true });
    }
  } else {
    const entry = getActiveFileEntry();
    const firstId = entry && entry.tunes && entry.tunes[0] ? entry.tunes[0].id : null;
    if (firstId) await selectTune(firstId, { skipConfirm: true });
  }
  setStatus("Ready");
}

async function leaveRawModeForAction(contextLabel) {
  if (!rawMode) return true;
  const fileDirty = Boolean(currentDoc && currentDoc.dirty);
  const hdrDirty = Boolean(headerDirty);
  if (fileDirty || hdrDirty) {
    const choice = await confirmUnsavedChanges(contextLabel || "continuing");
    if (choice === "cancel") return false;
    if (choice === "save") {
      const saved = await performRawSaveFlow();
      if (!saved) return false;
    } else if (choice === "dont_save") {
      headerEditorFilePath = null;
      headerDirty = false;
      if (currentDoc) currentDoc.dirty = false;
      updateFileHeaderPanel();
      setDirtyIndicator(false);
    }
  }
  setRawModeUI(false);
  rawModeFilePath = null;
  rawModeHeaderEndOffset = 0;
  rawModeOriginalTuneId = null;
  return true;
}

function buildPayloadModePlaybackPayload(renderText, renderOffset) {
  return buildPlaybackPayloadForDiagnosticsFromRenderTextCore(renderText, renderOffset, {
    injectGchordOn,
    shouldUseNativeMidiDrums,
    injectDrumPlayback,
    normalizeDollarLineBreaksForPlayback,
    normalizeBlankLinesForPlayback,
    sanitizeAbcForPlayback,
    expandRepeatsForPlayback,
    expandRepeats: window.__abcarusPlaybackExpandRepeats === true,
  });
}

function toggleLineComments(view) {
  if (!view) return false;
  if (isPlaying || isPaused || waitingForFirstNote) {
    showToast("Playback active: stop before editing.", 2400);
    return true;
  }

  const doc = view.state.doc;
  const ranges = view.state.selection.ranges || [];
  if (!ranges.length) return false;

  const lineNumbers = new Set();
  for (const r of ranges) {
    const from = Math.min(r.from, r.to);
    const to = Math.max(r.from, r.to);
    const fromLine = doc.lineAt(from);
    const toLine = doc.lineAt(to);
    for (let n = fromLine.number; n <= toLine.number; n += 1) {
      lineNumbers.add(n);
    }
  }
  const lines = Array.from(lineNumbers).sort((a, b) => a - b);
  if (!lines.length) return false;

  const lineInfo = lines.map((n) => doc.line(n));
  const isCommented = (lineText) => {
    const m = /^[\t ]*/.exec(lineText);
    const i = m ? m[0].length : 0;
    return lineText[i] === "%";
  };
  const allCommented = lineInfo.every((ln) => isCommented(ln.text));

  const changes = [];
  for (let idx = lineInfo.length - 1; idx >= 0; idx -= 1) {
    const ln = lineInfo[idx];
    const text = ln.text;
    const m = /^[\t ]*/.exec(text);
    const indentLen = m ? m[0].length : 0;
    const at = ln.from + indentLen;
    if (allCommented) {
      if (text[indentLen] === "%") {
        const next = text[indentLen + 1];
        const removeLen = next === " " ? 2 : 1;
        changes.push({ from: at, to: at + removeLen, insert: "" });
      }
    } else {
      changes.push({ from: at, to: at, insert: "% " });
    }
  }

  if (!changes.length) return true;
  view.dispatch({ changes });
  return true;
}

function getFocusedEditorView() {
  const activeEl = document.activeElement;
  if (headerEditorView && headerEditorView.dom && activeEl && headerEditorView.dom.contains(activeEl)) return headerEditorView;
  if (editorView && editorView.dom && activeEl && editorView.dom.contains(activeEl)) return editorView;
  return editorView || headerEditorView || null;
}

// --- MIDI input / typing preview ---

function getActiveEditorViewForMidi() {
  const activeEl = document.activeElement;
  if (headerEditorView && headerEditorView.dom && activeEl && headerEditorView.dom.contains(activeEl)) return headerEditorView;
  if (editorView && editorView.dom && activeEl && editorView.dom.contains(activeEl)) return editorView;
  return null;
}

function insertEditorTextAtCursor(text, userEvent = "input") {
  const view = getActiveEditorViewForMidi();
  if (!view || !text) return false;
  const sel = view.state.selection.main;
  const from = sel.from;
  const to = sel.to;
  const insert = String(text);
  const cursorPos = from + insert.length;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(cursorPos),
    userEvent,
  });
  return true;
}

function deleteEditorCharBeforeCursorForMidi() {
  const view = getActiveEditorViewForMidi();
  if (!view) return false;
  const sel = view.state.selection.main;
  if (!sel.empty) {
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: "" },
      selection: EditorSelection.cursor(sel.from),
      userEvent: "delete",
    });
    return true;
  }
  if (sel.from <= 0) return false;
  const from = sel.from - 1;
  view.dispatch({
    changes: { from, to: sel.from, insert: "" },
    selection: EditorSelection.cursor(from),
    userEvent: "delete",
  });
  return true;
}

const midiInputFeature = createMidiInputFeature({
  documentRef: document,
  api: window.api,
  setButtonText,
  showToast,
  getActiveEditorView: getActiveEditorViewForMidi,
  insertTextAtCursor: insertEditorTextAtCursor,
  deleteCharBeforeCursor: deleteEditorCharBeforeCursorForMidi,
  getDefaultLen,
  gcdInt,
  isTypingPreviewBlocked: () => Boolean(rawMode || isPayloadMode() || chordProFeature.isEnabled()),
  isMainEditorUpdate: (update) => Boolean(editorView && update && update.view === editorView),
  refreshCursorStatus,
  hasCursorStatus: () => Boolean(lastCursorStatus),
});
midiInputFeature.exposeDebugApi();

function initEditor() {
  if (editorView || !$editorHost) return;
  const completionTooltipOpen = (view) => {
    if (!view || !view.hasFocus) return false;
    const el = document.querySelector(".cm-tooltip-autocomplete");
    return Boolean(el);
  };
  const customKeys = keymap.of([
    { key: "Ctrl-s", run: () => { fileSave(); return true; } },
    { key: "Mod-s", run: () => { fileSave(); return true; } },
    { key: "Ctrl-f", run: openFindPanel },
    { key: "Mod-f", run: openFindPanel },
    { key: "Ctrl-h", run: openReplacePanel },
    { key: "Mod-h", run: openReplacePanel },
    { key: "Ctrl-Alt-i", run: () => { midiInputFeature.toggleInputSetting(); return true; } },
    { key: "Mod-Alt-i", run: () => { midiInputFeature.toggleInputSetting(); return true; } },
    { key: "Ctrl-Alt-m", run: () => { midiInputFeature.toggleMuteSetting(); return true; } },
    { key: "Mod-Alt-m", run: () => { midiInputFeature.toggleMuteSetting(); return true; } },
    { key: "Ctrl-Alt-g", run: gotoLine },
    { key: "Mod-Alt-g", run: gotoLine },
    { key: "Ctrl-g", run: () => { goToMeasureFromMenu().catch(() => {}); return true; } },
    { key: "Mod-g", run: () => { goToMeasureFromMenu().catch(() => {}); return true; } },
    { key: "Ctrl-F7", run: (view) => moveLineSelection(view, 1) },
    { key: "Mod-F7", run: (view) => moveLineSelection(view, 1) },
		    { key: "Ctrl-F5", run: (view) => moveLineSelection(view, -1) },
		    { key: "Mod-F5", run: (view) => moveLineSelection(view, -1) },
		    {
		      key: "Ctrl-F2",
		      run: (view) => {
		        try {
		          const pos = view.state.selection.main.head;
		          const lineInfo = view.state.doc.lineAt(pos);
		          const lineText = String(lineInfo.text || "");
		          if (isInBeginTextBlockAtLine(view.state, lineInfo.number)) {
		            try { showToast("Decoration picker: not available in %%begintext blocks.", 2200); } catch {}
		            return true;
		          }
		          if (openKeySignaturePickerAtCursor({
		            view,
		            pos,
		            lineInfo,
		            lineText,
		            EditorSelection,
		            enableDraggableFixedPopover,
		          })) return true;
		          if (openMidiProgramPickerAtCursor({
		            view,
		            pos,
		            lineInfo,
		            lineText,
		            programNames: GM_PROGRAM_NAMES,
		            EditorSelection,
		            enableDraggableFixedPopover,
		            showToast,
		          })) return true;
		          if (openDrumHelperAtCursor({
		            view,
		            pos,
		            lineInfo,
		            lineText,
		            EditorSelection,
		            enableDraggableFixedPopover,
		            showToast,
		            drumVelocityMap,
		          })) return true;
		          if (openGchordHelperAtCursor({
		            view,
		            pos,
		            lineInfo,
		            lineText,
		            EditorSelection,
		            enableDraggableFixedPopover,
		            showToast,
		            isInlineFieldOnlyLine,
		          })) return true;
		          if (openDecorationPickerAtCursor({
		            view,
		            pos,
		            lineText,
		            catalog: ABC2SVG_DECORATIONS,
		            EditorSelection,
		            enableDraggableFixedPopover,
		            renderAbcToSvgMarkup,
		            loadDecorationCatalogEnrichment,
		            showToast,
		          })) return true;
		        } catch {}
		        return true;
		      },
		    },
		    {
		      key: "Enter",
		      run: (view) => (completionTooltipOpen(view) ? acceptCompletion(view) : false),
		    },
		    {
		      key: "Tab",
		      run: (view) => (completionTooltipOpen(view) ? acceptCompletion(view) : indentSelectionMore(view)),
		    },
		    {
		      key: "Shift-Tab",
		      run: (view) => (completionTooltipOpen(view) ? false : indentSelectionLess(view)),
		    },
		    { key: "Mod-/", run: toggleLineComments },
		    { key: "F5", run: () => { if (rawMode) { showToast("Raw mode: switch to tune mode to play.", 2200); return true; } togglePlayPauseEffective().catch(() => {}); return true; } },
		    { key: "F6", run: () => { if (rawMode) { showToast("Raw mode: switch to tune mode to navigate errors.", 2200); return true; } activateErrorByNav(-1); return true; } },
		    { key: "F7", run: () => { if (rawMode) { showToast("Raw mode: switch to tune mode to navigate errors.", 2200); return true; } activateErrorByNav(1); return true; } },
		    { key: "F4", run: () => { if (rawMode) { showToast("Raw mode: switch to tune mode to play.", 2200); return true; } startPlaybackAtIndex(0); return true; } },
		    { key: "F8", run: () => { resetLayout(); return true; } },
	    { key: "F9", run: () => { refreshErrorsNow(); return true; } },
	  ]);
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      if (!suppressDirty && !isPayloadMode() && !currentDoc) {
        currentDoc = createBlankDocument();
      }
      midiInputFeature.handleTypingPreviewChange(update);
      abLoopRuntime.incrementRevision();
      if (abLoopRuntime.hasPlan()) clearAbPlan({ toast: true });
      if (!suppressDirty && currentDoc && !isPayloadMode()) {
        currentDoc.content = update.state.doc.toString();
        currentDoc.dirty = true;
        setDirtyIndicator(true);
      }
      if (!suppressDirty && currentDoc && !isPayloadMode()) {
        if (chordProFeature.isEnabled()) {
          chordProFeature.handleEditorDocChanged(update.state.doc.toString());
          scheduleWorkingCopyFullSync();
        } else if (activeTuneUid) scheduleWorkingCopyTuneSync();
      }
      if (!rawMode && !chordProFeature.isFullView()) {
        if (t) clearTimeout(t);
        t = setTimeout(() => scheduleRenderNow(), 400);
        sourceLinkFeature.scheduleUpdate();
      }
    }
	    if (!rawMode && update.selectionSet && !isPlaying) {
	      const idx = update.state.selection.main.anchor;
        chordProFeature.handleSelectionOffset(idx);
	      if (followPlayback) {
	        scheduleCursorNoteHighlight(idx);
	      } else {
        clearNoteSelection();
      }
      if (!suppressPlaybackRangeSelectionSync) {
        const origin = pendingPlaybackRangeOrigin || "cursor";
        pendingPlaybackRangeOrigin = null;
        updatePlaybackRangeFromSelection(update.state.selection, origin);
      } else {
        pendingPlaybackRangeOrigin = null;
      }
	      if (transportJumpHighlightActive) {
	        if (suppressTransportJumpClearOnce) {
	          suppressTransportJumpClearOnce = false;
	        } else {
	          transportJumpHighlightActive = false;
	          setPracticeBarHighlight(null);
	          clearSvgPracticeBarHighlight();
	        }
	      }
	    }
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head;
      const lineInfo = update.state.doc.lineAt(pos);
      setCursorStatus(
        lineInfo.number,
        pos - lineInfo.from + 1,
        pos + 1,
        update.state.doc.lines,
        update.state.doc.length
      );
    }
  });
  const state = EditorState.create({
    doc: DEFAULT_ABC,
    extensions: [
      basicSetup,
      createRectSelectionExtension(),
      abcHighlightCompartment.of([abcHighlight]),
      abcDiagnosticsCompartment.of([
        measureErrorPlugin,
        barMismatchPlugin,
        errorActivationHighlightPlugin,
        practiceBarHighlightPlugin,
        intonationHighlightPlugin,
        abPlugin,
        payloadLayerPlugin,
      ]),
      abcCompletionCompartment.of([
        autocompletion({ override: [buildAbcCompletionSource()], activateOnTyping: false }),
      ]),
      abcHoverCompartment.of([]),
      abcTuningModeCompartment.of([]),
      abcPayloadReadOnlyCompartment.of([]),
      updateListener,
      customKeys,
      foldService.of(foldBeginTextBlocks),
      EditorState.tabSize.of(2),
      indentUnit.of("  "),
    ],
  });
  editorView = new EditorView({
    state,
    parent: $editorHost,
  });
  updateAbUi();

  // Completion acceptance should be reliable even when other keymaps also bind Enter/Tab.
  // Use a capturing document handler so it works consistently and for whichever editor is focused.
  try {
    if (!window.__abcarusCompletionKeyHandlerInstalled) {
      window.__abcarusCompletionKeyHandlerInstalled = true;
      document.addEventListener("keydown", (e) => {
        try {
          if (!e || e.defaultPrevented) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.shiftKey) return;
          const key = String(e.key || "");
          if (key !== "Enter" && key !== "Tab") return;
          const tooltip = document.querySelector(".cm-tooltip-autocomplete");
          if (!tooltip) return;
          const view = getFocusedEditorView();
          if (!view) return;
          const accepted = acceptCompletion(view);
          if (!accepted) return;
          e.preventDefault();
          e.stopPropagation();
        } catch {}
      }, true);
    }
  } catch {}

  // Clear the active error highlight only on an explicit user click outside the highlight range.
  // This avoids accidental clearing from programmatic selection changes (follow playback, jump, etc.).
  editorView.dom.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (errorsHighlightState.isSuppressingClear()) return;
    const activeErrorHighlight = errorsHighlightState.getActive();
    if (!activeErrorHighlight) return;
    if (!Number.isFinite(activeErrorHighlight.from) || !Number.isFinite(activeErrorHighlight.to)) return;
    const pos = editorView.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos == null) return;
    const inside = pos >= activeErrorHighlight.from && pos <= activeErrorHighlight.to;
    if (!inside) clearActiveErrorHighlight("abandon");
  }, true);

  editorView.dom.addEventListener("copy", (e) => {
    try {
      if (!isPayloadMode() || !editorView) return;
      const selection = editorView.state.selection;
      if (!selection || selection.empty) return;
      const doc = editorView.state.doc;
      const parts = [];
      for (const range of selection.ranges || []) {
        if (!range || range.from === range.to) continue;
        parts.push(doc.sliceString(range.from, range.to));
      }
      if (!parts.length) return;
      const text = parts.join("\n");
      if (e.clipboardData && typeof e.clipboardData.setData === "function") {
        e.clipboardData.setData("text/plain", text);
        e.preventDefault();
      }
    } catch {}
  });

  editorView.dom.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    showContextMenuAt(ev.clientX, ev.clientY, { type: "editor" });
  });
  setCursorStatus(1, 1, 1, state.doc.lines, state.doc.length);
}

function initSearchPanelShortcuts() {
  const findButtonByLabel = (panel, label) => {
    if (!panel) return null;
    const buttons = Array.from(panel.querySelectorAll("button"));
    const want = String(label || "").trim().toLowerCase();
    return buttons.find((btn) => String(btn.textContent || "").trim().toLowerCase() === want) || null;
  };

  const triggerPanelAction = (panel, action) => {
    const btn = findButtonByLabel(panel, action);
    if (!btn) return false;
    btn.click();
    return true;
  };

  document.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    const panel = activeEl && activeEl.closest ? activeEl.closest(".cm-search") : null;
    if (!panel) return;

    const key = e.key;
    const isEnter = key === "Enter";
    const isF3 = key === "F3";
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // Enter / Shift+Enter: next/previous match (standard behavior in many editors).
    if (isEnter && !ctrl && !alt) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, shift ? "previous" : "next");
      return;
    }

    // F3 / Shift+F3: next/previous match (common desktop shortcut).
    if (isF3 && !ctrl && !alt) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, shift ? "previous" : "next");
      return;
    }

    // Ctrl+Enter: replace (when replace UI is present).
    if (isEnter && ctrl && !alt && !shift) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, "replace");
      return;
    }

    // Ctrl+Shift+Enter OR Alt+Enter: replace all (avoid Ctrl+A which is "select all" in inputs).
    if (isEnter && ((ctrl && shift) || alt)) {
      e.preventDefault();
      e.stopPropagation();
      triggerPanelAction(panel, "replace all");
    }
  }, true);
}

function applySearchPanelHints(view) {
  if (!view) return;
  setTimeout(() => {
    const panel = view.dom.querySelector(".cm-search");
    if (!panel) return;
    try {
      const next = panel.querySelector("button[name='next']");
      if (next) next.title = "Next (Enter / F3)";
      const prev = panel.querySelector("button[name='prev']");
      if (prev) prev.title = "Previous (Shift+Enter / Shift+F3)";
      const all = panel.querySelector("button[name='select']");
      if (all) all.title = "Select all matches";
      const replaceBtn = panel.querySelector("button[name='replace']");
      if (replaceBtn) replaceBtn.title = "Replace (Ctrl+Enter)";
      const replaceAllBtn = panel.querySelector("button[name='replaceAll']");
      if (replaceAllBtn) replaceAllBtn.title = "Replace all (Ctrl+Shift+Enter / Alt+Enter)";
    } catch {}
    try {
      wireSearchPanelHotkeys(panel);
    } catch {}
  }, 0);
}

function wireSearchPanelHotkeys(panel) {
  if (!panel || !panel.dataset) return;
  if (panel.dataset.abcarusHotkeys === "1") return;
  panel.dataset.abcarusHotkeys = "1";

  const clickNamed = (name) => {
    const btn = panel.querySelector(`button[name='${name}']`);
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  };

  panel.addEventListener("keydown", (ev) => {
    if (!ev) return;
    const key = String(ev.key || "");

    if (key === "F3") {
      if (ev.shiftKey) {
        if (clickNamed("prev")) ev.preventDefault();
      } else if (clickNamed("next")) {
        ev.preventDefault();
      }
      return;
    }

    if (key !== "Enter") return;
    const hasCtrl = Boolean(ev.ctrlKey || ev.metaKey);

    // Search navigation.
    if (!hasCtrl && !ev.altKey) {
      if (ev.shiftKey) {
        if (clickNamed("prev")) ev.preventDefault();
      } else if (clickNamed("next")) {
        ev.preventDefault();
      }
      return;
    }

    // Replace actions.
    if (hasCtrl || ev.altKey) {
      if (ev.shiftKey || ev.altKey) {
        if (clickNamed("replaceAll")) ev.preventDefault();
      } else if (clickNamed("replace")) {
        ev.preventDefault();
      }
    }
  }, true);
}

function initHeaderEditor() {
  if (headerEditorView || !$fileHeaderEditor) return;
  let headerRenderTimer = null;
  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    if (suppressHeaderDirty) return;
    headerDirty = true;
    updateHeaderStateUI();
    if (headerRenderTimer) clearTimeout(headerRenderTimer);
    headerRenderTimer = setTimeout(() => {
      headerRenderTimer = null;
      scheduleRenderNow();
    }, 300);
  });
  const state = EditorState.create({
    doc: "",
    extensions: [
      basicSetup,
      createRectSelectionExtension(),
      abcHighlight,
      keymap.of([{ key: "Mod-/", run: toggleLineComments }]),
      updateListener,
      EditorState.tabSize.of(2),
      indentUnit.of("  "),
    ],
  });
  headerEditorView = new EditorView({
    state,
    parent: $fileHeaderEditor,
  });
}

function setActiveTuneText(text, metadata, options = {}) {
  if (chordProFeature.isEnabled()) chordProFeature.setMode(false);
  if (errorsHighlightState.hasActive()) clearActiveErrorHighlight("docReplaced");
  isNewTuneDraft = false;
  resetPlaybackState();
  resetTransposePreviewState();
  suppressDirty = true;
  setEditorValue(text);
  suppressDirty = false;
  if (metadata) {
    activeTuneMeta = { ...metadata };
    activeFilePath = metadata.path || null;
    scheduleSaveLibraryUiState();
    refreshHeaderLayers().catch(() => {});
    setTuneMetaText(buildTuneMetaLabel(metadata));
    setFileNameMeta(stripFileExtension(metadata.basename || ""));
    sourceLinkFeature.update();
    if (currentDoc) {
      currentDoc.path = metadata.path || null;
      currentDoc.content = text;
      currentDoc.dirty = false;
    } else {
      currentDoc = { path: metadata.path || null, dirty: false, content: text };
    }
    if (!options.suppressRecent && !suppressRecentEntries && window.api && typeof window.api.addRecentTune === "function") {
      window.api.addRecentTune({
        path: metadata.path,
        basename: metadata.basename,
        xNumber: metadata.xNumber,
        title: metadata.title || "",
        startLine: metadata.startLine,
        endLine: metadata.endLine,
        startOffset: metadata.startOffset,
        endOffset: metadata.endOffset,
      });
    }
    if (!options.suppressRecent && !suppressRecentEntries && window.api && typeof window.api.addRecentFile === "function") {
      window.api.addRecentFile({
        path: metadata.path,
        basename: metadata.basename,
      });
    }
    updateFileContext();
    setDirtyIndicator(false);
    setSaveSession({
      intent: SAVE_INTENT.REPLACE_TUNE,
      targetPath: String(metadata.path || ""),
      targetTuneUid: String(metadata.tuneUid || activeTuneUid || ""),
      source: "setActiveTuneText.metadata",
    });
  } else {
    const markDirty = Boolean(options && options.markDirty);
    activeTuneMeta = null;
    activeTuneId = null;
    activeTuneUid = null;
    activeTuneIndex = null;
    activeFilePath = null;
    isNewTuneDraft = false;
    refreshHeaderLayers().catch(() => {});
    setTuneMetaText(UNTITLED_UNSAVED_LABEL);
    setFileNameMeta(UNTITLED_UNSAVED_LABEL);
    sourceLinkFeature.update();
    if (currentDoc) {
      currentDoc.path = null;
      currentDoc.content = text || "";
      currentDoc.dirty = markDirty;
    } else {
      currentDoc = { path: null, dirty: markDirty, content: text || "" };
    }
    updateFileContext();
    setDirtyIndicator(markDirty);
    headerDirty = false;
    updateHeaderStateUI();
    clearSaveSession();
  }
  updateFileHeaderPanel();
  if (metadata && metadata.id) {
    maybeResetFocusLoopForTune(metadata.id);
  }
  scheduleRenderNow({ clearOutput: true });
}

function insertTextAtEditorSelection(text) {
  if (!editorView) return false;
  if (!text) return false;
  try {
    const sel = editorView.state.selection;
    editorView.dispatch({
      changes: { from: sel.main.from, to: sel.main.to, insert: text },
      selection: { anchor: sel.main.from + text.length },
      userEvent: "input",
    });
    return true;
  } catch {
    return false;
  }
}

function setLibraryVisible(visible, { persist = true } = {}) {
  if (chordProFeature.isEnabled() && visible) return;
  isLibraryVisible = visible;
  document.body.classList.toggle("library-hidden", !visible);
  renderBufferStatus();
  if (visible) {
    setPaneSizes(lastSidebarWidth || MIN_PANE_WIDTH);
  } else if ($main) {
    $main.style.gridTemplateColumns = `0px 0px 1fr`;
  }
  if (persist) {
    scheduleSaveLibraryPrefs({ libraryPaneVisible: Boolean(visible) });
  }
}

function toggleLibrary() {
  if (chordProFeature.isEnabled()) {
    showToast("Library is disabled while editing ChordPro.", 2400);
    return;
  }
  setLibraryVisible(!isLibraryVisible);
  // Toggling the library pane changes available width; reset the editor/render split so the UI looks tidy.
  requestAnimationFrame(() => {
    try { resetRightPaneSplit(); } catch {}
  });
}

function getGroupValue(tune, mode) {
  if (!tune) return "";
  if (mode === "x") return tune.xNumber || "";
  if (mode === "titlekey") return normalizeTitleKey(tune.title || tune.preview || "", 25);
  if (mode === "composer") return tune.composer || "";
  if (mode === "meter") return tune.meter || "";
  if (mode === "key") return tune.key || "";
  if (mode === "unit") return tune.unitLength || "";
  if (mode === "tempo") return tune.tempo || "";
  if (mode === "rhythm") return tune.rhythm || "";
  if (mode === "source") return tune.source || "";
  if (mode === "origin") return tune.origin || "";
  if (mode === "group") return tune.group || "";
  return "";
}

function buildGroupEntries(files, mode) {
  if (mode === "file") {
    return files.map((file) => ({
      id: file.path,
      label: file.basename,
      tunes: Array.isArray(file.tunes) ? file.tunes : [],
      tuneCount: Number.isFinite(file.tuneCount) ? file.tuneCount : undefined,
      xIssues: file && file.xIssues ? file.xIssues : undefined,
      isFile: true,
      updatedAtMs: file.updatedAtMs || 0,
    }));
  }

  const entries = new Map();
  for (const file of files) {
    const tunes = Array.isArray(file.tunes) ? file.tunes : [];
    for (const tune of tunes) {
      const value = getGroupValue(tune, mode) || "Unknown";
      const groupId = `${mode}:${value}`;
      if (!entries.has(groupId)) {
        entries.set(groupId, {
          id: groupId,
          label: `${GROUP_LABELS[mode]}: ${value}`,
          tunes: [],
          isFile: false,
          updatedAtMs: 0,
        });
      }
      entries.get(groupId).tunes.push({
        ...tune,
        __fileUpdatedAtMs: file.updatedAtMs || 0,
        filePath: file.path || "",
      });
      const updatedAtMs = file.updatedAtMs || 0;
      const entry = entries.get(groupId);
      if (updatedAtMs > (entry.updatedAtMs || 0)) entry.updatedAtMs = updatedAtMs;
    }
  }
  return Array.from(entries.values());
}

let libraryTreeRenderScheduled = false;
let pendingLibraryTreeRenderFiles = null;

function scheduleRenderLibraryTree(files = null) {
  pendingLibraryTreeRenderFiles = files;
  if (libraryTreeRenderScheduled) return;
  libraryTreeRenderScheduled = true;
  requestAnimationFrame(() => {
    libraryTreeRenderScheduled = false;
    const nextFiles = pendingLibraryTreeRenderFiles;
    pendingLibraryTreeRenderFiles = null;
    renderLibraryTree(nextFiles);
  });
}

const LIBRARY_TUNE_DRAG_MIME = "application/x-abcarus-tune-id";
let libraryDragTuneId = "";

function getLibraryDragTuneId(ev) {
  const dt = ev && ev.dataTransfer ? ev.dataTransfer : null;
  if (dt) {
    try {
      const customId = dt.getData(LIBRARY_TUNE_DRAG_MIME);
      if (customId) return customId;
    } catch {}
    try {
      const plainId = dt.getData("text/plain");
      if (plainId) return plainId;
    } catch {}
  }
  return libraryDragTuneId || "";
}

function isLibraryTuneDrag(ev) {
  if (libraryDragTuneId) return true;
  const types = ev && ev.dataTransfer ? ev.dataTransfer.types : null;
  if (!types) return false;
  try {
    return Array.from(types).includes(LIBRARY_TUNE_DRAG_MIME);
  } catch {
    return false;
  }
}

function renderLibraryTree(files = null) {
  if (!$libraryTree) return;
  $libraryTree.style.display = "";
  $libraryTree.textContent = "";
  const fragment = document.createDocumentFragment();
  const sourceFiles = files || getVisibleLibraryFiles();
  const filteredFiles = libraryTextFilter
    ? applyLibraryTextFilter(sourceFiles, libraryTextFilter)
    : sourceFiles;
  const hasRenameTarget = renamingFilePath
    && filteredFiles
      .some((file) => pathsEqual(file.path, renamingFilePath));
  if (renamingFilePath && !hasRenameTarget) renamingFilePath = null;
  const sortedFiles = sortLibraryFiles(filteredFiles);
  const entries = sortGroupEntries(buildGroupEntries(sortedFiles, groupMode));
  for (const entry of entries) {
    const fileNode = document.createElement("div");
    fileNode.className = "tree-file";
    if (entry.isFile && pathsEqual(activeFilePath, entry.id)) fileNode.classList.add("active");
    if (entry.isFile && entry.xIssues && entry.xIssues.ok === false) {
      fileNode.classList.add("x-issues");
      const parts = [];
      if (entry.xIssues.invalid) parts.push(`invalid X: ${entry.xIssues.invalid}`);
      if (entry.xIssues.missing) parts.push(`missing X: ${entry.xIssues.missing}`);
      if (entry.xIssues.duplicates) parts.push("duplicate X");
      if (parts.length) fileNode.title = `Index issue (${parts.join(", ")})`;
    }
    const isCollapsed = entry.isFile
      ? collapsedFiles.has(entry.id)
      : collapsedGroups.has(entry.id);
    if (isCollapsed) fileNode.classList.add("collapsed");

    if (entry.isFile && entry.id === renamingFilePath) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "tree-label tree-rename";
      input.disabled = isPayloadMode();
      input.value = entry.label || "";
      input.dataset.filePath = entry.id;
      input.addEventListener("keydown", async (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          await commitRenameFile(entry.id, input.value);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          renamingFilePath = null;
          renderLibraryTree(sourceFiles);
        }
      });
      input.addEventListener("blur", async () => {
        await commitRenameFile(entry.id, input.value);
      });
      fileNode.appendChild(input);
    } else {
      const fileLabel = document.createElement("button");
      fileLabel.type = "button";
      fileLabel.className = "tree-label tree-file-label";
      fileLabel.disabled = isPayloadMode();
      fileLabel.dataset.filePath = entry.id;
      const labelText = document.createElement("span");
      labelText.className = "tree-label-text";
      labelText.textContent = entry.label;
      labelText.title = entry.label;
      const count = document.createElement("span");
      count.className = "tree-count";
      count.textContent = String(getEntryTuneCount(entry) || 0);
      fileLabel.append(labelText, count);
      fileLabel.addEventListener("click", (ev) => {
        // Prevent accidental double-toggle when user double-clicks to load.
        if (entry.isFile && ev && ev.detail && ev.detail > 1) return;
        showHoverStatus(entry.label);
        if (entry.isFile) {
          // Do not change the editor's active file by merely expanding/collapsing the tree.
          // `activeFilePath` is the editor file source of truth (set by `setActiveTuneText` / file loads).
          //
          // Exception: when no file is currently open in the editor (Untitled), allow selecting a file
          // as a target for append/new-tune workflows.
          const editorFilePath = (activeTuneMeta && activeTuneMeta.path)
            ? String(activeTuneMeta.path || "")
            : ((currentDoc && currentDoc.path) ? String(currentDoc.path || "") : "");
          if (!editorFilePath) {
            activeFilePath = entry.id;
          }
          if (collapsedFiles.has(entry.id)) collapsedFiles.delete(entry.id);
          else collapsedFiles.add(entry.id);
        } else {
          if (collapsedGroups.has(entry.id)) collapsedGroups.delete(entry.id);
          else collapsedGroups.add(entry.id);
        }
        scheduleRenderLibraryTree(sourceFiles);
        scheduleSaveLibraryUiState();
      });
      fileLabel.addEventListener("dblclick", (ev) => {
        if (!entry.isFile) return;
        ev.preventDefault();
        ev.stopPropagation();
        requestLoadLibraryFile(entry.id).catch(() => {});
      });
      fileLabel.addEventListener("mouseenter", () => showHoverStatus(entry.label));
      fileLabel.addEventListener("mouseleave", () => restoreHoverStatus());
      fileLabel.addEventListener("focus", () => showHoverStatus(entry.label));
      fileLabel.addEventListener("blur", () => restoreHoverStatus());
      fileLabel.addEventListener("contextmenu", (ev) => {
        if (!entry.isFile) return;
        ev.preventDefault();
        showContextMenuAt(ev.clientX, ev.clientY, { type: "file", filePath: entry.id });
      });
      fileLabel.addEventListener("dragover", (ev) => {
        if (!entry.isFile || !isLibraryTuneDrag(ev)) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
        fileLabel.classList.add("drop-target");
      });
      fileLabel.addEventListener("dragleave", () => {
        fileLabel.classList.remove("drop-target");
      });
      fileLabel.addEventListener("drop", async (ev) => {
        if (!entry.isFile) return;
        ev.preventDefault();
        ev.stopPropagation();
        fileLabel.classList.remove("drop-target");
        const tuneId = getLibraryDragTuneId(ev);
        libraryDragTuneId = "";
        if (!tuneId) return;
        await moveTuneToFile(tuneId, entry.id);
      });
      fileNode.appendChild(fileLabel);
    }

    const children = document.createElement("div");
    children.className = "tree-children";

    const sortedEntryTunes = sortTunes(entry.tunes, tuneSortMode);
    for (const tune of sortedEntryTunes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tree-label tune-label";
      button.draggable = true;
      button.disabled = isPayloadMode();
      const labelNumber = tune.xNumber || String(tune.indexInFile);
      const title = tune.title || tune.preview || "";
      const composer = tune.composer ? ` - ${tune.composer}` : "";
      const key = tune.key ? ` - ${tune.key}` : "";
      const tuneLabel = `${labelNumber}: ${title}${composer}${key}`.trim();
      button.textContent = tuneLabel;
      button.title = tuneLabel;
      button.dataset.tuneId = tune.id;
      if (tune.tuneUid) button.dataset.tuneUid = tune.tuneUid;
      const isActiveByUid = Boolean(activeTuneUid && tune.tuneUid && tune.tuneUid === activeTuneUid);
      const isActiveById = Boolean(activeTuneId && tune.id && tune.id === activeTuneId);
      if (isActiveByUid || isActiveById) button.classList.add("active");
      button.addEventListener("mouseenter", () => showHoverStatus(tuneLabel));
      button.addEventListener("mouseleave", () => restoreHoverStatus());
      button.addEventListener("focus", () => showHoverStatus(tuneLabel));
      button.addEventListener("blur", () => restoreHoverStatus());
      button.addEventListener("dragstart", (ev) => {
        libraryDragTuneId = tune.id;
        ev.dataTransfer.setData(LIBRARY_TUNE_DRAG_MIME, tune.id);
        ev.dataTransfer.setData("text/plain", tune.id);
        ev.dataTransfer.effectAllowed = "move";
      });
      button.addEventListener("dragend", () => {
        libraryDragTuneId = "";
      });
      button.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const targetPath = entry.isFile
          ? entry.id
          : String(tune.id || "").split("::")[0];
		        if (targetPath) {
		          activeFilePath = targetPath;
		          scheduleRenderLibraryTree(sourceFiles);
		        }
		        showContextMenuAt(ev.clientX, ev.clientY, { type: "tune", tuneId: tune.id });
		      });
      button.addEventListener("click", () => {
        pinHoverStatus(tuneLabel);
        const targetPath = entry.isFile
          ? entry.id
          : String(tune.id || "").split("::")[0];
		        if (targetPath) {
		          activeFilePath = targetPath;
		          scheduleRenderLibraryTree(sourceFiles);
		        }
		        if (rawMode) {
		          if ($fileTuneSelect) $fileTuneSelect.value = tune.id;
		          setActiveTuneInRaw(tune.id);
	          scrollToTuneInRaw(tune.id);
	          return;
	        }
          // Do not rely solely on `tune.id` (it can change if the file is re-parsed).
          // Use the tolerant open helper that can fall back to xNumber and force a re-parse.
          openTuneFromLibrarySelection({
            filePath: targetPath,
            tuneUid: tune.tuneUid || null,
            tuneId: tune.id,
            xNumber: tune.xNumber,
          }).then((res) => {
            if (!res || !res.ok) {
              const msg = res && res.error ? res.error : "Unable to open tune.";
              showToast(msg, 3000);
            }
          }).catch(() => {
            showToast("Unable to open tune.", 3000);
          });
	      });
      children.appendChild(button);
    }

    fileNode.appendChild(children);
    fragment.appendChild(fileNode);
  }
  $libraryTree.appendChild(fragment);
  updateFileHeaderPanel();
}

function markActiveTuneButton(tuneId) {
  if ($libraryTree) {
    const buttons = $libraryTree.querySelectorAll(".tree-label");
    for (const btn of buttons) {
      if (btn.dataset && btn.dataset.tuneId) {
        const isActiveByUid = Boolean(activeTuneUid && btn.dataset.tuneUid && btn.dataset.tuneUid === activeTuneUid);
        const isActiveById = Boolean(activeTuneId && btn.dataset.tuneId && btn.dataset.tuneId === activeTuneId);
        btn.classList.toggle("active", isActiveByUid || isActiveById);
      }
    }
  }
}

async function selectTune(tuneId, options = {}) {
  const perfOn = isStartupPerfEnabled();
  const t0 = perfOn ? perfNowMs() : 0;
  if (!libraryIndex || !tuneId) return;
  recordRecentAction("selectTune.start", {
    tuneId: String(tuneId),
    skipConfirm: Boolean(options && options.skipConfirm),
    rawMode: Boolean(rawMode),
    focusMode: Boolean(focusModeEnabled),
    payloadMode: Boolean(isPayloadMode()),
  });
  if (!options.skipConfirm) {
    const ok = await ensureSafeToAbandonCurrentDoc("switching tunes");
    if (!ok) return { ok: false, cancelled: true };
  }
  let selected = null;
  let fileMeta = null;

  for (const file of libraryIndex.files) {
    const found = file.tunes.find((t) => (t && t.tuneUid && t.tuneUid === tuneId) || (t && t.id === tuneId));
    if (found) {
      selected = found;
      fileMeta = file;
      break;
    }
  }

  if (!selected || !fileMeta) return { ok: false, error: "Tune not found." };

  try {
    if (window.api && typeof window.api.openWorkingCopy === "function" && fileMeta.path) {
      if (!workingCopySnapshot || !workingCopySnapshot.path || !pathsEqual(workingCopySnapshot.path, fileMeta.path)) {
        const tWc0 = perfOn ? perfNowMs() : 0;
        recordRecentAction("wc.open", { path: String(fileMeta.path), reason: "selectTune" });
        await window.api.openWorkingCopy(fileMeta.path);
        const snapshot = await refreshWorkingCopySnapshot();
        if (perfOn) logStartupPerf("selectTune: openWorkingCopy", { ms: Math.round(perfNowMs() - tWc0), file: safeBasename(fileMeta.path) });
        if (snapshot && snapshot.path && pathsEqual(snapshot.path, fileMeta.path)) {
          attachTuneUidsToLibraryFile(fileMeta.path, snapshot);
          scheduleRenderLibraryTree();
        }
      }
    }
  } catch {}

  let content = null;
  let sliceStart = Number(selected.startOffset) || 0;
  let sliceEnd = Number(selected.endOffset) || 0;
  const workingCopyOpen = Boolean(fileMeta.path && isWorkingCopyOpenForFile(fileMeta.path));

  if (workingCopyOpen) {
    const attemptSliceFromSnapshot = () => resolveTuneEntryFromSnapshot(
      workingCopySnapshot,
      {
        tuneUid: selected.tuneUid,
        tuneIndex: selected.tuneIndex,
        startOffset: selected.startOffset,
      }
    );
    let workingCopySlice = attemptSliceFromSnapshot();
    if (!workingCopySlice) {
      await refreshWorkingCopySnapshot();
      workingCopySlice = attemptSliceFromSnapshot();
    }

    if (!workingCopySlice) {
      // When another instance or external tooling modifies the file, library metadata (tuneUid/index/offsets)
      // can drift from the current working-copy snapshot. Prefer refreshing library state from the snapshot
      // over prompting "Reload from disk?" (which is noisy and often doesn't resolve metadata drift).
      if (!options._syncedFromWorkingCopy && workingCopySnapshot && workingCopySnapshot.path && workingCopySnapshot.text) {
        try {
          const syncedFile = syncLibraryFileFromWorkingCopySnapshot(fileMeta.path, workingCopySnapshot);
          if (syncedFile && Array.isArray(syncedFile.tunes)) {
            const xNumber = selected && selected.xNumber ? String(selected.xNumber) : "";
            const idx = Number.isFinite(Number(selected && selected.tuneIndex)) ? Number(selected.tuneIndex) : null;
            const updated = syncedFile.tunes.find((t) => (
              (selected && selected.tuneUid && t && t.tuneUid && t.tuneUid === selected.tuneUid)
              || (xNumber && t && t.xNumber && String(t.xNumber) === xNumber)
              || (idx != null && t && Number.isFinite(Number(t.tuneIndex)) && Number(t.tuneIndex) === idx)
            ));
            const nextId = updated ? (updated.tuneUid || updated.id) : null;
            if (nextId) {
              return selectTune(nextId, { ...options, skipConfirm: true, _syncedFromWorkingCopy: true });
            }
          }
        } catch {}
      }
      showEmptyState();
      showToast("Tune not found in the current file state.", 3400);
      return { ok: false, error: "Tune not found in the current file state." };
    }

    content = String(workingCopySnapshot.text || "");
    sliceStart = workingCopySlice.start;
    sliceEnd = workingCopySlice.end;
    selected.startOffset = sliceStart;
    selected.endOffset = sliceEnd;
    if (workingCopySlice.tuneIndex != null) selected.tuneIndex = workingCopySlice.tuneIndex;
    if (workingCopySlice.tuneUid) selected.tuneUid = workingCopySlice.tuneUid;
    setFileContentInCache(fileMeta.path, content);
  }

  if (content == null) {
    content = getFileContentFromCache(fileMeta.path);
    if (content == null) {
      const res = await readFile(fileMeta.path);
      if (!res.ok) {
        logErr(res.error || "Unable to read file.");
        return { ok: false, error: res.error || "Unable to read file." };
      }
      content = res.data;
      setFileContentInCache(fileMeta.path, content);
    }
  }

  const isTuneSliceValid = (fullText, tune) => {
    if (!fullText || !tune || !Number.isFinite(Number(tune.startOffset))) return false;
    const start = Number(tune.startOffset);
    const probe = String(fullText).slice(start, Math.min(fullText.length, start + 160));
    if (!/^\s*X:/.test(probe)) return false;
    return true;
  };

  if (!workingCopyOpen && !options._reparsed && !isTuneSliceValid(content, selected)) {
    try {
      const updatedFile = await refreshLibraryFile(fileMeta.path, { force: true });
      const tunes = updatedFile && Array.isArray(updatedFile.tunes) ? updatedFile.tunes : [];
      const expectedTitle = selected && selected.title ? String(selected.title).trim().toLowerCase() : "";
      const expectedStart = Number.isFinite(Number(selected.startOffset)) ? Number(selected.startOffset) : null;
      const expectedId = selected && selected.id ? String(selected.id) : "";

      let replacement = null;
      if (expectedId) replacement = tunes.find((t) => t && t.id && String(t.id) === expectedId) || null;
      if (!replacement && expectedStart != null) replacement = tunes.find((t) => Number(t.startOffset) === expectedStart) || null;
      if (!replacement && expectedTitle) replacement = tunes.find((t) => String(t && (t.title || "")).trim().toLowerCase() === expectedTitle) || null;
      if (replacement && replacement.id) {
        return selectTune(replacement.id, { ...options, skipConfirm: true, _reparsed: true });
      }
    } catch {}
  }

  const tuneText = content.slice(sliceStart, sliceEnd);
  activeTuneId = selected.id;
  activeTuneUid = selected.tuneUid || null;
  activeTuneIndex = Number.isFinite(Number(selected.tuneIndex)) ? Number(selected.tuneIndex) : null;
  if ($fileTuneSelect && !$fileTuneSelect.disabled) {
    const nextKey = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
    try { $fileTuneSelect.value = nextKey; } catch {}
  }
  markActiveTuneButton(tuneId);
  setActiveTuneText(tuneText, {
    id: selected.id,
    tuneUid: selected.tuneUid || "",
    tuneIndex: Number.isFinite(Number(selected.tuneIndex)) ? Number(selected.tuneIndex) : null,
    path: fileMeta.path,
    basename: fileMeta.basename,
    xNumber: selected.xNumber,
    title: selected.title || "",
    startLine: selected.startLine,
    endLine: selected.endLine,
    startOffset: sliceStart,
    endOffset: sliceEnd,
  }, { suppressRecent: options.suppressRecent || false });
  // Reset playback/selection state on tune switch to avoid leaking selection-mode playback flags.
  selectionPlaybackRuntime.clearSelectionCapture();
  resetPlaybackState();
  setPlaybackRange({ startOffset: 0, endOffset: null, origin: "cursor", loop: false });
  if (editorView) {
    try { editorView.dispatch({ selection: { anchor: 0, head: 0 }, scrollIntoView: false }); } catch {}
  }
  setDirtyIndicator(false);
  clearAbPlan();
  scheduleAutoWcDump("switch", selected && selected.xNumber ? `X:${String(selected.xNumber)}` : "");
  if (perfOn) {
    logStartupPerf("selectTune() done", {
      ms: Math.round(perfNowMs() - t0),
      file: fileMeta && fileMeta.path ? safeBasename(fileMeta.path) : "",
      x: selected && selected.xNumber ? String(selected.xNumber) : "",
    });
  }
  return { ok: true };
}

// Canonical Library Tree open entrypoint: `selectTune(tuneId)`.
// This wrapper reuses the same loading/confirm logic for the modal.
async function openTuneFromLibrarySelection(selection) {
  if (!selection) {
    const msg = "No selection.";
    logErr(msg);
    return { ok: false, error: msg };
  }

  const filePath = selection.filePath || selection.path || null;
  const tuneId = selection.tuneId || selection.id || null;
  const tuneUid = selection.tuneUid || null;
  const tuneNo = selection.tuneNo != null ? String(selection.tuneNo) : null;
  const xNumber = selection.xNumber != null ? String(selection.xNumber) : null;

  if (!filePath) {
    const msg = "Cannot open selection: missing file path (row may be demo data).";
    logErr(msg);
    return { ok: false, error: msg };
  }
  if (!tuneUid && !tuneId && !tuneNo && !xNumber) {
    const msg = "Cannot open selection: missing tune id/number.";
    logErr(msg);
    return { ok: false, error: msg };
  }

  const wantedPath = normalizeLibraryPath(filePath);

  const ok = await ensureSafeToAbandonCurrentDoc("opening a library tune");
  if (!ok) return { ok: false, cancelled: true };

  const dir = safeDirname(filePath);
  if (!dir) {
    const msg = "Invalid file path.";
    logErr(msg);
    return { ok: false, error: msg };
  }

  const findFileEntry = () => {
    if (!libraryIndex || !Array.isArray(libraryIndex.files)) return null;
    return libraryIndex.files.find((f) => pathsEqual(f && f.path, wantedPath)) || null;
  };

  let fileEntry = findFileEntry();
  if (!fileEntry) {
    await loadLibraryFromFolder(dir);
    if (!libraryIndex || !Array.isArray(libraryIndex.files)) {
      const msg = "Library not loaded.";
      logErr(msg);
      return { ok: false, error: msg };
    }
    fileEntry = findFileEntry();
  }
  if (!fileEntry) {
    const msg = `File not found in library: ${filePath}`;
    logErr(msg);
    return { ok: false, error: msg };
  }

  let tune = null;
  if (tuneUid) tune = (fileEntry.tunes || []).find((t) => t && t.tuneUid && t.tuneUid === tuneUid) || null;
  if (!tune && tuneId) tune = (fileEntry.tunes || []).find((t) => t.id === tuneId) || null;
  if (!tune && tuneNo) {
    tune = (fileEntry.tunes || []).find((t) => String(t.xNumber || "") === tuneNo) || null;
  }
  if (!tune && xNumber) {
    tune = (fileEntry.tunes || []).find((t) => String(t.xNumber || "") === xNumber) || null;
  }
  if (!tune) {
    // The file may have been modified or re-parsed, making cached tune IDs stale.
    // Force a re-parse of the file and retry matching by id / X number.
    try {
      const refreshed = await refreshLibraryFile(fileEntry.path, { force: true });
      const tunes = refreshed && Array.isArray(refreshed.tunes) ? refreshed.tunes : (fileEntry.tunes || []);
      if (tuneUid) tune = tunes.find((t) => t && t.tuneUid && t.tuneUid === tuneUid) || null;
      if (!tune && tuneId) tune = tunes.find((t) => t && t.id === tuneId) || null;
      if (!tune && tuneNo) tune = tunes.find((t) => String(t && (t.xNumber || "")) === tuneNo) || null;
      if (!tune && xNumber) tune = tunes.find((t) => String(t && (t.xNumber || "")) === xNumber) || null;
    } catch {}
  }
  if (!tune) {
    const msg = `Tune not found in file: ${safeBasename(filePath)}${tuneNo ? ` (X:${tuneNo})` : (xNumber ? ` (X:${xNumber})` : "")}`;
    logErr(msg);
    return { ok: false, error: msg };
  }

  const res = await selectTune(tune.tuneUid || tune.id, { skipConfirm: true });
  if (res && res.ok) return { ok: true };
  if (res && res.cancelled) return { ok: false, cancelled: true };
  return { ok: false, error: (res && res.error) ? res.error : "Unable to open tune." };
}

window.openTuneFromLibrarySelection = openTuneFromLibrarySelection;

async function openRecentTune(entry) {
  if (!entry || !entry.path) return { ok: false, error: "Missing path." };
  const ok = await ensureSafeToAbandonCurrentDoc("opening a recent tune");
  if (!ok) return { ok: false, cancelled: true };

  chordProFeature.setMode(false);
  const dir = safeDirname(entry.path);
  await loadLibraryFromFolder(dir);
  if (libraryIndex && libraryIndex.files) {
    const id = `${entry.path}::${entry.startOffset || 0}`;
    const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, entry.path));
    const tune = fileEntry ? fileEntry.tunes.find((t) => t.id === id) : null;
    if (tune) {
      await selectTune(tune.id);
      return { ok: true };
    }
  }
  const res = await readFile(entry.path);
  if (!res.ok) {
    logErr(res.error || "Unable to read file.");
    return { ok: false, error: res.error || "Unable to read file." };
  }
  setFileContentInCache(entry.path, res.data);
  const startOffset = entry.startOffset || 0;
  const endOffset = entry.endOffset || res.data.length;
  const tuneText = res.data.slice(startOffset, endOffset);
  setActiveTuneText(tuneText, {
    id: `${entry.path}::${startOffset}`,
    path: entry.path,
    basename: entry.basename || safeBasename(entry.path),
    xNumber: entry.xNumber || "",
    title: entry.title || "",
    startLine: entry.startLine || 1,
    endLine: entry.endLine || countLines(tuneText),
    startOffset,
    endOffset,
  });
  setDirtyIndicator(false);
  return { ok: true };
}

async function openRecentFile(entry) {
  if (!entry || !entry.path) return { ok: false, error: "Missing path." };
  const ok = await ensureSafeToAbandonCurrentDoc("opening a recent file");
  if (!ok) return { ok: false, cancelled: true };
  const targetPath = String(entry.path || "");
  const activePath = String(
    (activeTuneMeta && activeTuneMeta.path)
      || (currentDoc && currentDoc.path)
      || ""
  );
  const shouldForceReload = Boolean(entry && entry.forceReload);
  const reopeningActiveFile = Boolean(targetPath && activePath && pathsEqual(targetPath, activePath));
  if (targetPath && (shouldForceReload || reopeningActiveFile)) {
    try {
      if (window.api && typeof window.api.getWorkingCopyMeta === "function") {
        const metaRes = await window.api.getWorkingCopyMeta();
        const openedPath = (metaRes && metaRes.ok && metaRes.meta && metaRes.meta.path)
          ? String(metaRes.meta.path || "")
          : "";
        if (openedPath && pathsEqual(openedPath, targetPath)) {
          if (typeof window.api.reloadWorkingCopyFromDisk === "function") {
            await window.api.reloadWorkingCopyFromDisk();
            await refreshWorkingCopySnapshot();
          }
        } else if (typeof window.api.openWorkingCopy === "function") {
          await window.api.openWorkingCopy(targetPath);
          await refreshWorkingCopySnapshot();
        }
      }
    } catch {}
    try {
      await refreshLibraryFile(targetPath, { force: true });
    } catch {}
  }
  const readRes = await readFile(entry.path);
  if (readRes && readRes.ok && (isChordProText(readRes.data) || isChordProFilePath(entry.path))) {
    await chordProFeature.open(entry.path, readRes.data, { suppressRecent: true });
    return { ok: true };
  }
  return await loadLibraryFileIntoEditor(entry.path);
}

async function openRecentFolder(entry) {
  if (!entry || !entry.path) return { ok: false, error: "Missing path." };
  if (chordProFeature.isEnabled()) {
    showToast("Library is disabled while editing ChordPro.", 2400);
    return { ok: false, error: "Library is disabled while editing ChordPro." };
  }
  const ok = await ensureSafeToAbandonCurrentDoc("opening a recent folder");
  if (!ok) return { ok: false, cancelled: true };
  await loadLibraryFromFolder(entry.path);
  if (libraryIndex && libraryIndex.root) return { ok: true };
  return { ok: false, error: "Unable to load folder." };
}

async function scanAndLoadLibrary() {
  if (chordProFeature.isEnabled()) {
    showToast("Library is disabled while editing ChordPro.", 2400);
    return;
  }
  if (!window.api) return;
  const ok = await ensureSafeToAbandonCurrentDoc("opening a folder");
  if (!ok) return;
  const folder = await showOpenFolderDialog();
  if (!folder) return;

  await loadLibraryFromFolder(folder);
  if (window.api && typeof window.api.addRecentFolder === "function") {
    window.api.addRecentFolder({ path: folder, label: folder });
  }
}

async function refreshLibraryIndex() {
  if (chordProFeature.isEnabled()) {
    showToast("Library is disabled while editing ChordPro.", 2400);
    return;
  }
  if (!window.api || typeof window.api.scanLibrary !== "function") return;
  if (!libraryIndex || !libraryIndex.root) {
    setStatus("Load a library folder first.");
    return;
  }
  const scanToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const rootAtStart = libraryIndex.root;
  setScanStatus("Refreshing…");
  fileContentCache.clear();
  libraryErrorIndex.clear();
  if (libraryIndex && libraryIndex.root) {
    setFileNameMeta(stripFileExtension(safeBasename(libraryIndex.root)));
  }
  try {
    if (typeof window.api.scanLibraryDiscover === "function") {
      const discovered = await window.api.scanLibraryDiscover(libraryIndex.root, { token: scanToken, computeMeta: true });
      if (discovered && discovered.root && Array.isArray(discovered.files)) {
        if (!libraryIndex || libraryIndex.root !== rootAtStart) return;
        libraryIndex = {
          root: discovered.root,
          files: (discovered.files || []).map((f) => ({ ...f, tunes: Array.isArray(f.tunes) ? f.tunes : [] })),
        };
        libraryViewStore.invalidate();
        updateLibraryRootUI();
        scheduleRenderLibraryTree();
        updateLibraryStatus();
      }
    }
    if (!libraryIndex || libraryIndex.root !== rootAtStart) return;
    await ensureFullLibraryIndex({ reason: "refresh" });
    if (libraryFilterLabel) clearLibraryFilter();
    else {
      scheduleRenderLibraryTree();
      updateLibraryStatus();
    }
		  } catch (e) {
		    setScanStatus("Refresh failed.");
		    logErr(e && e.message ? e.message : String(e));
	  }
}

async function loadLibraryFromFolder(folder) {
  if (!window.api || !folder) return;
  reportStartupStatus("Scanning library…");
  startupAutoLoadStarted = true;
  renderUnifiedStatus();
  const perfOn = isStartupPerfEnabled();
  const t0 = perfOn ? perfNowMs() : 0;
  if (perfOn) logStartupPerf("loadLibraryFromFolder() start", { folder: abbreviatePathForLog(folder, 3) });
  const scanToken = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  setScanStatus("Scanning…");
  fileContentCache.clear();
  libraryErrorIndex.clear();
  activeTuneId = null;
  setTuneMetaText("No tune selected.");
  setFileNameMeta(stripFileExtension(safeBasename(folder || "")));
  suppressDirty = true;
  setEditorValue("");
  suppressDirty = false;
  if (currentDoc) {
    currentDoc.path = null;
    currentDoc.content = "";
    currentDoc.dirty = false;
  }
  setDirtyIndicator(false);

  try {
    if (typeof window.api.scanLibraryDiscover === "function") {
      const tDisc0 = perfOn ? perfNowMs() : 0;
      const discovered = await window.api.scanLibraryDiscover(folder, { token: scanToken, computeMeta: true });
      if (perfOn) logStartupPerf("scanLibraryDiscover()", { ms: Math.round(perfNowMs() - tDisc0), files: discovered && discovered.files ? discovered.files.length : 0 });
      if (discovered && discovered.root && Array.isArray(discovered.files)) {
        if (!libraryIndex && folder !== discovered.root) {
          // proceed: first load
        }
        libraryIndex = {
          root: discovered.root,
          files: (discovered.files || []).map((f) => ({ ...f, tunes: Array.isArray(f.tunes) ? f.tunes : [] })),
        };
        libraryViewStore.invalidate();
        updateLibraryRootUI();
        clearLibraryFilter();
        collapsedFiles.clear();
        collapsedGroups.clear();
        activeFilePath = null;
        applyLibraryUiStateFromSettings(latestSettingsSnapshot);
        scheduleRenderLibraryTree();
        updateLibraryStatus();
      }
    }
    if (libraryIndex && libraryIndex.root && libraryIndex.root !== folder) {
      // User switched again while discover ran.
      return;
    }
    reportStartupStatus("Indexing tunes…");
    await ensureFullLibraryIndex({ reason: "library" });
    if (libraryIndex && libraryIndex.root && libraryIndex.root !== folder) return;

    clearLibraryFilter();
    collapsedFiles.clear();
    collapsedGroups.clear();
    activeFilePath = null;
    if (groupMode === "file") {
      for (const file of libraryIndex.files || []) {
        collapsedFiles.add(file.path);
      }
    } else {
      const groups = buildGroupEntries(libraryIndex.files || [], groupMode);
      for (const group of groups) collapsedGroups.add(group.id);
    }
    const restoredSelection = applyLibraryUiStateFromSettings(latestSettingsSnapshot);
    scheduleRenderLibraryTree();
    let firstTuneId = null;
    const restoredTune = restoredSelection && restoredSelection.tuneSelection
      ? await restoreLibraryTuneSelection(restoredSelection.tuneSelection)
      : false;
    if (!restoredTune) {
      for (const file of libraryIndex.files || []) {
        if (file.tunes && file.tunes.length) {
          firstTuneId = file.tunes[0].id;
          break;
        }
      }
      if (firstTuneId) {
        reportStartupStatus("Opening first tune…");
        const tSel0 = perfOn ? perfNowMs() : 0;
        await selectTune(firstTuneId);
        if (perfOn) logStartupPerf("selectTune(first)", { ms: Math.round(perfNowMs() - tSel0) });
      }
    }
    updateLibraryStatus();
    if (perfOn) logStartupPerf("loadLibraryFromFolder() done", { ms: Math.round(perfNowMs() - t0) });
    markStartupUiReady();
		  } catch (e) {
		    setScanStatus("Scan failed");
		    logErr((e && e.stack) ? e.stack : String(e));
        markStartupUiReady();
		  }
}

async function loadLibraryFileIntoEditor(filePath) {
  if (!filePath) return { ok: false, error: "Missing file path." };
  let chordproText = null;
  try {
    if (window.api && typeof window.api.openWorkingCopy === "function") {
      await window.api.openWorkingCopy(filePath);
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
        attachTuneUidsToLibraryFile(filePath, snapshot);
        scheduleRenderLibraryTree();
        if (snapshot.text) chordproText = String(snapshot.text || "");
      }
    }
  } catch {}
  if (!chordproText) {
    const cached = getFileContentFromCache(filePath);
    if (cached != null) chordproText = String(cached || "");
  }
  if (!chordproText && isChordProFilePath(filePath)) {
    const readRes = await readFile(filePath);
    if (readRes && readRes.ok) chordproText = String(readRes.data || "");
  }
  if (chordproText && (isChordProText(chordproText) || isChordProFilePath(filePath))) {
    await chordProFeature.open(filePath, chordproText, { suppressRecent: true });
    return { ok: true, chordpro: true };
  }
  chordProFeature.setMode(false);
  activeFilePath = filePath;
  recordNavFilePath(filePath);
  const resolveFromIndex = async () => {
    if (!libraryIndex || !libraryIndex.files) return { ok: false };
    const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath)) || null;
    if (!fileEntry) return { ok: false };
    if (fileEntry.tunes && fileEntry.tunes.length) {
      const first = fileEntry.tunes[0];
      const key = first ? (first.tuneUid || first.id) : "";
      if (key) await selectTune(key);
      return { ok: true };
    }
    const tuneCount = Number.isFinite(fileEntry.tuneCount) ? fileEntry.tuneCount : null;
    const shouldTryParse = tuneCount == null || tuneCount > 0;
    if (shouldTryParse) {
      const updated = await refreshLibraryFile(filePath);
      if (updated && updated.tunes && updated.tunes.length) {
        const first = updated.tunes[0];
        const key = first ? (first.tuneUid || first.id) : "";
        if (key) await selectTune(key);
        return { ok: true };
      }
    }
    return { ok: false, error: `No tunes found in file: ${safeBasename(filePath)}` };
  };

  const inMemory = await resolveFromIndex();
  if (inMemory.ok) return inMemory;

  const dir = safeDirname(filePath);
  await loadLibraryFromFolder(dir);
  const afterLoad = await resolveFromIndex();
  if (afterLoad.ok) return afterLoad;
  return { ok: false, error: afterLoad.error || `File not found in library: ${safeBasename(filePath)}` };
}

async function requestLoadLibraryFile(filePath) {
  if (!filePath) {
    showToast("No file selected.", 2400);
    return false;
  }
  const ok = await ensureSafeToAbandonCurrentDoc("loading another file");
  if (!ok) return false;
  try {
    const res = await loadLibraryFileIntoEditor(filePath);
    if (res && res.ok) return true;
    const msg = res && res.error ? res.error : "Unable to load file.";
    logErr(msg);
    showToast(msg, 3000);
    return false;
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    logErr(msg);
    showToast("Unable to load file.", 3000);
    return false;
  }
}

if ($btnToggleLibrary) {
  $btnToggleLibrary.addEventListener("click", (e) => {
    if (e && e.shiftKey) {
      openLibraryListFromCurrentLibraryIndex();
      return;
    }
    toggleLibrary();
  });
}

// Global Stop shortcut (Esc): stop playback if it is active.
// Note: other Esc handlers (search, popovers, inputs) run in capture phase and will preventDefault/stopPropagation.
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented) return;
  if (e.key !== "Escape") return;
  // Avoid surprising behavior when typing in inputs (Escape is often used to clear/close UI).
  const el = e.target;
  const tag = el && el.tagName ? String(el.tagName).toLowerCase() : "";
  if (tag === "input" || tag === "textarea" || (el && el.isContentEditable)) return;
  e.preventDefault();
  // Always route Esc to transport stop/reset so users can “double‑Esc” out of selection play.
  stopPlaybackTransport();
});

if ($groupBy) {
  $groupBy.addEventListener("change", () => {
    groupMode = $groupBy.value || "file";
    collapsedGroups.clear();
    const savedGroupSort = normalizeGroupSortMode(groupSortPrefs.get(groupMode))
      || getDefaultGroupSortMode(groupMode);
    setSortMode(savedGroupSort);
    groupSortPrefs.set(groupMode, sortMode);
    const savedTuneSort = normalizeTuneSortMode(groupTuneSortPrefs.get(groupMode))
      || getDefaultTuneSortMode(groupMode);
    setTuneSortMode(savedTuneSort);
    groupTuneSortPrefs.set(groupMode, tuneSortMode);
    scheduleSaveLibraryPrefs({
      libraryGroupBy: groupMode,
      librarySortBy: sortMode,
      libraryTuneSortBy: tuneSortMode,
    });
    if (groupMode !== "file" && !hasFullLibraryIndex()) {
      ensureFullLibraryIndex({ reason: `group by ${groupMode}` }).catch(() => {});
    }
		    if (libraryIndex && libraryIndex.files) {
		      if (groupMode === "file") {
		        collapsedFiles.clear();
		        for (const file of libraryIndex.files) collapsedFiles.add(file.path);
		      } else {
		        const groups = buildGroupEntries(libraryIndex.files, groupMode);
		        for (const group of groups) collapsedGroups.add(group.id);
		      }
		      renderLibraryTree();
          scheduleSaveLibraryUiState();
		    }
		  });
		}

if ($sortBy) {
  if ($sortBy.value) setSortMode($sortBy.value);
		  $sortBy.addEventListener("change", () => {
		    setSortMode($sortBy.value || getDefaultGroupSortMode(groupMode));
		    groupSortPrefs.set(groupMode, sortMode);
        scheduleSaveLibraryPrefs({ librarySortBy: sortMode });
		    renderLibraryTree();
		  });
		}

if ($sortTunesBy) {
  if ($sortTunesBy.value) setTuneSortMode($sortTunesBy.value);
  $sortTunesBy.addEventListener("change", () => {
    setTuneSortMode($sortTunesBy.value || getDefaultTuneSortMode(groupMode));
    groupTuneSortPrefs.set(groupMode, tuneSortMode);
    scheduleSaveLibraryPrefs({ libraryTuneSortBy: tuneSortMode });
    renderLibraryTree();
  });
}

if ($librarySearch) {
  $librarySearch.addEventListener("input", () => {
    scheduleLibrarySearch($librarySearch.value || "");
    scheduleSaveLibraryPrefs({ libraryFilterText: $librarySearch.value || "" });
  });
  $librarySearch.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      libraryTextFilter = "";
      $librarySearch.value = "";
      scheduleSaveLibraryPrefs({ libraryFilterText: "" });
		      if (librarySearchTimer) {
		        clearTimeout(librarySearchTimer);
		        librarySearchTimer = null;
		      }
		      renderLibraryTree();
	      updateLibraryStatus();
	      e.preventDefault();
		}
	});
}

if ($btnLibraryClearFilter) {
  $btnLibraryClearFilter.addEventListener("click", () => {
    libraryTextFilter = "";
    if ($librarySearch) $librarySearch.value = "";
    scheduleSaveLibraryPrefs({ libraryFilterText: "" });
    if (librarySearchTimer) {
      clearTimeout(librarySearchTimer);
      librarySearchTimer = null;
    }
    if (libraryFilterLabel) {
      clearLibraryFilter();
    } else {
      renderLibraryTree();
      updateLibraryStatus();
    }
  });
}

if ($btnLibraryRefresh) {
  $btnLibraryRefresh.addEventListener("click", async () => {
    try {
      await refreshLibraryIndex();
    } catch {}
  });
}

if ($scanErrorTunes) {
  $scanErrorTunes.addEventListener("click", () => {
    if (!errorsEnabled) {
      showToast("Errors disabled");
      return;
    }
    if (rawMode) {
      showToast("Raw mode: switch to tune mode for errors.", 2200);
      return;
    }
    if (tuneErrorScanInFlight) return;
    const entry = getActiveFileEntry();
    if (!entry) return;
    clearErrors();
    tuneErrorScanToken += 1;
    if (tuneErrorFilter) {
      tuneErrorFilter = false;
      buildTuneSelectOptions(entry);
      setScanErrorButtonActive(false);
      updateLibraryStatus();
      return;
    }
    tuneErrorFilter = true;
    buildTuneSelectOptions(entry);
    setScanErrorButtonActive(true);
    scanActiveFileForTuneErrors(entry, { filterToErrorTunes: true }).catch(() => {});
    updateLibraryStatus();
  });
}

function startScanForErrorsFromToolbarEnable() {
  if (!errorsEnabled) return;
  if (rawMode) return;
  if (isPlaying || isPaused) {
    showToast("Stop playback to scan errors");
    return;
  }
  tuneErrorFilter = false;
  tuneErrorScanToken += 1;
  setScanErrorButtonActive(false);
  refreshErrorsNow();
}

if ($btnFileNew) {
  $btnFileNew.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to create a new file.", 2400); return; }
      if (rawMode) {
        const ok = await leaveRawModeForAction("creating a new file");
        if (!ok) return;
      }
      await fileNew();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnNewTune) {
  $btnNewTune.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to create/append tunes.", 2400); return; }
      if (rawMode) {
        const ok = await leaveRawModeForAction("creating a new tune");
        if (!ok) return;
      }
      await fileNewTuneAndAppendNow();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnTemplates) {
  $btnTemplates.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to use templates.", 2400); return; }
      if (rawMode) {
        const ok = await leaveRawModeForAction("opening templates");
        if (!ok) return;
      }
      await openTemplatesModal();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnChordproPdf) {
  $btnChordproPdf.addEventListener("click", () => {
    chordProFeature.exportPdf().catch((e) => logErr((e && e.message) ? e.message : String(e)));
  });
}
if ($btnFileOpen) {
  $btnFileOpen.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to open files.", 2400); return; }
      if (rawMode) {
        const ok = await leaveRawModeForAction("opening a file");
        if (!ok) return;
      }
      await fileOpen();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnFileSave) {
  $btnFileSave.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Payload Mode is diagnostics-only (no saves).", 2600); return; }
      await fileSave();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnFileClose) {
  $btnFileClose.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to close files.", 2400); return; }
      await fileClose();
    } catch (e) { logErr((e && e.stack) ? e.stack : String(e)); }
  });
}
if ($btnToggleRaw) {
  $btnToggleRaw.addEventListener("click", async () => {
    try {
      if (isPayloadMode()) { showToast("Exit Payload Mode to switch Raw mode.", 2400); return; }
      if (chordProFeature.isEnabled()) {
        chordProFeature.setFullView(!chordProFeature.isFullView());
        return;
      }
      if (rawMode) await exitRawMode();
      else await enterRawMode();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($fileTuneSelect) {
  $fileTuneSelect.addEventListener("change", () => {
    const tuneId = $fileTuneSelect.value;
    if (tuneId === "__new__") return;
    if (isNewTuneDraft) isNewTuneDraft = false;
    if (!tuneId) return;
    if (chordProFeature.isEnabled()) {
      const idx = Number(tuneId);
      if (Number.isFinite(idx)) chordProFeature.setActiveBlock(idx, { scroll: true });
      return;
    }
    if (isPayloadMode()) {
      showToast("Exit Payload Mode to change tunes.", 2400);
      try { if (activeTuneUid || activeTuneId) $fileTuneSelect.value = rawMode ? activeTuneId : (activeTuneUid || activeTuneId); } catch {}
      return;
    }
    if (rawMode) {
      setActiveTuneInRaw(tuneId);
      scrollToTuneInRaw(tuneId);
      return;
    }
    selectTune(tuneId);
  });
}

if (window.api && typeof window.api.onLibraryProgress === "function") {
  let scanStatusClearTimer = null;
  window.api.onLibraryProgress((payload) => {
    if (!payload) return;
    if (payload.phase === "discover") {
      if (scanStatusClearTimer) {
        clearTimeout(scanStatusClearTimer);
        scanStatusClearTimer = null;
      }
      setScanStatus(`Scanning… ${payload.filesFound || 0} files`);
    } else if (payload.phase === "parse") {
      const total = payload.total || 0;
      const index = payload.index || 0;
      setScanStatus(`Indexing… ${index}/${total}`);
      if (total > 0 && index >= total) {
        if (scanStatusClearTimer) clearTimeout(scanStatusClearTimer);
        scanStatusClearTimer = setTimeout(() => {
          scanStatusClearTimer = null;
          updateLibraryStatus();
        }, 600);
      }
    } else if (payload.phase === "done") {
      const filesFound = payload.filesFound || 0;
      setScanStatus("Ready", `Ready (${filesFound} files)`);
      if (scanStatusClearTimer) clearTimeout(scanStatusClearTimer);
      scanStatusClearTimer = setTimeout(() => {
        scanStatusClearTimer = null;
        updateLibraryStatus();
      }, 900);
    }
  });
}

if (window.api && typeof window.api.onImportMidiProgress === "function") {
  window.api.onImportMidiProgress((payload) => {
    if (!midiImportInProgress || !payload) return;
    const total = Number(payload.total) || 0;
    const done = Number(payload.done) || 0;
    if (done <= 0) {
      setStatus("Importing MIDI…");
      return;
    }
    if (total > 0 && done >= total) {
      setStatus("Finalizing MIDI import…");
      return;
    }
    const src = payload.sourcePath ? safeBasename(String(payload.sourcePath)) : "";
    setStatus(src ? `Importing MIDI… ${done}/${total} (${src})` : `Importing MIDI… ${done}/${total}`);
  });
}

function createBlankDocument() {
  return {
    path: null,
    dirty: false,
    content: DEFAULT_ABC,
  };
}

// debounce
let t = null;

function setStatus(s) {
  appStatusText = String(s || "");
  renderUnifiedStatus();
}

function setButtonText(button, text) {
  if (!button) return;
  const span = button.querySelector ? button.querySelector(".btn-text") : null;
  const value = String(text || "");
  if (span) span.textContent = value;
  else button.textContent = value;
}

let pinnedHoverStatusText = "";

function setHoverStatus(text) {
  if (!$hoverStatus) return;
  const next = String(text || "");
  $hoverStatus.textContent = next;
  $hoverStatus.title = next;
}

function pinHoverStatus(text) {
  // Keep hover status transient; avoid sticky long labels in the taskbar.
  pinnedHoverStatusText = "";
  setHoverStatus("");
}

function showHoverStatus(text) {
  const next = String(text || "");
  if (next) setHoverStatus(next);
  else setHoverStatus(pinnedHoverStatusText);
}

function restoreHoverStatus() {
  setHoverStatus(pinnedHoverStatusText);
}

function setBufferStatus(text) {
  bufferStatusText = String(text || "");
  renderBufferStatus();
}

function setTransientBufferStatus(text, autoClearMs = 3200) {
  setBufferStatus(text);
  const delay = Number.isFinite(Number(autoClearMs)) ? Number(autoClearMs) : 3200;
  setTimeout(() => {
    if (bufferStatusText === String(text || "")) setBufferStatus("");
  }, Math.max(0, delay));
}

function formatDefaultLenText(defaultLen) {
  if (defaultLen === "mcm_default") return "mcm_default";
  if (!Number.isFinite(defaultLen)) return "?";
  const inv = Math.round(1 / defaultLen);
  if (Number.isFinite(inv) && inv > 0) return `1/${inv}`;
  return String(defaultLen);
}

function parseMeterParts(abc) {
  const match = String(abc || "").match(/^M:\s*(\d+)\s*\/\s*(\d+)/m);
  if (!match) return null;
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
  return { num, den };
}

function formatMeterInfo(abc) {
  const parts = parseMeterParts(abc);
  if (!parts) return { text: "M: (unknown)", expectedWhole: null, expectedUnits: null };
  const expectedWhole = parts.num / parts.den;
  const beatsText = `${parts.num}×1/${parts.den}`;
  const compoundText = (parts.den === 8 && parts.num > 3 && parts.num % 3 === 0)
    ? `; compound: ${parts.num / 3}×3/8`
    : "";
  return {
    text: `M:${parts.num}/${parts.den} (beats: ${beatsText}${compoundText})`,
    expectedWhole,
  };
}

function computeMeasureStatsAt(editorText, anchorOffset) {
  if (!editorText || !Number.isFinite(anchorOffset)) return null;
  if (!shouldComputeMeasureStatsAt(editorText, anchorOffset)) return null;
  const range = findMeasureRangeAt(editorText, anchorOffset);
  if (!range) return null;
  const defaultLen = getDefaultLen(editorText);
  const metre = getMetre(editorText);
  const meterInfo = formatMeterInfo(editorText);
  const slice = editorText.slice(range.start, range.end);
  const actualWhole = getBarLength(slice, defaultLen, metre);
  const expectedWhole = meterInfo.expectedWhole;

  let actualUnits = null;
  let expectedUnits = null;
  if (defaultLen !== "mcm_default" && Number.isFinite(defaultLen) && defaultLen > 0) {
    actualUnits = Number.isFinite(actualWhole) ? actualWhole / defaultLen : null;
    expectedUnits = Number.isFinite(expectedWhole) ? expectedWhole / defaultLen : null;
  }

  return {
    meterInfo,
    defaultLen,
    range,
    actualWhole,
    expectedWhole,
    actualUnits,
    expectedUnits,
  };
}

function shouldComputeMeasureStatsAt(editorText, anchorOffset) {
  const text = String(editorText || "");
  if (!text || !Number.isFinite(anchorOffset)) return false;
  const idx = Math.max(0, Math.min(Math.floor(anchorOffset), Math.max(0, text.length - 1)));
  const lineStart = Math.max(0, text.lastIndexOf("\n", idx - 1) + 1);
  const nextNl = text.indexOf("\n", idx);
  const lineEnd = nextNl >= 0 ? nextNl : text.length;
  const line = text.slice(lineStart, lineEnd);
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  if (/^[A-Za-z]:/.test(trimmed)) return false;
  if (/^\[[A-Za-z]:[^\]]*\]\s*$/.test(trimmed)) return false;
  return true;
}

function setErrorFocusMessage(entry, from) {
  errorsFocusMessageController.set(entry, from);
}

function clearErrorFocusMessage() {
  errorsFocusMessageController.clear();
}

function isDebugMessagesEnabled() {
  return Boolean(window.__abcarusDebugMessages);
}

function isCriticalToast(message) {
  const msg = String(message || "").trim();
  if (!msg) return false;
  const criticalPrefixes = [
    "Playback failed",
    "Playback parse error",
    "Selected range cannot be played safely",
    "Range crosses repeat",
    "Unable to ",
    "Unable ",
    "Failed to ",
    "Save/Discard",
    "Stop playback",
    "Exit Payload Mode",
    "Raw mode: switch",
    "Open/select a file first",
    "Open a file first",
    "No working copy open",
    "No active file selected",
    "No file selected",
    "Save the active file first",
    "Close the file in the editor before renaming it",
    "Invalid measure number",
    "Measure ",
    "Export not available",
    "Import not available",
    "Not available",
    "Payload Mode is disabled",
  ];
  for (const prefix of criticalPrefixes) {
    if (msg.startsWith(prefix)) return true;
  }
  if (msg.includes("cannot be played")) return true;
  if (msg.includes("Cannot read properties")) return true;
  return false;
}

function showToast(message, durationMs = 4000) {
  if (!$toast) return;
  if (!isDebugMessagesEnabled() && !isCriticalToast(message)) return;
  $toast.textContent = message || "";
  $toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $toast.classList.remove("show");
    toastTimer = null;
  }, durationMs);
}

function showToastWithAction(message, actionLabel, actionFn, durationMs = 6000) {
  if (!$toast) return;
  if (!isDebugMessagesEnabled() && !isCriticalToast(message)) return;
  const label = String(actionLabel || "").trim();
  if (!label || typeof actionFn !== "function") {
    showToast(message, durationMs);
    return;
  }

  $toast.textContent = "";
  const text = document.createElement("span");
  text.textContent = message || "";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "toast-action";
  btn.textContent = label;
  btn.addEventListener("click", (e) => {
    try { e.preventDefault(); e.stopPropagation(); } catch {}
    try { actionFn(); } catch {}
    try { $toast.classList.remove("show"); } catch {}
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  });
  $toast.appendChild(text);
  $toast.appendChild(btn);
  $toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $toast.classList.remove("show");
    toastTimer = null;
  }, durationMs);
}

function updateErrorsIndicatorAndPopover() {
  if (!errorsEnabled) {
    clearErrorFocusMessage();
    errorsPopoverController.updateIndicator({ enabled: false });
    return;
  }
  errorsPopoverController.updateIndicator({ enabled: true });
}

function setScanErrors(errorsArray) {
  lastErrors = normalizeErrors(errorsArray);
  updateErrorsIndicatorAndPopover();
  syncActiveErrorNavIndex();
}

function reconcileActiveErrorHighlightAfterRender({ renderSucceeded = false } = {}) {
  const activeErrorHighlight = errorsHighlightState.getActive();
  if (!activeErrorHighlight || !editorView) return;
  if (!Array.isArray(errorEntries) || !errorEntries.length) {
    // Only clear when we know a render completed and produced no errors.
    if (renderSucceeded) {
      clearActiveErrorHighlight("resolved");
    }
    return;
  }
  const candidates = errorEntries.filter((e) => {
    if (!e) return false;
    if (activeErrorHighlight.tuneId && e.tuneId && e.tuneId !== activeErrorHighlight.tuneId) return false;
    if (activeErrorHighlight.filePath && e.filePath && e.filePath !== activeErrorHighlight.filePath) return false;
    return normalizeErrorMessageForMatch(e.message || "") === String(activeErrorHighlight.messageKey || "");
  });
  if (!candidates.length) {
    clearActiveErrorHighlight("resolved");
    return;
  }

  const toRange = (entry) => {
    if (Number.isFinite(entry.errorStartOffset) && Number.isFinite(entry.errorEndOffset) && entry.errorEndOffset > entry.errorStartOffset) {
      return { from: entry.errorStartOffset, to: entry.errorEndOffset };
    }
    if (entry.measureRange && Number.isFinite(entry.measureRange.start) && Number.isFinite(entry.measureRange.end) && entry.measureRange.end > entry.measureRange.start) {
      return { from: entry.measureRange.start, to: entry.measureRange.end };
    }
    if (entry.loc && Number.isFinite(entry.loc.line)) {
      const pos = getEditorIndexFromLoc(entry.loc);
      if (Number.isFinite(pos)) {
        const max = editorView.state.doc.length;
        return { from: pos, to: Math.min(pos + 1, max) };
      }
    }
    return null;
  };

  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const r = toRange(c);
    if (!r) continue;
    const dist = Math.abs(r.from - activeErrorHighlight.from);
    if (dist < bestDist) {
      bestDist = dist;
      best = { entry: c, range: r };
    }
  }
  if (!best) return;

  const from = Number(best.range.from);
  const to = Number(best.range.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
  if (from !== activeErrorHighlight.from || to !== activeErrorHighlight.to) {
    setActiveErrorHighlight(best.entry, from, to);
    highlightSvgAtEditorOffset(from);
  } else {
    setErrorFocusMessage(best.entry, from);
  }
}

async function jumpToError(errItem) {
  if (!errItem) return;
  if (!errorsEnabled) {
    showToast("Errors disabled");
    return;
  }
  const targetFilePath = errItem.filePath || null;
  const targetTuneId = errItem.tuneId || null;
  if (targetFilePath && targetTuneId && typeof window.openTuneFromLibrarySelection === "function") {
    const res = await window.openTuneFromLibrarySelection({ filePath: targetFilePath, tuneId: targetTuneId });
    if (!res || !res.ok) return;
  } else if (targetTuneId) {
    await selectTune(targetTuneId);
  }

  if (!editorView) return;
  const doc = editorView.state.doc;
  const docLen = doc.length;
  let errorStartOffset = Number(errItem.errorStartOffset);
  let errorEndOffset = Number(errItem.errorEndOffset);
  if (!Number.isFinite(errorStartOffset) || !Number.isFinite(errorEndOffset) || errorEndOffset <= errorStartOffset) {
    // Fallback for errors that don't have measureRange: use line/col location if available.
    const loc = errItem.loc || null;
    if (loc && Number.isFinite(loc.line)) {
      const lineNo = Math.max(1, Math.min(doc.lines, Number(loc.line)));
      const line = doc.line(lineNo);
      const col = Number.isFinite(loc.col) ? Math.max(1, Number(loc.col)) : 1;
      const pos = Math.max(line.from, Math.min(line.to, line.from + col - 1));
      errorStartOffset = pos;
      errorEndOffset = Math.max(
        Math.min(line.to, pos + 16),
        Math.min(pos + 1, docLen)
      );
    }
  }
  if (!Number.isFinite(errorStartOffset) || !Number.isFinite(errorEndOffset) || errorEndOffset <= errorStartOffset) {
    console.error("[abcarus] Error activation missing/invalid offsets:", {
      errorStartOffset: errItem.errorStartOffset,
      errorEndOffset: errItem.errorEndOffset,
      loc: errItem.loc || null,
    });
    return;
  }
  if (errorStartOffset < 0 || errorEndOffset > docLen) {
    console.error("[abcarus] Error activation offsets out of bounds:", { errorStartOffset, errorEndOffset, docLen });
    return;
  }
  pendingPlaybackRangeOrigin = "error";
  setActiveErrorHighlight(errItem, errorStartOffset, errorEndOffset);
  errorsHighlightState.setSuppressClear(true);
  const effects = [];
  if (typeof EditorView.scrollIntoView === "function") {
    try {
      effects.push(EditorView.scrollIntoView(errorStartOffset, { y: "center" }));
    } catch {}
  }
  editorView.dispatch({
    selection: EditorSelection.cursor(errorStartOffset),
    effects,
    scrollIntoView: true,
  });
  setTimeout(() => { errorsHighlightState.setSuppressClear(false); }, 0);
  editorView.focus();

  // Best-effort: scroll notation to the same location.
  if (!highlightSvgAtEditorOffset(errorStartOffset)) {
    requestAnimationFrame(() => { highlightSvgAtEditorOffset(errorStartOffset); });
  }

  const msg = String(errItem.message || "");
  if (/bad measure duration/i.test(msg)) {
    applyPlaybackRangeFromError({ ...errItem, errorStartOffset, errorEndOffset });
  }
}

function suggestPlaybackRangeForRhythmError(errItem) {
  if (!editorView || !errItem) return null;
  const docLen = editorView.state.doc.length;
  const start = Number(errItem.errorStartOffset);
  const end = Number(errItem.errorEndOffset);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start > docLen || end > docLen || end <= start) return null;

  const coverageOk = (suggestedStart, suggestedEnd, method) => {
    const ok = suggestedStart <= start && suggestedEnd >= end && suggestedStart < suggestedEnd;
    if (!ok) {
      console.error(
        "[abcarus] Rhythm error PlaybackRange coverage failed:",
        { method, errorStart: start, errorEnd: end, suggestedStart, suggestedEnd }
      );
    }
    return ok;
  };

  const src = editorView.state.doc.toString();
  const base = findMeasureRangeAt(src, Math.max(0, Math.min(docLen - 1, start)));
  if (!base) {
    const pad = 240;
    const windowStart = Math.max(0, start - pad);
    const windowEnd = Math.min(docLen, end + pad);
    let suggestedStart = windowStart;
    let suggestedEnd = windowEnd;

    const startProbe = Math.max(windowStart, Math.min(docLen, start));
    const startSlice = src.slice(windowStart, Math.min(docLen, startProbe + 1));
    const barStartLocal = startSlice.lastIndexOf("|");
    if (barStartLocal !== -1) {
      suggestedStart = windowStart + barStartLocal;
    } else {
      const nlStartLocal = startSlice.lastIndexOf("\n");
      if (nlStartLocal !== -1) suggestedStart = windowStart + nlStartLocal;
    }

    const endProbe = Math.max(0, Math.min(docLen, end));
    const endSlice = src.slice(endProbe, windowEnd);
    const barEndLocal = endSlice.indexOf("|");
    if (barEndLocal !== -1) {
      suggestedEnd = Math.min(docLen, endProbe + barEndLocal);
    } else {
      const nlEndLocal = endSlice.indexOf("\n");
      if (nlEndLocal !== -1) suggestedEnd = Math.min(docLen, endProbe + nlEndLocal);
    }

    suggestedStart = Math.max(0, Math.min(suggestedStart, docLen));
    suggestedEnd = Math.max(0, Math.min(suggestedEnd, docLen));
    if (suggestedEnd <= suggestedStart) {
      suggestedStart = windowStart;
      suggestedEnd = windowEnd;
    }
    if (!coverageOk(suggestedStart, suggestedEnd, "fallback")) return null;
    return {
      startOffset: suggestedStart,
      endOffset: suggestedEnd,
      origin: "error",
      loop: true,
      suggestedMethod: "fallback",
    };
  }

  const prev = base.start > 0 ? findMeasureRangeAt(src, base.start - 1) : null;
  const next = base.end < docLen ? findMeasureRangeAt(src, base.end + 1) : null;

  const startOffset = Math.min(prev ? prev.start : base.start, base.start);
  const endOffset = Math.max(next ? next.end : base.end, base.end);
  if (!coverageOk(startOffset, endOffset, "measure")) return null;
  return {
    startOffset,
    endOffset,
    origin: "error",
    loop: true,
    suggestedMethod: "measure",
  };
}

function applyPlaybackRangeFromError(errItem) {
  try {
    if (!errorsEnabled) return;
    if (isPlaying) return;
    const suggested = suggestPlaybackRangeForRhythmError(errItem);
    if (!suggested) return;
    lastRhythmErrorSuggestion = {
      at: new Date().toISOString(),
      tuneId: errItem && errItem.tuneId ? errItem.tuneId : null,
      filePath: errItem && errItem.filePath ? errItem.filePath : null,
      message: errItem && errItem.message ? errItem.message : null,
      errorStartOffset: errItem && Number.isFinite(errItem.errorStartOffset) ? errItem.errorStartOffset : null,
      errorEndOffset: errItem && Number.isFinite(errItem.errorEndOffset) ? errItem.errorEndOffset : null,
      startOffset: suggested.startOffset,
      endOffset: suggested.endOffset,
      origin: "error",
      loop: true,
      suggestedMethod: suggested.suggestedMethod || null,
    };
    setPlaybackRange({
      startOffset: suggested.startOffset,
      endOffset: suggested.endOffset,
      origin: "error",
      loop: true,
    });
    suppressPlaybackRangeSelectionSync = true;
    setEditorSelectionAt(suggested.startOffset);
  } catch (e) {
    console.error("[abcarus] Failed to apply PlaybackRange from error:", (e && e.message) ? e.message : String(e));
  } finally {
    suppressPlaybackRangeSelectionSync = false;
  }
}

function renderToolStatus() {
  if (!$toolStatus) return;
  const warnings = [];
  const details = [];
  if (toolHealth) {
    const entries = [
      ["abc2xml", "abc2xml"],
      ["xml2abc", "xml2abc"],
      ["midi2xml", "midi2xml"],
      ["midi2abc", "midi2abc"],
      ["python", "Python"],
    ];
    for (const [key, label] of entries) {
      const info = toolHealth[key];
      if (!info || info.ok) continue;
      const msg = info.error || info.detail || "Unavailable";
      warnings.push(label);
      details.push(`${label}: ${msg}`);
    }
  }

  let text = "";
  let title = "";
  let shouldWarn = false;

  if (toolHealthError) {
    text = "Tool check failed";
    title = toolHealthError;
    shouldWarn = true;
  } else if (warnings.length) {
    text = `Missing tools: ${warnings.join(", ")}`;
    title = details.join("\n");
    shouldWarn = true;
  }

  if (!shouldWarn) {
    $toolStatus.textContent = "";
    $toolStatus.title = "";
    $toolStatus.classList.remove("warn");
    $toolStatus.style.display = "none";
    return;
  }

  $toolStatus.textContent = text;
  $toolStatus.title = title;
  $toolStatus.classList.add("warn");
  $toolStatus.style.display = "";
  if (warnings.length && !toolWarningShown) {
    showToast(text);
    toolWarningShown = true;
  }
}

async function checkExternalTools() {
  if (!window.api || typeof window.api.checkConversionTools !== "function") return;
  try {
    const res = await window.api.checkConversionTools();
    if (!res) {
      toolHealthError = "Tool check failed.";
      toolHealth = null;
      renderToolStatus();
      return;
    }
    if (!res.ok) {
      toolHealthError = res.error || "Tool check failed.";
      toolHealth = null;
      renderToolStatus();
      return;
    }
    toolHealthError = "";
    toolHealth = res.tools || null;
  } catch (e) {
    toolHealth = null;
    toolHealthError = (e && e.message) ? e.message : String(e);
  }
  renderToolStatus();
}

function setScanErrorButtonState(isScanning) {
  if (!$scanErrorTunes) return;
  $scanErrorTunes.disabled = Boolean(isScanning);
}

function applyLibrarySearch(value) {
  libraryTextFilter = String(value || "").trim();
  scheduleRenderLibraryTree();
  updateLibraryStatus();
}

function scheduleLibrarySearch(value) {
  pendingLibrarySearch = value;
  if (librarySearchTimer) clearTimeout(librarySearchTimer);
  librarySearchTimer = setTimeout(() => {
    librarySearchTimer = null;
    applyLibrarySearch(pendingLibrarySearch);
  }, LIBRARY_SEARCH_DEBOUNCE_MS);
}

function setScanErrorButtonActive(isActive) {
  if (!$scanErrorTunes) return;
  const active = Boolean(isActive);
  $scanErrorTunes.classList.toggle("toggle-active", active);
  if ($fileTuneSelect) {
    $fileTuneSelect.classList.toggle("error-filter-active", active);
  }
}

function setScanErrorButtonVisibility(entry) {
  if (!$scanErrorTunes) return;
  const tuneCount = entry && Array.isArray(entry.tunes) ? entry.tunes.length : 0;
  const shouldShow = tuneCount > 1;
  $scanErrorTunes.style.display = shouldShow ? "" : "none";
  if (!shouldShow) {
    tuneErrorFilter = false;
    tuneErrorScanInFlight = false;
    setScanErrorButtonState(false);
    setScanErrorButtonActive(false);
  }
}

function setSoundfontStatus(text, autoClearMs) {
  setBufferStatus(text || "");
  if (soundfontStatusTimer) clearTimeout(soundfontStatusTimer);
  soundfontStatusTimer = null;
  if (text && autoClearMs) {
    soundfontStatusTimer = setTimeout(() => {
      setBufferStatus("");
      soundfontStatusTimer = null;
    }, autoClearMs);
  }
}

function setSoundfontCaption(text) {
  if (!$soundfontLabel) return;
  const next = text || "Soundfont:";
  $soundfontLabel.textContent = next;
  const isLoading = String(next).toLowerCase().includes("loading");
  $soundfontLabel.classList.toggle("loading", isLoading);
}

function toFileUrl(filePath) {
  const raw = String(filePath || "");
  if (!raw) return "";
  if (raw.startsWith("file://")) return raw;
  if (/^[a-zA-Z]:\\/.test(raw)) {
    return `file:///${raw.replace(/\\/g, "/")}`;
  }
  if (raw.startsWith("/")) return new URL(raw, window.location.href).href;
  return raw;
}

async function updateSoundfontLoadingStatus(name) {
  if (soundfontLoadTarget !== name) return;
  setSoundfontCaption("Loading...");
}

let lastCursorStatus = null;

function setCursorStatus(line, col, offset, totalLines, totalChars) {
  if (!$cursorStatus) return;
  lastCursorStatus = { line, col, offset, totalLines, totalChars };
  const base = `Ln ${line}/${totalLines}, Col ${col}  •  Ch ${offset}/${totalChars}`;
  $cursorStatus.textContent = base;
  $cursorStatus.title = base;
}

function refreshCursorStatus() {
  if (!lastCursorStatus) return;
  const { line, col, offset, totalLines, totalChars } = lastCursorStatus;
  setCursorStatus(line, col, offset, totalLines, totalChars);
}

function applyTransformedText(text, options = {}) {
  if (!currentDoc) currentDoc = createBlankDocument();
  if (options.resetTransposePreview !== false) resetTransposePreviewState();
  let nextText = text || "";
  nextText = chordProFeature.applyTransformedText(nextText);
  suppressDirty = true;
  setEditorValue(nextText);
  suppressDirty = false;
  currentDoc.content = nextText;
  currentDoc.dirty = true;
  if (chordProFeature.isEnabled()) {
    scheduleWorkingCopyFullSync();
  }
  scheduleRenderNow({ clearOutput: true });
}

const BAR_SEP_SYMBOLS = [
  "|:::",
  ":::|",
  ":::",
  ":|][|:",
  ":|[2",
  ":|]2",
  ":||:",
  "[|]",
  ":|]",
  "[|:",
  ":||",
  "||:",
  ":|:",
  "|::",
  "::|",
  "|[1",
  ":|2",
  "|]",
  "||",
  "[|",
  "::",
  ".|",
  "|1",
  "|:",
  ":|",
  "[1",
  "[2",
  "|",
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BAR_SEP = new RegExp(
  `(${BAR_SEP_SYMBOLS.map((s) => `\\s*${escapeRegExp(s)}\\s*`).join("|")})`
);
const BAR_SEP_NO_SPACE = new RegExp(
  `(${BAR_SEP_SYMBOLS.map((s) => escapeRegExp(s)).join("|")})`
);

function splitLineIntoParts(line) {
  const parts = line.split(BAR_SEP).filter((p) => p);
  return parts;
}

function removeNonNoteFragments(abc) {
  let out = String(abc || "");
  out = out.replace(/^%.*$/gm, "");
  out = out.replace(/\[\w:.*?\]/g, "");
  out = out.replace(/\\"/g, "");
  out = out.replace(/".*?"/g, "");
  out = out.replace(/\{.*?\}/g, "");
  out = out.replace(/!.+?!/g, "");
  out = out.replace(/\+.+?\+/g, "");
  return out;
}

function replaceChordsByFirstNote(abc) {
  const cleaned = removeNonNoteFragments(abc);
  const notePattern = /([_=^]?[A-Ga-gxz](,+|'+)?)(\d{0,2}\/\d{1,2}|\/+|\d{0,2})([><]?)/;
  return cleaned.replace(/\[.*?\]/g, (m) => {
    const match = m.match(notePattern);
    return match ? match[0] : "";
  });
}

function getDefaultLen(abc) {
  if (/^L:\s*mcm_default/m.test(abc)) return "mcm_default";
  const match = abc.match(/^L:\s*(\d+)\/(\d+)/m);
  if (match) return Number(match[1]) / Number(match[2]);
  return 1 / 8;
}

function getMetre(abc) {
  const match = abc.match(/^M:\s*(\d+)\/(\d+)/m);
  if (match) return Number(match[1]) / Number(match[2]);
  return 1;
}

function getBarLengthCore(abc, defaultLength, metre) {
  let body = removeNonNoteFragments(abc);
  body = replaceChordsByFirstNote(body);
  const notePattern = /([_=^]?[A-Ga-gxz](,+|'+)?)(\d{0,3}(?:\/\d{0,3})*)(\.*)([><]?)/g;
  const tupletPattern = /\(([1-9])(?::([1-9]?))?(?::([1-9]?))?/g;
  let total = 0;
  let lastBroken = "";
  let tupletNotesLeft = 0;
  let tupletNotes = 0;
  let tupletTime = 2;

  const tokens = [];
  let match;
  while ((match = notePattern.exec(body)) !== null) {
    tokens.push({ type: "note", match });
  }
  notePattern.lastIndex = 0;
  while ((match = tupletPattern.exec(body)) !== null) {
    tokens.push({ type: "tuplet", match });
  }
  tokens.sort((a, b) => a.match.index - b.match.index);

  for (const token of tokens) {
    if (token.type === "tuplet") {
      tupletNotes = Number(token.match[1]);
      const q = token.match[2] ? Number(token.match[2]) : null;
      if (q) {
        tupletTime = q;
      } else if (tupletNotes === 3 || tupletNotes === 6) {
        tupletTime = 2;
      } else if (tupletNotes === 2 || tupletNotes === 4 || tupletNotes === 8) {
        tupletTime = 3;
      } else {
        tupletTime = (metre * 1) % 1 === 0 ? 2 : 3;
      }
      tupletNotesLeft = token.match[3] ? Number(token.match[3]) : tupletNotes;
      continue;
    }

    const lengthStr = token.match[3] || "";
    const dots = token.match[4] || "";
    const broken = token.match[5] || "";
    let mult = 1;

    if (defaultLength === "mcm_default") {
      const base = lengthStr.split("/")[0] || "1";
      mult = 1 / Number(base);
      for (let i = 0; i < dots.length; i += 1) mult *= 1.5;
      total += mult;
      continue;
    }

    if (broken === ">" || lastBroken === "<") mult = 1.5;
    else if (broken === "<" || lastBroken === ">") mult = 0.5;
    lastBroken = broken;

    const dividend = lengthStr.split("/")[0];
    if (dividend) mult *= Number(dividend);
    const divMatches = lengthStr.match(/\/(\d*)/g) || [];
    for (const divMatch of divMatches) {
      const num = divMatch.slice(1);
      mult /= num ? Number(num) : 2;
    }

    if (tupletNotesLeft) {
      mult *= tupletTime / tupletNotes;
      tupletNotesLeft -= 1;
    }
    total += mult * defaultLength;
  }
  return total;
}

function getBarLength(abc, defaultLength, metre) {
  const text = String(abc || "");
  // `&` creates overlays (parallel strands) inside a bar. For bar-length checks we must
  // compare strand durations and use the longest one, not sum all strands serially.
  if (text.includes("&")) {
    const layers = text.split("&").map((s) => s.trim()).filter(Boolean);
    if (layers.length > 1) {
      let maxLen = 0;
      for (const layer of layers) {
        const len = getBarLengthCore(layer, defaultLength, metre);
        if (Number.isFinite(len) && len > maxLen) maxLen = len;
      }
      return maxLen;
    }
  }
  return getBarLengthCore(text, defaultLength, metre);
}

function isLikelyAnacrusis(bar, defaultLength, metre) {
  if (!bar || BAR_SEP_NO_SPACE.test(bar)) return false;
  const actual = getBarLength(bar, defaultLength, metre);
  return actual <= metre * 0.8;
}

function formatMetreFromText(abcText) {
  const text = String(abcText || "");
  const match = text.match(/^M:\s*([0-9]+)\s*\/\s*([0-9]+)\s*$/m);
  if (!match) return "";
  return `${match[1]}/${match[2]}`;
}

function detectMeterMismatchInBarlines(abcText) {
  const text = String(abcText || "");
  const metreText = formatMetreFromText(text) || "";
  if (!metreText) return null;
  const metre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(metre) || metre <= 0) return null;
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return null;

  const lines = text.split(/\r\n|\n|\r/);
  let metreLoc = null;
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const match = rawLine.match(/^(\s*)M:\s*([0-9]+)\s*\/\s*([0-9]+)/);
    if (!match) continue;
    const found = `${match[2]}/${match[3]}`;
    if (found !== metreText) continue;
    metreLoc = { line: i + 1, col: (match[1] ? match[1].length : 0) + 1 };
    break;
  }
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  const bars = [];

  const flushBar = () => {
    const trimmed = buffer.trim();
    buffer = "";
    if (trimmed) bars.push(trimmed);
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    // Skip directives/fields/lyrics/comments.
    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    // Strip inline comment.
    let line = rawLine;
    const idx = line.indexOf("%");
    if (idx >= 0) line = line.slice(0, idx);

    const parts = splitLineIntoParts(line);
    for (const part of parts) {
      const p = String(part || "");
      if (BAR_SEP_NO_SPACE.test(p.trim())) {
        flushBar();
        continue;
      }
      buffer += ` ${p}`;
    }
  }
  flushBar();

  const usable = [];
  for (const bar of bars) {
    const len = getBarLength(bar, defaultLen, metre);
    if (!Number.isFinite(len) || len <= 0) continue;
    usable.push({ bar, len });
  }
  if (usable.length < 6) return null;
  if (isLikelyAnacrusis(usable[0].bar, defaultLen, metre)) usable.shift();
  if (usable.length < 6) return null;

  const counts = new Map(); // multiple -> count
  const tol = 0.12;
  for (const item of usable) {
    const ratio = item.len / metre;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const rounded = Math.round(ratio);
    if (rounded < 2 || rounded > 8) continue;
    if (Math.abs(ratio - rounded) > tol) continue;
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }
  if (!counts.size) return null;

  let best = { multiple: 0, count: 0 };
  for (const [multiple, count] of counts.entries()) {
    if (count > best.count) best = { multiple, count };
  }
  const total = usable.length;
  if (best.count < Math.max(4, Math.ceil(total * 0.6))) return null;

  const hint = metreText
    ? `Bars look ~${best.multiple}× longer than M:${metreText}`
    : `Bars look ~${best.multiple}× longer than the meter`;
  return {
    kind: "meter-mismatch",
    detail: `${hint}. Consider updating M: or adding barlines.`,
    multiple: best.multiple,
    barCount: total,
    matchCount: best.count,
    metre: metreText || null,
    loc: metreLoc,
  };
}

function detectRepeatMarkerAfterShortBar(abcText) {
  const text = String(abcText || "");
  const headerMetreText = formatMetreFromText(text) || "";
  if (!headerMetreText) return null;
  const headerMetre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(headerMetre) || headerMetre <= 0) return null;
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return null;

  let currentMetre = headerMetre;
  let currentMetreText = headerMetreText;

  const lines = text.split(/\r\n|\n|\r/);
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  let lastStartToken = null;
  let lastTokenLoc = null;

  const flushBar = (endToken, endLoc) => {
    const bar = buffer.trim();
    buffer = "";
    if (!bar) return null;
    const len = getBarLength(bar, defaultLen, currentMetre);
    if (!Number.isFinite(len) || len <= 0) return null;
    const ratio = len / currentMetre;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const isFullBar = Math.abs(ratio - 1) <= 0.15;
    if (isFullBar) return null;

    const token = String(endToken || "").trim();
    if (!token.includes(":")) return null;

    const isStartRepeatToken = token.includes("|:") || token.endsWith(":");
    const isEndRepeatToken = token.startsWith(":|") || token.includes(":|");
    // Treat a short bar immediately before a repeat marker as a valid incomplete bar:
    // - before start-repeat: pickup/anacrusis (e.g. "|:" / "::" / ":|:")
    // - before end-repeat: shortened closing bar (often balances an initial pickup)
    if ((isStartRepeatToken || isEndRepeatToken) && ratio <= 0.8) return null;

    const ratioText = ratio.toFixed(2).replace(/\.?0+$/, "");
    return {
      kind: "repeat-short-bar",
      detail: `Repeat marker "${token}" follows a bar of ~${ratioText}× length under M:${currentMetreText}. Consider fixing bar lengths or changing M: locally.`,
      metre: currentMetreText,
      ratio,
      token,
      startToken: lastStartToken || null,
      loc: endLoc || lastTokenLoc || null,
    };
  };

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const rawLine = lines[lineNo];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;
    // Allow meter changes in the tune body.
    const bodyMeterMatch = trimmed.match(/^M:\s*(\d+)\s*\/\s*(\d+)/i);
    if (bodyMeterMatch) {
      const num = Number(bodyMeterMatch[1]);
      const den = Number(bodyMeterMatch[2]);
      if (Number.isFinite(num) && Number.isFinite(den) && num > 0 && den > 0) {
        currentMetre = num / den;
        currentMetreText = `${bodyMeterMatch[1]}/${bodyMeterMatch[2]}`;
      }
      continue;
    }
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    let line = rawLine;
    const commentIdx = line.indexOf("%");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);

    const parts = splitLineIntoParts(line);
    let cursor = 0;
    for (const part of parts) {
      const p = String(part || "");
      const pos = line.indexOf(p, cursor);
      const start = pos >= 0 ? pos : cursor;
      cursor = start + p.length;

      const token = p.trim();
      if (BAR_SEP_NO_SPACE.test(token)) {
        const loc = { line: lineNo + 1, col: start + 1 };
        if (!buffer.trim()) {
          lastStartToken = token;
          lastTokenLoc = loc;
          continue;
        }
        const warn = flushBar(token, loc);
        lastStartToken = token;
        lastTokenLoc = loc;
        if (warn) return warn;
        continue;
      }

      // Track inline meter changes like [M:6/8] in-order (can appear after barlines on the same line).
      const inlineMeterRe = /\[\s*M:\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let mm;
      while ((mm = inlineMeterRe.exec(p)) !== null) {
        const num = Number(mm[1]);
        const den = Number(mm[2]);
        if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) continue;
        currentMetre = num / den;
        currentMetreText = `${mm[1]}/${mm[2]}`;
      }
      buffer += ` ${p}`;
    }
  }

  return null;
}

function gcdInt(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  if (!x) return y || 1;
  if (!y) return x || 1;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function formatBarDelta(deltaUnits, metreDen) {
  const denBase = Math.max(1, Math.round(Number(metreDen) || 8));
  const scaledDen = denBase * 4;
  const scaledNum = Math.round(Number(deltaUnits) * 4);
  if (!Number.isFinite(scaledNum) || scaledNum === 0) return { text: "", approx: 0 };
  const g = gcdInt(scaledNum, scaledDen);
  const num = scaledNum / g;
  const den = scaledDen / g;
  const sign = num > 0 ? "+" : "−";
  const absNum = Math.abs(num);
  return { text: `${sign}${absNum}/${den}`, approx: num / den };
}

function computeLineStartOffsets(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const offsets = [];
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    offsets.push(cursor);
    cursor += lines[i].length + 1;
  }
  return offsets;
}

function analyzeBarMismatchesForGutter(abcText) {
  const text = String(abcText || "");
  const metreText = formatMetreFromText(text) || "";
  const metreMatch = metreText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!metreMatch) return [];
  const metre = getMetre(text);
  const defaultLen = getDefaultLen(text);
  if (!Number.isFinite(metre) || metre <= 0) return [];
  if (!Number.isFinite(defaultLen) && defaultLen !== "mcm_default") return [];

  let currentMetre = metre;
  let currentDefaultLen = defaultLen;
  let currentMetreText = metreText;
  let currentDen = Number(metreMatch[2]) || 8;
  const metreUnit = () => 1 / Math.max(1, currentDen);
  const unitTol = 0.2; // ~1/5 of a metre unit before we warn

  const lines = text.split(/\r\n|\n|\r/);
  const lineStarts = computeLineStartOffsets(text);
  let inTextBlock = false;
  let inBody = false;
  let buffer = "";
  let barNumber = 0;
  const markers = [];
  const barEntries = [];
  let currentVoice = "";
  let firstVoice = "";
  let referenceVoice = "";
  let referenceBarNumber = 0;

  const setVoice = (voiceIdRaw) => {
    const voiceId = String(voiceIdRaw || "").trim().split(/\s+/)[0];
    if (!voiceId) return;
    currentVoice = voiceId;
    if (!firstVoice) firstVoice = voiceId;
    if (voiceId === "1") referenceVoice = "1";
    else if (!referenceVoice) referenceVoice = voiceId;
  };

  const updateMetre = (num, den) => {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || n <= 0 || d <= 0) return;
    currentMetre = n / d;
    currentMetreText = `${num}/${den}`;
    currentDen = d;
  };

  const parseDefaultLenValue = (raw) => {
    const token = String(raw || "").trim();
    if (!token) return null;
    if (/^mcm_default$/i.test(token)) return "mcm_default";
    const m = token.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return null;
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
    return num / den;
  };

  const updateDefaultLen = (raw) => {
    const parsed = parseDefaultLenValue(raw);
    if (parsed == null) return;
    currentDefaultLen = parsed;
  };

  const flushBar = (endToken, endOffset, endLen, lineNo, colNo) => {
    const bar = buffer.trim();
    buffer = "";
    if (!bar) return;
    const len = getBarLength(bar, currentDefaultLen, currentMetre);
    if (!Number.isFinite(len) || len <= 0) return;
    barNumber += 1;
    const unit = metreUnit();
    const delta = len - currentMetre;
    const deltaUnits = delta / unit;
    let displayBarNumber = barNumber;
    if (referenceVoice) {
      if (currentVoice === referenceVoice) referenceBarNumber += 1;
      if (referenceBarNumber > 0) displayBarNumber = referenceBarNumber;
    } else {
      if (!currentVoice) setVoice("1");
      referenceVoice = referenceVoice || currentVoice || firstVoice || "1";
      referenceBarNumber += 1;
      displayBarNumber = referenceBarNumber;
    }
    if (!Number.isFinite(deltaUnits)) return;
    barEntries.push({
      bar,
      barNumber,
      displayBarNumber,
      voiceId: currentVoice || referenceVoice || firstVoice || "",
      len,
      deltaUnits,
      unit,
      metre: currentMetre,
      metreText: currentMetreText,
      den: currentDen,
      endToken,
      endOffset,
      endLen,
      lineNo,
      colNo,
    });
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed)) inBody = true;
      continue;
    }

    if (!trimmed) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^\s*%%/.test(rawLine)) continue;

    if (/^\s*V:/.test(rawLine)) {
      setVoice(trimmed.slice(2));
      continue;
    }

    const bodyMeterMatch = trimmed.match(/^M:\s*(\d+)\s*\/\s*(\d+)/i);
    if (bodyMeterMatch) {
      updateMetre(bodyMeterMatch[1], bodyMeterMatch[2]);
      continue;
    }
    const bodyLenMatch = trimmed.match(/^L:\s*([^\s%]+)/i);
    if (bodyLenMatch) {
      updateDefaultLen(bodyLenMatch[1]);
      continue;
    }
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;

    let line = rawLine;
    const commentIdx = line.indexOf("%");
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    if (!line.trim()) continue;

    const parts = splitLineIntoParts(line);
    let cursor = 0;
    for (const part of parts) {
      const p = String(part || "");
      const pos = line.indexOf(p, cursor);
      const start = pos >= 0 ? pos : cursor;
      cursor = start + p.length;

      const token = p.trim();
      if (BAR_SEP_NO_SPACE.test(token)) {
        const endOffset = (lineStarts[lineIndex] || 0) + start;
        flushBar(token, endOffset, p.length, lineIndex + 1, start + 1);
        continue;
      }

      const inlineMeterRe = /\[\s*M:\s*(\d+)\s*\/\s*(\d+)\s*\]/gi;
      let mm;
      while ((mm = inlineMeterRe.exec(p)) !== null) {
        updateMetre(mm[1], mm[2]);
      }
      const inlineLenRe = /\[\s*L:\s*([^\]]+)\]/gi;
      let ll;
      while ((ll = inlineLenRe.exec(p)) !== null) {
        updateDefaultLen(ll[1]);
      }
      buffer += ` ${p}`;
    }
  }

  if (!barEntries.length) return markers;

  const allowed = new Set();
  const first = barEntries[0];
  if (first && first.deltaUnits < -unitTol && isLikelyAnacrusis(first.bar, defaultLen, first.metre)) {
    allowed.add(0);
  }
  const lastIdx = barEntries.length - 1;
  const last = barEntries[lastIdx];
  if (last && last.deltaUnits < -unitTol) {
    allowed.add(lastIdx);
  }

  for (let i = 0; i < barEntries.length - 1; i += 1) {
    if (allowed.has(i) || allowed.has(i + 1)) continue;
    const a = barEntries[i];
    const b = barEntries[i + 1];
    if (!a || !b) continue;
    if (a.deltaUnits >= -unitTol || b.deltaUnits >= -unitTol) continue;
    if (a.metreText !== b.metreText || a.den !== b.den) continue;
    const sumDeltaUnits = (a.len + b.len - a.metre) / a.unit;
    if (!Number.isFinite(sumDeltaUnits)) continue;
    if (Math.abs(sumDeltaUnits) <= unitTol) {
      allowed.add(i);
      allowed.add(i + 1);
    }
  }

  for (let i = 0; i < barEntries.length; i += 1) {
    if (allowed.has(i)) continue;
    const entry = barEntries[i];
    if (!entry || Math.abs(entry.deltaUnits) <= unitTol) continue;
    const deltaFmt = formatBarDelta(entry.deltaUnits, entry.den);
    if (!deltaFmt.text) continue;
    const ratio = entry.len / entry.metre;
    const ratioText = Number.isFinite(ratio) ? ratio.toFixed(2).replace(/\.?0+$/, "") : "?";
    const barNo = entry.displayBarNumber || entry.barNumber;
    const voicePrefix = (entry.voiceId && referenceVoice && entry.voiceId !== referenceVoice)
      ? `V:${entry.voiceId} · `
      : "";
    const detail = `${voicePrefix}Bar ${barNo}: ${deltaFmt.text} under M:${entry.metreText} (≈${ratioText}×)`;
    const label = `#${barNo} ${deltaFmt.text}`;
    markers.push({
      offset: entry.endOffset,
      len: Math.max(1, entry.endLen || 1),
      barNumber: barNo,
      label,
      deltaText: deltaFmt.text,
      detail,
      line: entry.lineNo,
      col: entry.colNo,
      token: String(entry.endToken || "").trim() || "|",
      voiceId: entry.voiceId || "",
      referenceVoice: referenceVoice || "",
    });
  }

  return markers;
}

function alignBeams(bars) {
  if (!bars || !bars.length) return bars || [];
  const barParts = bars.map((b) => b.split(/ +/));
  const lengths = barParts.map((p) => p.length);
  const numParts = lengths.length ? Math.min(...lengths) : 0;
  if (!Number.isFinite(numParts) || numParts <= 0) return bars;
  for (let i = 0; i < numParts; i += 1) {
    const parts = barParts.map((p) => p[i] || "");
    const maxLen = Math.max(...parts.map((p) => p.length));
    for (let lineNo = 0; lineNo < barParts.length; lineNo += 1) {
      barParts[lineNo][i] = (barParts[lineNo][i] || "").padEnd(maxLen, " ");
    }
  }
  return barParts.map((p) => p.join(" "));
}

function alignBars(bars, alignInsideBarsToo) {
  let aligned = bars.slice();
  if (BAR_SEP_NO_SPACE.test(bars[0])) {
    aligned = aligned.map((b) => ` ${b.trim()} `);
  } else if (alignInsideBarsToo) {
    aligned = alignBeams(aligned);
  }
  const maxLen = Math.max(...aligned.map((b) => b.length));
  return aligned.map((b) => b.padEnd(maxLen, " "));
}

function alignBarSeparators(barSeps) {
  let bars = barSeps.map((b) => ` ${b.trim()} `);
  const useRjust = bars.some((b) => b.includes(":|"));
  if (bars.some((b) => b.includes("|"))) {
    const maxPos = Math.max(...bars.map((b) => b.lastIndexOf("|")));
    bars = bars.map((b) => {
      const p = b.lastIndexOf("|");
      if (p >= 0 && p < maxPos) return " ".repeat(maxPos - p) + b;
      return b;
    });
    const maxLen = Math.max(...bars.map((b) => b.length));
    return bars.map((b) => b.padEnd(maxLen, " "));
  }
  const maxLen = Math.max(...bars.map((b) => b.length));
  return useRjust ? bars.map((b) => b.padStart(maxLen, " ")) : bars.map((b) => b.padEnd(maxLen, " "));
}

function alignLines(wholeAbc, lines, alignInsideBarsToo) {
  const n = lines.length;
  if (!n) return lines;
  const lineParts = lines.map((line) => splitLineIntoParts(line.trim()));
  const lengths = lineParts.map((lp) => lp.length);
  const maxLen = lengths.length ? Math.max(...lengths) : 0;
  const numBars = maxLen + 1;
  if (!Number.isFinite(numBars) || numBars <= 0) return lines;
  for (let lineNo = 0; lineNo < lineParts.length; lineNo += 1) {
    lineParts[lineNo].push("");
    if (lineParts[lineNo].length < numBars) {
      lineParts[lineNo].push(...Array(numBars - lineParts[lineNo].length).fill(""));
    }
  }

  const defaultLen = getDefaultLen(wholeAbc);
  const metre = getMetre(wholeAbc);
  let firstBarHandled = false;

  for (let i = 0; i < numBars; i += 1) {
    if (!firstBarHandled && lineParts.some((lp) => /[a-gA-Gxz]/.test(lp[i] || ""))) {
      firstBarHandled = true;
      const isAna = lineParts.map((lp) => isLikelyAnacrusis(lp[i], defaultLen, metre));
      if (isAna.some(Boolean) && !isAna.every(Boolean)) {
        for (let lineNo = 0; lineNo < n; lineNo += 1) {
          if (!isAna[lineNo]) lineParts[lineNo].splice(i, 0, "");
        }
      }
    }

    const anyIsBarSep = lineParts.some((lp) => BAR_SEP_NO_SPACE.test(lp[i] || ""));
    if (anyIsBarSep) {
      for (let lineNo = 0; lineNo < n; lineNo += 1) {
        if (!BAR_SEP_NO_SPACE.test(lineParts[lineNo][i] || "")) {
          lineParts[lineNo].splice(i, 0, "");
        }
      }
    }

    const bars = lineParts.map((lp) => lp[i]);
    const aligned = anyIsBarSep
      ? alignBarSeparators(bars)
      : alignBars(bars, alignInsideBarsToo);
    for (let lineNo = 0; lineNo < n; lineNo += 1) {
      lineParts[lineNo][i] = aligned[lineNo];
    }
  }

  let out = lineParts.map((parts) => parts.join(""));
  if (out.every((l) => l.startsWith(" "))) out = out.map((l) => l.slice(1));
  return out;
}

function getBarSeparatorColumns(line) {
  const parts = splitLineIntoParts(String(line || ""));
  const cols = [];
  let offset = 0;
  for (const part of parts) {
    const m = String(part || "").match(BAR_SEP_NO_SPACE);
    if (m) cols.push(offset + m.index);
    offset += String(part || "").length;
  }
  return cols;
}

function alignLyricLineToMusicLine(lyricLine, alignedMusicLine) {
  const m = String(lyricLine || "").match(/^(\s*w:\s*)([\s\S]*)$/);
  if (!m) return lyricLine;
  const prefix = m[1] || "";
  const body = m[2] || "";
  const parts = splitLineIntoParts(body);
  const lyricSepCount = parts.filter((p) => BAR_SEP_NO_SPACE.test(p || "")).length;
  const musicCols = getBarSeparatorColumns(alignedMusicLine);
  if (!lyricSepCount || !musicCols.length) return lyricLine;
  if (lyricSepCount < musicCols.length - 1 || lyricSepCount > musicCols.length) return lyricLine;
  const leadingSpaces = String(alignedMusicLine || "").match(/^\s*/)?.[0]?.length || 0;
  const firstMusicSepIsLeading = musicCols[0] === leadingSpaces
    && BAR_SEP_NO_SPACE.test(String(alignedMusicLine || "").slice(leadingSpaces));
  const musicColOffset = lyricSepCount === musicCols.length - 1 && firstMusicSepIsLeading ? 1 : 0;

  let out = prefix;
  let sepIndex = 0;
  for (const part of parts) {
    if (BAR_SEP_NO_SPACE.test(part || "")) {
      const target = musicCols[sepIndex + musicColOffset];
      if (!Number.isFinite(target)) return lyricLine;
      if (out.length < target) out += " ".repeat(target - out.length);
      else if (/\S$/.test(out)) out += " ";
      out += String(part || "").trim();
      if (/\s$/.test(String(part || "")) || sepIndex < lyricSepCount - 1) out += " ";
      sepIndex += 1;
    } else {
      out += part;
    }
  }
  return out;
}

function alignBarsInTune(lines, tuneText) {
  const out = lines.slice();
  let inText = false;
  let headerEnded = false;
  const groups = [];
  let candidates = [];
  const flushCandidates = () => {
    if (!candidates.length) return;
    groups.push(candidates);
    candidates = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^%%\s*begintext\b/i.test(line)) {
      flushCandidates();
      inText = true;
      continue;
    }
    if (/^%%\s*endtext\b/i.test(line)) {
      inText = false;
      continue;
    }
    if (!headerEnded) {
      if (/^\s*K:/.test(line)) headerEnded = true;
      continue;
    }
    if (inText) {
      flushCandidates();
      continue;
    }
    if (/^\s*w:/.test(line)) {
      continue;
    }
    if (
      /^\s*%/.test(line)
      || /^\s*[A-Za-z]:/.test(line)
      || !BAR_SEP_NO_SPACE.test(line)
    ) {
      flushCandidates();
      continue;
    }
    candidates.push({ idx: i, line });
  }
  flushCandidates();

  if (!groups.length) return out;
  for (const group of groups) {
    const aligned = alignLines(tuneText, group.map((c) => c.line), true);
    for (let i = 0; i < group.length; i += 1) {
      out[group[i].idx] = aligned[i];
      const lyricIdx = group[i].idx + 1;
      if (lyricIdx < out.length && /^\s*w:/.test(out[lyricIdx] || "")) {
        out[lyricIdx] = alignLyricLineToMusicLine(out[lyricIdx], aligned[i]);
      }
    }
  }
  return out;
}

function alignBarsInText(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let start = 0;

  const flushBlock = (blockLines, isTune) => {
    if (!blockLines.length) return;
    if (isTune) {
      const tuneText = blockLines.join("\n");
      out.push(...alignBarsInTune(blockLines, tuneText));
    } else {
      out.push(...blockLines);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*X:/.test(lines[i])) {
      flushBlock(lines.slice(start, i), false);
      start = i;
      i += 1;
      while (i < lines.length && !/^\s*X:/.test(lines[i])) i += 1;
      flushBlock(lines.slice(start, i), true);
      start = i;
      i -= 1;
    }
  }

  flushBlock(lines.slice(start), false);
  return out.join("\n");
}

function alignBarsInEditor() {
  const text = getEditorValue();
  if (!text.trim()) {
    setStatus("No notation to align.");
    return;
  }
  const aligned = alignBarsInText(text);
  if (aligned === text) {
    setStatus("Already aligned.");
    return;
  }
  applyTransformedText(aligned);
  setStatus("OK");
}

const errorEntries = [];
const errorEntryMap = new Map();
const libraryErrorIndex = new Map();
let lastNoteSelection = [];
let pendingCursorNoteHighlightRaf = null;
let pendingCursorNoteHighlightIdx = null;

function showErrorsVisible(visible) {
  // Errors are surfaced via the always-visible "Errors: N" indicator + popover.
  // Keep the legacy sidebar errors pane inactive to avoid duplicate UX.
  if ($sidebar) $sidebar.classList.remove("has-errors");
  if ($sidebarBody) $sidebarBody.classList.remove("errors-visible");
  void visible;
}

function clearErrors() {
  if (!errorsEnabled) {
    errorEntries.length = 0;
    errorEntryMap.clear();
    lastDrumMismatchErrorKey = null;
    lastDrumMismatchTuneId = null;
    if ($errorList) $errorList.textContent = "";
    showErrorsVisible(false);
    measureErrorRenderRanges = [];
    setMeasureErrorRanges([]);
    setScanErrors([]);
    return;
  }
  errorEntries.length = 0;
  errorEntryMap.clear();
  lastDrumMismatchErrorKey = null;
  lastDrumMismatchTuneId = null;
  if ($errorList) $errorList.textContent = "";
  showErrorsVisible(false);
  measureErrorRenderRanges = [];
  setMeasureErrorRanges([]);
  setScanErrors([]);
}

let contextMenu = null;
let contextMenuTarget = null;
let clipboardTune = null;

function initContextMenu() {
  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.setAttribute("role", "menu");
  document.body.appendChild(contextMenu);

  contextMenu.addEventListener("click", async (e) => {
    const target = e.target && e.target.closest ? e.target.closest(".context-menu-item") : null;
    if (!target || !target.dataset) return;
    if (target.classList && target.classList.contains("disabled")) return;
    const action = target.dataset.action;
    const menuTarget = contextMenuTarget;
    if (action === "noop") return;
    if (action === "loadFile" && menuTarget && menuTarget.type === "file") {
      hideContextMenu();
      await requestLoadLibraryFile(menuTarget.filePath);
      return;
    }
    if (action === "copyFilePath" && menuTarget && menuTarget.type === "file") {
      hideContextMenu();
      try {
        const text = String(menuTarget.filePath || "");
        if (text && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          showToast("Copied.");
        }
      } catch {}
      return;
    }
    if (action === "reloadFileFromDisk" && menuTarget && menuTarget.type === "file") {
      hideContextMenu();
      const p = String(menuTarget.filePath || "");
      if (!p) return;
      if (!isWorkingCopyOpenForFile(p)) {
        await showSaveError("This file is not open in the editor.");
        return;
      }
      const confirm = await confirmReloadFromDisk(p);
      if (!confirm) return;
      const restore = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
      const res = await discardAndReloadWorkingCopyFromDisk(p, { restoreTuneId: rawMode ? null : restore });
      if (!res || !res.ok) {
        await showSaveError((res && res.error) ? res.error : "Unable to reload from disk.");
        return;
      }
      showToast("Reloaded from disk.", 2000);
      return;
    }
    if (action === "deleteTune" && menuTarget && menuTarget.type === "tune") {
      await deleteTuneById(menuTarget.tuneId);
      hideContextMenu();
      return;
    }
    if (action === "copyTune" && menuTarget && menuTarget.type === "tune") {
      await copyTuneById(menuTarget.tuneId, "copy");
      hideContextMenu();
      return;
    }
    if (action === "duplicateTune" && menuTarget && menuTarget.type === "tune") {
      await duplicateTuneById(menuTarget.tuneId);
      hideContextMenu();
      return;
    }
    if (action === "cutTune" && menuTarget && menuTarget.type === "tune") {
      await copyTuneById(menuTarget.tuneId, "move");
      hideContextMenu();
      return;
    }
    if (action === "addToSetList" && menuTarget) {
      const tuneId = menuTarget.type === "tune"
        ? menuTarget.tuneId
        : (menuTarget.type === "editor" ? activeTuneId : null);
      hideContextMenu();
      try {
        await setListFeature.addTuneById(tuneId);
        showToast("Added to Set List.", 2000);
      } catch (e) {
        showToast(e && e.message ? e.message : String(e), 5000);
      }
      return;
    }
    if (action === "appendTuneToActiveFile" && menuTarget && menuTarget.type === "tune") {
      hideContextMenu();
      try {
        const targetPath = (activeTuneMeta && activeTuneMeta.path)
          ? String(activeTuneMeta.path)
          : "";
        if (!targetPath) {
          showToast("No active file to append to.", 2400);
          return;
        }
        if (rawMode) {
          showToast("Raw mode: switch to tune mode to append.", 2400);
          return;
        }
        if ((currentDoc && currentDoc.dirty) || headerDirty) {
          showToast("Save the active file first, then append.", 3200);
          return;
        }

        const res = findTuneById(menuTarget.tuneId);
        if (!res || !res.file || !res.file.path) {
          showToast("Tune not found.", 2400);
          return;
        }
        if (pathsEqual(res.file.path, targetPath)) {
          showToast("Tune is already in the active file.", 2600);
          return;
        }

        const tuneText = await getTuneText(res.tune, res.file);
        const label = (() => {
          const title = res.tune.title || res.tune.preview || "";
          const x = res.tune.xNumber ? `X:${res.tune.xNumber}` : "";
          return `${x} ${title}`.trim() || "Untitled";
        })();
        const confirm = (window.api && typeof window.api.confirmAppendToFileDetailed === "function")
          ? await window.api.confirmAppendToFileDetailed(targetPath, label)
          : await confirmAppendToFile(targetPath);
        if (confirm !== "append") return;

        await withFileLock(targetPath, async () => {
          if (
            window.api
            && typeof window.api.openWorkingCopy === "function"
            && typeof window.api.insertWorkingCopyTuneAfter === "function"
            && typeof window.api.commitWorkingCopyToDisk === "function"
          ) {
            await window.api.openWorkingCopy(targetPath);
            const snap = await refreshWorkingCopySnapshot();
            if (!snap || !snap.path || !pathsEqual(snap.path, targetPath)) {
              throw new Error("Unable to open working copy for appending.");
            }
            const nextX = getNextXNumber(String(snap.text || ""));
            const prepared = ensureXNumberInAbc(tuneText, nextX);
            const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;
            const ins = await window.api.insertWorkingCopyTuneAfter({ afterTuneIndex, text: prepared });
            if (!ins || !ins.ok) throw new Error((ins && ins.error) ? ins.error : "Unable to append.");
            let saved = await window.api.commitWorkingCopyToDisk({ force: false });
            if (!saved || !saved.ok) {
              if (saved && saved.conflict) {
                const forced = await window.api.commitWorkingCopyToDisk({ force: true });
                if (forced && forced.ok) {
                  markDiskConflictPath(targetPath, false);
                  saved = forced;
                } else {
                  markDiskConflictPath(targetPath, true);
                  throw new Error((forced && forced.error) ? forced.error : "Unable to save file.");
                }
              }
            }
            if (!saved || !saved.ok) {
              throw new Error((saved && saved.error) ? saved.error : "Unable to save file.");
            }
            const snapAfter = await refreshWorkingCopySnapshot();
            if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, targetPath)) {
              setFileContentInCache(targetPath, snapAfter.text);
              syncLibraryFileFromWorkingCopySnapshot(targetPath, snapAfter);
            }
            return;
          }
          await appendTuneTextToFileUnlocked(targetPath, tuneText);
        });

        const updatedFile = await refreshLibraryFile(targetPath, { force: true });
        activeFilePath = targetPath;
        if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
          const last = updatedFile.tunes[updatedFile.tunes.length - 1];
          if (last && last.id) await selectTune(last.tuneUid || last.id, { skipConfirm: true });
        }
        showToast("Appended.", 2000);
      } catch (e) {
        showToast(e && e.message ? e.message : String(e), 5000);
      }
      return;
    }
    if (action === "pasteTune" && menuTarget && menuTarget.type === "file") {
      await pasteClipboardToFile(menuTarget.filePath);
      hideContextMenu();
      return;
    }
    if (action === "findLibrary") {
      promptFindInLibrary();
      hideContextMenu();
      return;
    }
    if (action === "clearSearch") {
      libraryTextFilter = "";
      if ($librarySearch) $librarySearch.value = "";
      renderLibraryTree();
      updateLibraryStatus();
      hideContextMenu();
      return;
    }
    if (action === "refreshLibrary") {
      await refreshLibraryIndex();
      hideContextMenu();
      return;
    }
    if (action === "renameFile" && menuTarget && menuTarget.type === "file") {
      beginRenameFile(menuTarget.filePath);
      hideContextMenu();
      return;
    }
    if (action === "xIssues" && menuTarget && menuTarget.type === "file") {
      hideContextMenu();
      await xIssuesModalController.open(menuTarget.filePath);
      return;
    }
    if (action === "renumberXInFile" && menuTarget) {
      const filePath = menuTarget.type === "file"
        ? menuTarget.filePath
        : (menuTarget.type === "tune" && menuTarget.tuneId ? String(menuTarget.tuneId).split("::")[0] : null);
      if (filePath) {
        await renumberXInActiveFile(filePath);
      }
      hideContextMenu();
      return;
    }
    if (action === "moveTune" && menuTarget && menuTarget.type === "tune") {
      openMoveTuneModal(menuTarget.tuneId);
      hideContextMenu();
    }
    if (action === "editorCut" && menuTarget && menuTarget.type === "editor") {
      if (editorView) editorView.focus();
      document.execCommand("cut");
      hideContextMenu();
      return;
    }
    if (action === "editorCopy" && menuTarget && menuTarget.type === "editor") {
      if (editorView) editorView.focus();
      document.execCommand("copy");
      hideContextMenu();
      return;
    }
    if (action === "editorPaste" && menuTarget && menuTarget.type === "editor") {
      if (editorView) editorView.focus();
      document.execCommand("paste");
      hideContextMenu();
    }
    if (action === "templatesCopy" && menuTarget && menuTarget.type === "templatesPreview") {
      const text = (menuTarget.selectionText && String(menuTarget.selectionText))
        ? String(menuTarget.selectionText)
        : String(menuTarget.fullText || "");
      try {
        if (text) await navigator.clipboard.writeText(text);
        setStatus(text ? "Copied." : "Nothing to copy.");
      } catch (e) {
        logErr(e && e.message ? e.message : String(e));
        setStatus("Copy failed.");
      }
      hideContextMenu();
      return;
    }
    if (action === "templatesSelectAll" && menuTarget && menuTarget.type === "templatesPreview") {
      try {
        if ($templatesPreviewText) {
          const sel = window.getSelection ? window.getSelection() : null;
          const range = document.createRange();
          range.selectNodeContents($templatesPreviewText);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } catch {}
      hideContextMenu();
      return;
    }
  });

  document.addEventListener("click", (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) hideContextMenu();
  });
  window.addEventListener("blur", () => hideContextMenu());
}

function buildContextMenuItems(items) {
  contextMenu.textContent = "";
  for (const item of items) {
    if (item && item.separator) {
      const sep = document.createElement("div");
      sep.className = "context-menu-sep";
      sep.setAttribute("role", "separator");
      contextMenu.appendChild(sep);
      continue;
    }
    const row = document.createElement("div");
    row.className = "context-menu-item";
    row.textContent = item.label;
    row.dataset.action = item.action;
    if (item.danger) row.classList.add("danger");
    if (item.disabled) {
      row.classList.add("disabled");
    }
    row.setAttribute("role", "menuitem");
    contextMenu.appendChild(row);
  }
}

function hasUnsavedChangesForFile(filePath) {
  const p = String(filePath || "");
  if (!p) return false;
  const activePath = (activeTuneMeta && activeTuneMeta.path)
    ? String(activeTuneMeta.path)
    : (activeFilePath ? String(activeFilePath) : "");
  const activeDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
  if (activeDirty && activePath && pathsEqual(activePath, p)) return true;
  if (workingCopySnapshot && workingCopySnapshot.dirty && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, p)) return true;
  return false;
}

function getActiveEditFilePath() {
  if (activeTuneMeta && activeTuneMeta.path) return String(activeTuneMeta.path);
  if (activeFilePath) return String(activeFilePath);
  return "";
}

function hasGlobalUnsavedChanges() {
  return Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
}

function hasUnsavedChangesInActiveEditContext() {
  const activePath = getActiveEditFilePath();
  if (!activePath) return hasGlobalUnsavedChanges();
  return hasUnsavedChangesForFile(activePath);
}

async function requireCleanForFileOp(targetPath, actionLabel) {
  const p = String(targetPath || "");
  const label = String(actionLabel || "this action");
  const activePath = getActiveEditFilePath();
  if (!hasGlobalUnsavedChanges()) return true;
  if (activePath && p && !pathsEqual(activePath, p)) {
    await showSaveError(`Please Save/Discard your current changes before ${label}.`);
    return false;
  }
  await showSaveError(`${label} is disabled while the file has unsaved changes. Save/Discard first.`);
  return false;
}

function isWorkingCopyOpenForFile(filePath) {
  const p = String(filePath || "");
  if (!p) return false;
  return Boolean(workingCopySnapshot && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, p));
}

function splitFileIntoHeaderAndBody(fullText) {
  const text = String(fullText || "");
  const headerEnd = findHeaderEndOffset(text);
  const header = text.slice(0, headerEnd);
  const body = text.slice(headerEnd);
  return { headerText: header, bodyText: body };
}

function showContextMenuAt(x, y, target) {
  if (!contextMenu) initContextMenu();
  contextMenuTarget = target;
  if (target.type === "tune") {
    const targetPath = (activeTuneMeta && activeTuneMeta.path) ? String(activeTuneMeta.path) : "";
    const sourceRes = target && target.tuneId ? findTuneById(target.tuneId) : null;
    const sourcePath = sourceRes && sourceRes.file && sourceRes.file.path ? String(sourceRes.file.path) : "";
    const globalDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
    const sourceDirty = Boolean(sourcePath) && (globalDirty || hasUnsavedChangesForFile(sourcePath));
    const canAppend = Boolean(
      targetPath
      && sourcePath
      && !pathsEqual(targetPath, sourcePath)
      && !rawMode
      && !(currentDoc && currentDoc.dirty)
      && !headerDirty
      && !sourceDirty
    );
    const items = [{ label: "Add to Set List", action: "addToSetList" }];
    if (canAppend) items.push({ separator: true }, { label: "Append to Active File…", action: "appendTuneToActiveFile" });
    if (sourceDirty) {
      items.push({ separator: true }, { label: "Save/Discard changes to enable file actions", action: "noop", disabled: true });
    } else {
      items.push(
        { separator: true },
        { label: "Copy Tune", action: "copyTune" },
        { label: "Cut Tune", action: "cutTune" },
        { label: "Duplicate Tune", action: "duplicateTune" },
        { separator: true },
        { label: "Move to…", action: "moveTune" },
        { separator: true },
        { label: "Renumber X (File)…", action: "renumberXInFile" },
        { separator: true },
        { label: "Delete Tune…", action: "deleteTune", danger: true },
      );
    }
    buildContextMenuItems(items);
  } else if (target.type === "file") {
    const fileEntry = libraryIndex && Array.isArray(libraryIndex.files) && target.filePath
      ? libraryIndex.files.find((f) => pathsEqual(f.path, target.filePath))
      : null;
    const hasXIssues = Boolean(fileEntry && fileEntry.xIssues && fileEntry.xIssues.ok === false);
    const globalDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
    const fileDirty = Boolean(target.filePath) && (globalDirty || hasUnsavedChangesForFile(target.filePath));
    const items = [
      { label: "Load", action: "loadFile", disabled: !target.filePath },
      { label: "Copy Path", action: "copyFilePath", disabled: !target.filePath },
      { separator: true },
      { label: "Refresh Library", action: "refreshLibrary" },
    ];
    if (hasXIssues) items.push({ label: "X issues…", action: "xIssues" });
    if (
      target.filePath
      && isWorkingCopyOpenForFile(target.filePath)
      && hasDiskConflictPath(target.filePath)
    ) {
      items.push({ label: "Reload from disk…", action: "reloadFileFromDisk" });
    }
    if (fileDirty) {
      items.push({ separator: true }, { label: "Save/Discard changes to enable file actions", action: "noop", disabled: true });
    } else {
      items.push(
        { separator: true },
        { label: "Paste Tune", action: "pasteTune", disabled: !clipboardTune },
        { label: "Rename File…", action: "renameFile" },
        { label: "Renumber X…", action: "renumberXInFile", disabled: !target.filePath },
      );
    }
    buildContextMenuItems(items);
  } else if (target.type === "library") {
    buildContextMenuItems([
      { label: "Refresh Library", action: "refreshLibrary" },
      { label: "Clear Search", action: "clearSearch", disabled: !libraryTextFilter },
    ]);
  } else if (target.type === "editor") {
    const canAdd = Boolean(activeTuneId) && !rawMode;
    buildContextMenuItems([
      { label: "Add Active Tune to Set List", action: "addToSetList", disabled: !canAdd },
      { label: "Cut", action: "editorCut" },
      { label: "Copy", action: "editorCopy" },
      { label: "Paste", action: "editorPaste" },
    ]);
  } else if (target.type === "templatesPreview") {
    const hasText = Boolean(target && typeof target.fullText === "string" && target.fullText.length);
    const hasSelection = Boolean(target && typeof target.selectionText === "string" && target.selectionText.length);
    buildContextMenuItems([
      { label: "Copy", action: "templatesCopy", disabled: !hasText },
      { label: "Select All", action: "templatesSelectAll", disabled: !hasText },
      { separator: true },
      { label: hasSelection ? "Selection will be copied" : "No selection (copies all)", action: "noop", disabled: true },
    ]);
  }
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add("open");
  const rect = contextMenu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (rect.right > window.innerWidth) left = Math.max(8, x - rect.width);
  if (rect.bottom > window.innerHeight) top = Math.max(8, y - rect.height);
  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

function hideContextMenu() {
  if (!contextMenu) return;
  contextMenu.classList.remove("open");
  contextMenuTarget = null;
}

function buildRenameTargetPath(oldPath, inputName) {
  const trimmed = String(inputName || "").trim();
  if (!trimmed) return "";
  if (/[\\/]/.test(trimmed)) return "";
  let name = trimmed;
  if (!/\.[^.]+$/.test(name)) name += ".abc";
  const dir = safeDirname(oldPath);
  if (!dir) return "";
  return `${dir}/${name}`;
}

function beginRenameFile(filePath) {
  if (!filePath) return;
  const activePath = getActiveEditFilePath();
  if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, filePath)) {
    showToast("Save/Discard your current changes before renaming files.", 2600);
    return;
  }
  if (hasUnsavedChangesForFile(filePath)) {
    showToast("Save/Discard changes before renaming files.", 2600);
    return;
  }
  if (isWorkingCopyOpenForFile(filePath)) {
    showToast("Close the file in the editor before renaming it.", 2600);
    return;
  }
  renamingFilePath = filePath;
  renderLibraryTree();
  requestAnimationFrame(() => {
    const input = $libraryTree
      ? $libraryTree.querySelector(`input[data-file-path="${CSS.escape(filePath)}"]`)
      : null;
    if (input) {
      input.focus();
      input.select();
    }
  });
}

async function commitRenameFile(oldPath, inputName) {
  if (renameInFlight) return;
  if (!renamingFilePath || renamingFilePath !== oldPath) return;
  renameInFlight = true;
  try {
    const activePath = getActiveEditFilePath();
    if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, oldPath)) {
      await showSaveError("Refusing to rename: you have unsaved changes in another file. Save/Discard them and try again.");
      renamingFilePath = null;
      renderLibraryTree();
      return;
    }
    if (hasUnsavedChangesForFile(oldPath)) {
      await showSaveError("Refusing to rename: the file has unsaved changes. Save/Discard them and try again.");
      renamingFilePath = null;
      renderLibraryTree();
      return;
    }
    if (isWorkingCopyOpenForFile(oldPath)) {
      await showSaveError("Refusing to rename: the file is open in the editor. Close it and try again.");
      renamingFilePath = null;
      renderLibraryTree();
      return;
    }
    const newPath = buildRenameTargetPath(oldPath, inputName);
    if (!newPath) {
      renamingFilePath = null;
      renderLibraryTree();
      return;
    }
    if (newPath === oldPath) {
      renamingFilePath = null;
      renderLibraryTree();
      return;
    }
    await withFileLocks([oldPath, newPath], async () => {
      if (await fileExists(newPath)) {
        await showSaveError("A file with that name already exists.");
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      const res = await renameFile(oldPath, newPath);
      if (!res || !res.ok) {
        await showSaveError(res && res.error ? res.error : "Unable to rename file.");
        renamingFilePath = null;
        renderLibraryTree();
        return;
      }
      renamingFilePath = null;
      await renameLibraryFile(oldPath, newPath);
    });
  } finally {
    renameInFlight = false;
  }
}

function openMoveTuneModal(tuneId) {
  moveTuneModalController.open(tuneId, {
    files: libraryIndex && Array.isArray(libraryIndex.files) ? libraryIndex.files : [],
    activeFilePath,
  });
}

async function moveTuneToFile(tuneId, targetPath) {
  if (!tuneId || !targetPath) return;
  const res = findTuneById(tuneId);
  if (!res) return;
  if (pathsEqual(res.file.path, targetPath)) {
    await showSaveError("Target file is the same as source.");
    return;
  }
  try {
    const text = await getTuneText(res.tune, res.file);
    clipboardTune = {
      text,
      sourcePath: res.file.path,
      tuneId,
      mode: "move",
    };
    await pasteClipboardToFile(targetPath);
  } catch (e) {
    await showSaveError(e && e.message ? e.message : String(e));
  }
}

function parseErrorLocation(message) {
  const text = String(message);
  let match = text.match(/:(\d+):(\d+)/);
  if (match) {
    return { line: Number(match[1]), col: Number(match[2]) };
  }
  match = text.match(/line\s+(\d+)\s*[,;]?\s*col(?:umn)?\s+(\d+)/i);
  if (match) {
    return { line: Number(match[1]), col: Number(match[2]) };
  }
  return null;
}

function setErrorLineOffsetFromHeader(headerText) {
  if (!headerText || !String(headerText).trim()) {
    errorLineOffset = 0;
    return;
  }
  const trimmed = String(headerText).replace(/[\r\n]+$/, "");
  errorLineOffset = trimmed ? trimmed.split(/\r\n|\n|\r/).length : 0;
}

function applyMeasureHighlights(renderOffset) {
  if (!$out) return;
  const notes = $out.querySelectorAll(".note-hl, .bar-hl");
  for (const note of notes) note.classList.remove("measure-error");
  const useRenderRanges = measureErrorRenderRanges && measureErrorRenderRanges.length;
  if (!useRenderRanges && !measureErrorRanges.length) return;
  const ranges = useRenderRanges
    ? measureErrorRenderRanges
    : measureErrorRanges.map((range) => ({
      start: range.start + (renderOffset || 0),
      end: range.end + (renderOffset || 0),
    }));
  const barEls = Array.from($out.querySelectorAll(".bar-hl"));
  if (barEls.length) {
    for (const bar of barEls) {
      const start = Number(bar.dataset && bar.dataset.start);
      if (!Number.isFinite(start)) continue;
      const hit = ranges.some((range) => start >= range.start && start < range.end);
      if (hit) bar.classList.add("measure-error");
    }
    return;
  }
  const noteEls = Array.from($out.querySelectorAll(".note-hl"));
  for (const range of ranges) {
    let first = null;
    let last = null;
    for (const note of noteEls) {
      const start = Number(note.dataset && note.dataset.start);
      if (!Number.isFinite(start)) continue;
      if (start >= range.start && start < range.end) {
        if (!first) first = note;
        last = note;
      }
    }
    if (first) first.classList.add("measure-error");
    if (last && last !== first) last.classList.add("measure-error");
  }
}

function isMeasureCheckEnabled() {
  const text = getEditorValue();
  const match = String(text || "").match(/^M:\s*(.+)$/m);
  if (!match) return false;
  const value = String(match[1] || "").trim().toLowerCase();
  return value !== "none";
}

function injectCheckbarsDirective(text) {
  const src = String(text || "");
  if (!src.trim()) return src;
  if (/%%\s*checkbars\b/i.test(src)) return src;
  const lines = src.split(/\r\n|\n|\r/);
  const xIdx = lines.findIndex((line) => /^\s*X:/.test(line));
  const insertIdx = xIdx >= 0 ? xIdx : 0;
  lines.splice(insertIdx, 0, "%%checkbars 1");
  return lines.join("\n");
}

function getEditorIndexFromLoc(loc) {
  if (!editorView || !loc) return null;
  const line = Math.max(1, Math.min(loc.line, editorView.state.doc.lines));
  const lineInfo = editorView.state.doc.line(line);
  const col = Math.max(1, loc.col || 1);
  return Math.min(lineInfo.to, lineInfo.from + col - 1);
}

function getTextIndexFromLoc(text, loc) {
  if (!loc) return null;
  const lines = String(text || "").split(/\r\n|\n|\r/);
  if (!lines.length) return 0;
  const line = Math.max(1, Math.min(loc.line || 1, lines.length));
  const col = Math.max(1, loc.col || 1);
  let idx = 0;
  for (let i = 0; i < line - 1; i += 1) {
    idx += lines[i].length + 1;
  }
  idx += Math.min(col - 1, lines[line - 1].length);
  return idx;
}

function findMeasureRangeAt(text, pos) {
  const src = String(text || "");
  if (!src) return null;
  let idx = Math.max(0, Math.min(pos, Math.max(0, src.length - 1)));
  while (idx > 0) {
    const lineStart = Math.max(0, src.lastIndexOf("\n", idx - 1) + 1);
    const lineText = src.slice(lineStart, idx + 1);
    const trimmed = lineText.trim();
    if (!trimmed || trimmed.startsWith("%")) {
      idx = lineStart - 1;
      continue;
    }
    const commentIdx = src.indexOf("%", lineStart);
    if (commentIdx !== -1 && commentIdx <= idx && src[commentIdx - 1] !== "\\") {
      idx = commentIdx - 1;
      continue;
    }
    while (idx > lineStart && /[\s|:]/.test(src[idx])) idx -= 1;
    if (idx <= lineStart && /[\s|:]/.test(src[idx])) {
      idx = lineStart - 1;
      continue;
    }
    break;
  }
  idx = Math.max(0, idx);
  const start = src.lastIndexOf("|", Math.max(0, idx));
  const end = src.indexOf("|", Math.max(0, idx + 1));
  const rangeStart = start >= 0 ? start : 0;
  const rangeEnd = end >= 0 ? end + 1 : src.length;
  if (rangeEnd <= rangeStart) return null;
  return { start: rangeStart, end: rangeEnd };
}

function findMeasureStartOffsetByNumber(text, measureNumber) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };

  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let started = false;
  let currentMeasure = 1;
  let currentStart = null;

  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }
    if (isSkippableLine(rawLine)) continue;
    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      // First measure begins at the first non-space character of the first body line.
      const firstNonSpace = rawLine.search(/\S/);
      currentStart = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return currentStart;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;

      // Found a barline boundary. Next measure starts immediately after this boundary token sequence.
      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      currentStart = j;
      if (currentMeasure === target) return currentStart;

      // Skip the rest of the boundary token sequence to avoid double-counting "||", "|]", "|:", etc.
      i = j - 1;
    }
  }

  return null;
}

function findMeasureStartOffsetByNumberInPrimaryVoice(text, measureNumber) {
  const target = Number(measureNumber);
  if (!Number.isFinite(target) || target < 1) return null;
  const src = String(text || "");
  if (!src.trim()) return null;
  const len = src.length;

  const isSkippableLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("%")) return true;
    if (/^%%/.test(trimmed)) return true;
    if (/^[A-Za-z]:/.test(trimmed)) return true;
    return false;
  };
  const isBodyLine = (line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("%")) return false;
    if (/^%%/.test(trimmed)) return false;
    if (/^[A-Za-z]:/.test(trimmed)) return false;
    return true;
  };

  let inTextBlock = false;
  let inBody = false;
  let primaryVoice = null;
  let currentVoice = null;
  let started = false;
  let currentMeasure = 1;

  const lineStarts = [0];
  for (let i = 0; i < len; i += 1) {
    if (src[i] === "\n") lineStarts.push(i + 1);
  }
  lineStarts.push(len + 1);

  for (let li = 0; li < lineStarts.length - 1; li += 1) {
    const lineStart = lineStarts[li];
    const lineEnd = Math.min(len, lineStarts[li + 1] - 1);
    const rawLine = src.slice(lineStart, lineEnd);
    const trimmed = rawLine.trim();

    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;

    if (!inBody) {
      if (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(rawLine)) inBody = true;
      continue;
    }

    const voiceLine = rawLine.match(/^\s*V\s*:\s*(.*)$/i);
    if (voiceLine) {
      currentVoice = normalizeVoiceIdToken(voiceLine[1]) || "1";
      if (!primaryVoice) primaryVoice = currentVoice;
      continue;
    }

    const effectiveVoice = currentVoice || "1";
    if (!primaryVoice && isBodyLine(rawLine)) primaryVoice = effectiveVoice;
    if (primaryVoice && effectiveVoice !== primaryVoice) continue;
    if (isSkippableLine(rawLine)) continue;

    if (!started && !isBodyLine(rawLine)) continue;
    if (!started) {
      started = true;
      const firstNonSpace = rawLine.search(/\S/);
      const start = firstNonSpace >= 0 ? lineStart + firstNonSpace : lineStart;
      if (target === 1) return start;
    }

    let inQuote = false;
    let inComment = false;
    for (let i = lineStart; i < lineEnd; i += 1) {
      const ch = src[i];
      if (inComment) continue;
      if (ch === "%" && src[i - 1] !== "\\") { inComment = true; continue; }
      if (ch === "\"") { inQuote = !inQuote; continue; }
      if (inQuote) continue;
      if (ch !== "|") continue;

      let j = i + 1;
      while (j < lineEnd && /[:|\]\s]/.test(src[j])) j += 1;
      currentMeasure += 1;
      if (currentMeasure === target) return j;
      i = j - 1;
    }
  }
  return null;
}

let renderMeasureIndexCache = null; // { key, offset, istarts, anchor, byNumber }

function buildMeasureIstartsFromAbc2svg(firstSymbol) {
  const istarts = [];
  const pushUnique = (v) => {
    if (!Number.isFinite(v)) return;
    if (!istarts.length || istarts[istarts.length - 1] !== v) istarts.push(v);
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  let s = firstSymbol;
  let guard = 0;
  if (s && Number.isFinite(s.istart)) pushUnique(s.istart);
  while (s && guard < 200000) {
    if (isBarLikeSymbol(s) && s.ts_next && Number.isFinite(s.ts_next.istart)) {
      pushUnique(s.ts_next.istart);
    }
    s = s.ts_next;
    guard += 1;
  }
  const out = [];
  let last = null;
  for (const v of istarts.slice().sort((a, b) => a - b)) {
    if (!Number.isFinite(v)) continue;
    if (last == null || v !== last) out.push(v);
    last = v;
  }
  return out;
}

function buildMeasureStartsByNumberFromAbc2svg(firstSymbol) {
  const byNumber = new Map(); // number -> [istart...]
  const push = (targetMap, n, istart) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return;
    const start = Number(istart);
    if (!Number.isFinite(start)) return;
    const list = targetMap.get(num) || [];
    if (!list.length || list[list.length - 1] !== start) list.push(start);
    targetMap.set(num, list);
  };
  const normalizeMap = (targetMap) => {
    for (const [k, list] of targetMap.entries()) {
      const out = [];
      let last = null;
      for (const v of list.slice().sort((a, b) => a - b)) {
        if (!Number.isFinite(v)) continue;
        if (last == null || v !== last) out.push(v);
        last = v;
      }
      targetMap.set(k, out);
    }
  };
  const normalizeList = (list) => {
    const out = [];
    let last = null;
    for (const v of (Array.isArray(list) ? list : []).slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(v)) continue;
      if (last == null || v !== last) out.push(v);
      last = v;
    }
    return out;
  };
  const findNextAfter = (sorted, value) => {
    if (!Array.isArray(sorted) || !sorted.length) return null;
    const target = Number(value);
    if (!Number.isFinite(target)) return null;
    let lo = 0;
    let hi = sorted.length - 1;
    let best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = sorted[mid];
      if (v > target) {
        best = v;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return best;
  };
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));
  const genericByNumber = new Map();
  const voiceStarts = new Map(); // voiceId -> [istart...]
  const barlines = []; // { barNum, istart, voiceId }

  let s = firstSymbol;
  let guard = 0;
  let primaryVoiceId = null;
  while (s && guard < 200000) {
    const istart = Number(s.istart);
    const voiceId = (s && s.p_v && s.p_v.id != null) ? String(s.p_v.id) : "1";
    if (Number.isFinite(istart)) {
      if (!voiceStarts.has(voiceId)) voiceStarts.set(voiceId, []);
      voiceStarts.get(voiceId).push(istart);
    }
    const playable = Number.isFinite(s.dur) && s.dur > 0;
    if (!primaryVoiceId && playable && Number.isFinite(istart)) primaryVoiceId = voiceId;
    if (isBarLikeSymbol(s) && Number.isFinite(s.bar_num) && Number.isFinite(istart)) {
      barlines.push({ barNum: Number(s.bar_num), istart, voiceId });
      if (s.ts_next && Number.isFinite(Number(s.ts_next.istart))) {
        push(genericByNumber, s.bar_num, s.ts_next.istart);
      }
    }
    s = s.ts_next;
    guard += 1;
  }
  if (!primaryVoiceId) primaryVoiceId = "1";

  const primaryStarts = normalizeList(voiceStarts.get(primaryVoiceId));
  const firstPrimaryStart = primaryStarts.length ? primaryStarts[0] : null;
  if (Number.isFinite(firstPrimaryStart)) {
    push(byNumber, 0, firstPrimaryStart);
    push(byNumber, 1, firstPrimaryStart);
  }

  const primaryBars = barlines
    .filter((item) => String(item.voiceId || "1") === String(primaryVoiceId))
    .sort((a, b) => Number(a.istart) - Number(b.istart));

  for (const item of primaryBars) {
    const nextStart = findNextAfter(primaryStarts, Number(item.istart));
    if (Number.isFinite(nextStart)) {
      push(byNumber, item.barNum, nextStart);
    }
  }

  normalizeMap(genericByNumber);
  normalizeMap(byNumber);

  // Fill missing bar numbers from generic map when primary-voice mapping is incomplete.
  for (const [k, list] of genericByNumber.entries()) {
    if (!byNumber.has(k) || !Array.isArray(byNumber.get(k)) || !byNumber.get(k).length) {
      byNumber.set(k, Array.isArray(list) ? list.slice() : []);
    }
  }

  return byNumber;
}

function neutralizeMidiDrumDirectivesForPlayback(text) {
  const raw = String(text || "");
  if (!/%%\s*MIDI\s+drum(on|bars)?\b/i.test(raw)) return raw;
  // Keep line lengths stable (istart mapping) by replacing "%%" with "% " (comment).
  return raw.split(/\r\n|\n|\r/).map((line) => {
    if (!/^\s*%%\s*MIDI\s+drum(on|bars)?\b/i.test(line)) return line;
    const idx = line.indexOf("%%");
    if (idx < 0) return line;
    return `${line.slice(0, idx)}% ${line.slice(idx + 2)}`;
  }).join("\n");
}

function neutralizeInjectedDrumVoiceForPlayback(text) {
  const raw = String(text || "");
  if (!/^\s*V:\s*DRUM\b/im.test(raw)) return raw;
  const lines = raw.split(/\r\n|\n|\r/);
  const isDrumHeaderLine = (line) => /^\s*V:\s*DRUM\b/i.test(String(line || ""));
  const isVoiceHeaderLine = (line) => /^\s*V:\s*[^ \t\r\n]+/i.test(String(line || ""));
  const toCommentPlaceholder = (line) => {
    const src = String(line || "");
    if (!src.length) return src;
    return `%${" ".repeat(Math.max(0, src.length - 1))}`;
  };
  let inDrumVoice = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    if (!inDrumVoice && isDrumHeaderLine(line)) {
      inDrumVoice = true;
      lines[i] = toCommentPlaceholder(line);
      continue;
    }
    if (!inDrumVoice) continue;
    if (isVoiceHeaderLine(line) && !isDrumHeaderLine(line)) {
      inDrumVoice = false;
      continue;
    }
    lines[i] = toCommentPlaceholder(line);
  }
  return lines.join("\n");
}

function hasDrumBarMismatchParseError(parseErrors) {
  if (!Array.isArray(parseErrors)) return false;
  return parseErrors.some((e) => {
    if (!e || e.inDrumBlock !== true) return false;
    return /Different bars/i.test(String(e.message || ""));
  });
}

function isMidiDrumMustBeInVoicePlaybackError(message) {
  return /%%MIDI\s+drum\s+must be in a voice|%%MIDI\s+drumon\s+must be in a voice|%%MIDI\s+drumbars\s+must be in a voice/i
    .test(String(message || ""));
}

function hasMidiDrumMustBeInVoicePlaybackError(parseErrors) {
  if (!Array.isArray(parseErrors)) return false;
  return parseErrors.some((e) => isMidiDrumMustBeInVoicePlaybackError(e && e.message ? e.message : ""));
}

function relocateMidiDrumDirectivesIntoBody(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const drumLineRe = /^\s*%%\s*MIDI\s+drum(on|off|bars)?\b/i;
  let insertAt = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*K:/.test(line) || /^\s*\[\s*K:/.test(line)) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt < 0) return { text: String(text || ""), moved: 0 };

  const moved = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (i >= insertAt) break;
    const line = lines[i];
    if (!drumLineRe.test(line)) continue;
    moved.push(line);
    // Leave a same-length comment behind to keep editor/istart mapping as stable as possible.
    const idx = line.indexOf("%%");
    if (idx >= 0) {
      lines[i] = `${line.slice(0, idx)}% ${line.slice(idx + 2)}`;
    } else {
      lines[i] = `% ${line}`;
    }
  }
  if (!moved.length) return { text: lines.join("\n"), moved: 0 };

  // Insert original directives after K: so abc2svg treats them as being "in a voice" (native mididrum blocks).
  lines.splice(insertAt, 0, ...moved, "%");
  return { text: lines.join("\n"), moved: moved.length };
}

function getRenderMeasureIndex() {
  if (!editorView) return null;
  const payload = getRenderPayload();
  const key = `${payload.offset || 0}|||${payload.text || ""}`;
  if (renderMeasureIndexCache && renderMeasureIndexCache.key === key) return renderMeasureIndexCache;

  try {
    const AbcCtor = getAbcCtor();
    const user = {
      img_out: () => {},
      err: () => {},
      errmsg: () => {},
    };
    const abc = new AbcCtor(user);
    const navText = neutralizeMidiDrumDirectivesForPlayback(payload.text || "");
    abc.tosvg("nav_measures", navText);
    const tunes = abc.tunes || [];
    const first = tunes && tunes[0] ? tunes[0][0] : null;
    if (!first) return null;
    const istarts = buildMeasureIstartsFromAbc2svg(first);
    if (!istarts.length) return null;
    const byNumber = buildMeasureStartsByNumberFromAbc2svg(first);
    const renderOffset = Number(payload.offset) || 0;
    const firstBodyStart = findMeasureStartOffsetByNumber(payload.text || "", 1);
    const minIstart = Math.max(
      renderOffset,
      Number.isFinite(firstBodyStart) ? firstBodyStart : 0
    );
    let anchor = istarts.findIndex((v) => v >= minIstart);
    if (!Number.isFinite(anchor) || anchor < 0) anchor = 0;
    renderMeasureIndexCache = { key, offset: renderOffset, istarts, anchor, byNumber };
    return renderMeasureIndexCache;
  } catch {
    return null;
  }
}

async function promptGoToMeasureNumber() {
  return goToMeasureModalController.prompt();
}

async function goToMeasureFromMenu() {
  if (!editorView) return;
  if (rawMode) {
    setStatus("Go to Measure is unavailable in Raw mode.");
    return;
  }
  if (isPlaybackBusy()) {
    setStatus("Stop playback first.");
    return;
  }
  setStatus("Go to Measure…");
  const raw = await promptGoToMeasureNumber();
  if (raw == null) return;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    showToast("Invalid measure number.", 2400);
    return;
  }
  const text = getEditorValue();
  let idx = null;
  const measureIndex = getRenderMeasureIndex();
  if (
    idx == null
    && measureIndex
    && measureIndex.byNumber
    && typeof measureIndex.byNumber.get === "function"
  ) {
    const list = measureIndex.byNumber.get(n);
    if (Array.isArray(list) && list.length) {
      const renderOffset = Number(measureIndex.offset) || 0;
      const cursor = editorView ? editorView.state.selection.main.anchor : 0;
      const currentRenderIdx = mapEditorOffsetToRenderIdx(Number(cursor) || 0);
      let chosen = list[0];
      for (const v of list) {
        if (Number.isFinite(v) && v >= currentRenderIdx) { chosen = v; break; }
      }
      if (Number.isFinite(chosen)) idx = Math.max(0, Math.floor(mapRenderIdxToEditorOffset(chosen)));
    }
  }
  if (idx == null && n >= 1 && measureIndex && Array.isArray(measureIndex.istarts) && measureIndex.istarts.length) {
    const anchor = Number.isFinite(measureIndex.anchor) ? measureIndex.anchor : 0;
    const slot = (n - 1) + anchor;
    const istart = measureIndex.istarts[slot];
    if (Number.isFinite(istart)) {
      idx = Math.max(0, Math.floor(istart - (Number(measureIndex.offset) || 0)));
      if (window.__abcarusDebugGoToMeasure) {
        try {
          console.log("[abcarus] goToMeasure", { n, anchor, slot, istart, renderOffset: measureIndex.offset, idx });
        } catch {}
      }
    }
  }
  if (idx == null && n >= 1) idx = findMeasureStartOffsetByNumber(text, n);
  if (idx == null) {
    showToast(`Measure ${n} not found.`, 2600);
    return;
  }
  const max = editorView.state.doc.length;
  const pos = Math.max(0, Math.min(idx, max));
  editorView.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: true });

  // Transport playhead: next Play starts from this measure (until Stop).
  transportPlayheadOffset = pos;
  pendingPlaybackPlan = buildTransportPlaybackPlan();

  // Visual feedback: highlight the target measure in both editor and score.
  try {
    const range = findMeasureRangeAt(text, pos);
    if (range && Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start) {
      setPracticeBarHighlight({ from: range.start, to: range.end });
      highlightSvgPracticeBarAtEditorOffset(pos);
      const chosen = lastSvgPracticeBarEls.length ? pickClosestNoteElement(lastSvgPracticeBarEls) : null;
      if (chosen) maybeScrollRenderToNote(chosen);
      transportJumpHighlightActive = true;
      suppressTransportJumpClearOnce = true;
    } else {
      highlightSvgAtEditorOffset(pos);
    }
  } catch {}
  setStatus(`Go to measure: ${n}`);
}

function buildErrorTuneLabel(meta) {
  if (!meta) return "";
  const xPart = meta.xNumber ? `X:${meta.xNumber}` : "";
  const title = meta.title || "";
  return `${xPart} ${title}`.trim() || meta.id || "";
}

function getErrorGroupLabel(entry) {
  return getErrorGroupLabelCore(entry, { safeBasename });
}

function renderErrorList() {
  errorsListController.render();
}

function addError(message, locOverride, contextOverride) {
  if (!errorsEnabled) return;
  const renderLoc = locOverride || parseErrorLocation(message);
  const baseContext = activeTuneMeta ? {
    tuneId: activeTuneMeta.id,
    filePath: activeTuneMeta.path || null,
    fileBasename: activeTuneMeta.basename || (activeTuneMeta.path ? safeBasename(activeTuneMeta.path) : ""),
    tuneLabel: buildErrorTuneLabel(activeTuneMeta),
    xNumber: activeTuneMeta.xNumber || "",
    title: activeTuneMeta.title || "",
  } : null;
  const context = contextOverride
    ? { ...(baseContext || {}), ...contextOverride }
    : baseContext;
  const contextSource = context && context.source ? String(context.source) : "";
  const contextStart = context && Number.isFinite(context.errorStartOffset) ? Number(context.errorStartOffset) : null;
  const contextEnd = context && Number.isFinite(context.errorEndOffset) ? Number(context.errorEndOffset) : null;
  const contextBarNumber = context && Number.isFinite(context.barNumber) ? Number(context.barNumber) : null;
  const skipLineOffset = Boolean(context && context.skipLineOffset);
  const noRepeatCount = Boolean(context && context.noRepeatCount);
  const entry = {
    message: String(message),
    loc: renderLoc ? { line: renderLoc.line, col: renderLoc.col } : null,
    renderLoc: renderLoc ? { line: renderLoc.line, col: renderLoc.col } : null,
    tuneId: context ? context.tuneId || null : null,
    filePath: context ? context.filePath || null : null,
    fileBasename: context ? context.fileBasename || "" : "",
    tuneLabel: context ? context.tuneLabel || "" : "",
    xNumber: context ? context.xNumber || "" : "",
    title: context ? context.title || "" : "",
    source: contextSource || "abc2svg",
    errorStartOffset: contextStart,
    errorEndOffset: contextEnd,
    barNumber: contextBarNumber,
    count: 1,
    index: -1,
  };
  if (entry.loc && errorLineOffset && !skipLineOffset) {
    if (entry.loc.line <= errorLineOffset) {
      entry.loc = null;
    } else {
      entry.loc = {
        line: entry.loc.line - errorLineOffset,
        col: entry.loc.col,
      };
    }
  }
  if (!Number.isFinite(entry.errorStartOffset) || !Number.isFinite(entry.errorEndOffset) || entry.errorEndOffset <= entry.errorStartOffset) {
    const sourceRange = findErrorSourceRangeForMessage(getEditorValue(), entry.message, entry.loc);
    if (sourceRange && Number.isFinite(sourceRange.start) && Number.isFinite(sourceRange.end) && sourceRange.end > sourceRange.start) {
      entry.errorStartOffset = sourceRange.start;
      entry.errorEndOffset = sourceRange.end;
    }
  }
  const allowMeasureRange = !(context && context.skipMeasureRange);
  if (allowMeasureRange && entry.renderLoc && /Bad measure duration/i.test(entry.message) && isMeasureCheckEnabled()) {
    const payload = lastRenderPayload || getRenderPayload();
    const renderText = payload && payload.text ? payload.text : getEditorValue();
    const renderOffset = payload && payload.offset ? payload.offset : 0;
    const renderIdx = getTextIndexFromLoc(renderText, entry.renderLoc);
    if (Number.isFinite(renderIdx)) {
      const renderRange = findMeasureRangeAt(renderText, renderIdx);
      if (renderRange && renderRange.end > renderRange.start) {
        const editorStart = mapRenderIdxToEditorOffset(renderRange.start);
        const editorEnd = mapRenderIdxToEditorOffset(renderRange.end);
        const editorRange = (editorStart >= 0 && editorEnd > editorStart)
          ? { start: editorStart, end: editorEnd }
          : null;
        entry.measureRange = editorRange;
        const renderDupe = measureErrorRenderRanges.some((r) => r.start === renderRange.start && r.end === renderRange.end);
        if (!renderDupe) {
          measureErrorRenderRanges.push(renderRange);
        }
        if (editorRange) {
          const dupe = measureErrorRanges.some((r) => r.start === editorRange.start && r.end === editorRange.end);
          if (!dupe) {
            measureErrorRanges.push(editorRange);
            setMeasureErrorRanges(measureErrorRanges);
          }
        }
      }
    }
  }

  const key = buildErrorEntryKey(entry);
  const existing = errorEntryMap.get(key);
  if (existing) {
    if (!noRepeatCount) existing.count += 1;
    renderErrorList();
    showErrorsVisible(true);
    setScanErrors(errorEntries);
    return existing;
  }
  entry.errorKey = key;
  entry.index = errorEntries.length;
  errorEntries.push(entry);
  errorEntryMap.set(key, entry);
  renderErrorList();
  showErrorsVisible(true);
  setScanErrors(errorEntries);
  return entry;
}

function logErr(m, loc, context) {
  if (!errorsEnabled) return;
  addError(m, loc, context);
}

function clearDrumMismatchError() {
  if (!lastDrumMismatchErrorKey) return;
  const entry = errorEntryMap.get(lastDrumMismatchErrorKey);
  if (entry) {
    errorEntryMap.delete(lastDrumMismatchErrorKey);
    const idx = errorEntries.indexOf(entry);
    if (idx !== -1) {
      errorEntries.splice(idx, 1);
      for (let i = 0; i < errorEntries.length; i += 1) {
        errorEntries[i].index = i;
      }
    }
    renderErrorList();
    showErrorsVisible(true);
    setScanErrors(errorEntries);
  }
  lastDrumMismatchErrorKey = null;
  lastDrumMismatchTuneId = null;
  lastDrumMismatchInfo = null;
}

function computeDrumMismatchInfoFromEditor() {
  try {
    const tuneText = getEditorValue();
    if (!tuneText || !String(tuneText).trim()) return null;
    const entry = getActiveFileEntry();
    const prefixPayload = buildHeaderPrefix(entry ? getHeaderEditorValue() : "", false, tuneText);
    let text = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : String(tuneText || "");
    const gchordPreview = injectGchordOn(text, prefixPayload.offset || 0);
    if (gchordPreview && gchordPreview.changed) text = gchordPreview.text;
    const nativeDrums = shouldUseNativeMidiDrums();
    if (nativeDrums) return { ok: true };
    const normalized = normalizeLeadingInlineDirectivesForPlayback(text);
    if (!/(^|\n)\s*(%%MIDI\s+drum\b|I:\s*MIDI\s+drum\b)/i.test(normalized || "")) return null;
    const sanitized = sanitizeAbcForPlayback(normalized);
    const scanText = sanitized && sanitized.text ? sanitized.text : normalized;
    const info = extractDrumPlaybackBars(scanText);
    const expectedSig = computeExpectedBarSignatureFromInfo(info);
    const drumVoice = buildDrumVoiceText(info);
    if (!drumVoice) return { ok: true };
    const actualSig = extractBarSignatureFromText(drumVoice);
    const sigDiff = diffSignatures(expectedSig, actualSig);
    if (sigDiff.ok) return { ok: true };
    const mismatchBar = Number.isFinite(sigDiff.index) ? sigDiff.index + 1 : null;
    const barInfo = (Number.isFinite(sigDiff.index) && info && Array.isArray(info.bars))
      ? info.bars[sigDiff.index] : null;
    const lineIdx = barInfo && Number.isFinite(barInfo.srcLineIndex) ? barInfo.srcLineIndex : null;
    return {
      ok: false,
      sigDiff,
      mismatchBar,
      lineIndex: Number.isFinite(lineIdx) ? lineIdx : null,
      expectedToken: sigDiff.expectedToken || null,
      actualToken: sigDiff.actualToken || null,
    };
  } catch {
    return null;
  }
}

function ensureDrumMismatchErrorVisible() {
  if (!errorsEnabled) return;
  if (!lastDrumMismatchInfo || !lastDrumSignatureDiff || lastDrumSignatureDiff.ok) {
    const recomputed = computeDrumMismatchInfoFromEditor();
    if (!recomputed || recomputed.ok) {
      clearDrumMismatchError();
      return;
    }
    lastDrumSignatureDiff = recomputed.sigDiff || lastDrumSignatureDiff;
    lastDrumMismatchInfo = {
      mismatchBar: recomputed.mismatchBar,
      lineIndex: recomputed.lineIndex,
      expectedToken: recomputed.expectedToken,
      actualToken: recomputed.actualToken,
    };
  }
  if (lastDrumMismatchErrorKey && errorEntryMap.has(lastDrumMismatchErrorKey)) return;
  const mismatchBar = Number.isFinite(lastDrumMismatchInfo.mismatchBar) ? lastDrumMismatchInfo.mismatchBar : null;
  const lineIdx = Number.isFinite(lastDrumMismatchInfo.lineIndex) ? lastDrumMismatchInfo.lineIndex : null;
  const loc = Number.isFinite(lineIdx) ? { line: lineIdx + 1, col: 1 } : null;
  const expectedToken = lastDrumMismatchInfo.expectedToken || "barline";
  const actualToken = lastDrumMismatchInfo.actualToken ? `, got ${lastDrumMismatchInfo.actualToken}` : ", got end";
  const msg = mismatchBar != null
    ? `Drum disabled: mismatch at bar ${mismatchBar} (expected ${expectedToken}${actualToken}).`
    : "Drum disabled: barline mismatch in drum pattern.";
  const entry = addError(msg, loc, {
    source: "drum",
    barNumber: mismatchBar != null ? mismatchBar : null,
    noRepeatCount: true,
    skipMeasureRange: true,
  });
  if (entry && entry.errorKey) {
    lastDrumMismatchErrorKey = entry.errorKey;
  }
}

function clearNoteSelection() {
  for (const el of lastNoteSelection) {
    el.classList.remove("note-select");
  }
  lastNoteSelection = [];
}

function pickClosestNoteElement(els) {
  if (!$renderPane || !els || !els.length) return null;
  const viewTop = $renderPane.scrollTop;
  const viewCenter = viewTop + $renderPane.clientHeight / 2;
  let best = null;
  let bestDist = Infinity;
  for (const el of els) {
    const rect = el.getBoundingClientRect();
    const containerRect = $renderPane.getBoundingClientRect();
    const offsetTop = rect.top - containerRect.top + $renderPane.scrollTop;
    const dist = Math.abs(offsetTop - viewCenter);
    if (dist < bestDist) {
      best = el;
      bestDist = dist;
    }
  }
  return best;
}

function invalidateNoteHighlightIndexCache() {
  noteHighlightIndexCache = null;
}

function extractRenderIdxFromElementClass(el) {
  if (el && typeof el.getAttribute === "function") {
    const raw = Number(el.getAttribute("data-start"));
    if (Number.isFinite(raw)) return raw;
  }
  if (!el || !el.classList) return null;
  for (const cls of Array.from(el.classList)) {
    const m = String(cls || "").match(/^_(\d+)_$/);
    if (m) return Number(m[1]);
  }
  return null;
}

function buildNoteHighlightIndexCache() {
  if (noteHighlightIndexCache) return noteHighlightIndexCache;
  if (!$out) return null;
  const map = new Map();
  const idxs = [];
  const els = $out.querySelectorAll(".note-hl");
  for (const el of Array.from(els || [])) {
    const idx = extractRenderIdxFromElementClass(el);
    if (!Number.isFinite(idx)) continue;
    if (!map.has(idx)) {
      map.set(idx, []);
      idxs.push(idx);
    }
    map.get(idx).push(el);
  }
  idxs.sort((a, b) => a - b);
  noteHighlightIndexCache = { map, idxs };
  return noteHighlightIndexCache;
}

function queryNoteHighlightElementsByRenderIdx(renderIdx) {
  if (!Number.isFinite(renderIdx) || renderIdx < 0) return [];
  const cache = buildNoteHighlightIndexCache();
  if (!cache || !cache.map) return [];
  const hit = cache.map.get(renderIdx);
  return Array.isArray(hit) ? hit : [];
}

function findNearestNoteHighlightElements(renderIdx, maxDelta = 240) {
  const idx = Number(renderIdx);
  if (!Number.isFinite(idx)) return [];
  const cap = Math.max(0, Number(maxDelta) || 0);
  const cache = buildNoteHighlightIndexCache();
  if (!cache || !cache.map || !Array.isArray(cache.idxs) || !cache.idxs.length) return [];

  const exact = cache.map.get(idx);
  if (Array.isArray(exact) && exact.length) return exact;

  const list = cache.idxs;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < idx) lo = mid + 1;
    else hi = mid;
  }
  const right = lo < list.length ? list[lo] : null;
  const left = lo > 0 ? list[lo - 1] : null;

  const rightDist = Number.isFinite(right) ? Math.abs(right - idx) : Infinity;
  const leftDist = Number.isFinite(left) ? Math.abs(idx - left) : Infinity;
  let winner = null;
  if (rightDist === leftDist) {
    // Forward-first tie-break keeps Follow from sticking to the previous note.
    winner = Number.isFinite(right) ? right : left;
  } else {
    winner = rightDist < leftDist ? right : left;
  }
  if (!Number.isFinite(winner)) return [];
  if (Math.abs(winner - idx) > cap) return [];
  const hit = cache.map.get(winner);
  return Array.isArray(hit) ? hit : [];
}

function highlightNoteAtIndex(idx) {
  if (!$out) return;
  clearNoteSelection();
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const renderIdx = Number.isFinite(idx) ? mapEditorOffsetToRenderIdx(idx) : idx;
  const els = $out.querySelectorAll("._" + renderIdx + "_");
  if (!els.length) return;
  lastNoteSelection = Array.from(els);
  for (const el of lastNoteSelection) el.classList.add("note-select");
  const chosen = pickClosestNoteElement(lastNoteSelection);
  if (chosen) maybeScrollRenderToNote(chosen);
}

function scheduleCursorNoteHighlight(idx) {
  // Hot path: selection changes can fire frequently while typing/moving cursor.
  // Avoid synchronous SVG-wide querySelectorAll on every change; throttle to RAF and keep it opt-in via Follow.
  pendingCursorNoteHighlightIdx = idx;
  if (pendingCursorNoteHighlightRaf != null) return;
  pendingCursorNoteHighlightRaf = requestAnimationFrame(() => {
    pendingCursorNoteHighlightRaf = null;
    const next = pendingCursorNoteHighlightIdx;
    pendingCursorNoteHighlightIdx = null;
    if (!followPlayback) return;
    if (rawMode || isPlaying) return;
    highlightNoteAtIndex(next);
  });
}

function highlightRenderNoteAtIndex(renderIdx) {
  if (!$out) return;
  clearNoteSelection();
  if (!Number.isFinite(renderIdx)) return;
  const els = $out.querySelectorAll("._" + renderIdx + "_");
  if (!els.length) return;
  lastNoteSelection = Array.from(els);
  for (const el of lastNoteSelection) el.classList.add("note-select");
  const chosen = pickClosestNoteElement(lastNoteSelection);
  if (chosen) maybeScrollRenderToNote(chosen);
}

function setEditorSelectionAt(idx) {
  if (!editorView || !Number.isFinite(idx)) return;
  const max = editorView.state.doc.length;
  const pos = Math.max(0, Math.min(idx, max));
  editorView.dispatch({
    selection: EditorSelection.cursor(pos),
    scrollIntoView: true,
  });
  highlightNoteAtIndex(pos);
}

function setEditorSelectionRange(start, end) {
  if (!editorView || !Number.isFinite(start)) return;
  const max = editorView.state.doc.length;
  const anchor = Math.max(0, Math.min(start, max));
  const head = Number.isFinite(end) ? Math.max(anchor, Math.min(end, max)) : anchor;
  editorView.dispatch({
    selection: EditorSelection.range(anchor, head),
    scrollIntoView: true,
  });
  highlightNoteAtIndex(anchor);
}

function setEditorSelectionAtLineCol(line, col) {
  if (!editorView || !Number.isFinite(line) || !Number.isFinite(col)) return;
  const lineInfo = editorView.state.doc.line(Math.max(1, Math.min(line, editorView.state.doc.lines)));
  const pos = Math.min(lineInfo.to, lineInfo.from + Math.max(0, col - 1));
  setEditorSelectionAt(pos);
}

function buildSuggestedTuneBaseName({ includeKey = false } = {}) {
  const parsed = parseAbcHeaderFields(getEditorValue());
  const title = parsed.title || (activeTuneMeta && activeTuneMeta.title) || "untitled";
  const composerCandidate = parsed.composer || (activeTuneMeta && activeTuneMeta.composer) || "";
  const composer = String(composerCandidate || "").trim();
  const key = normalizeSuggestedKeyName(parsed.key || (activeTuneMeta && activeTuneMeta.key) || "");
  const parts = [title];
  if (composer) parts.push(composer);
  if (includeKey && key) parts.push(key);
  return sanitizeFileBaseName(parts.join(" - "));
}

function getSuggestedBaseName() {
  return buildSuggestedTuneBaseName({ includeKey: false });
}

function getSuggestedPrintBaseName() {
  return buildSuggestedTuneBaseName({ includeKey: true });
}

function getPlaybackText() {
  const payload = getPlaybackPayload();
  return payload.text;
}

function getDefaultSaveDir() {
  if (activeFilePath) return safeDirname(activeFilePath);
  if (libraryIndex && libraryIndex.root) return libraryIndex.root;
  if (currentDoc && currentDoc.path) return safeDirname(currentDoc.path);
  return null;
}

function getCurrentNotationMarkup() {
  if (!$out) return "";
  const markup = $out.innerHTML.trim();
  return markup;
}

function applyPrintDebugMarkup(markup) {
  return applyPrintDebugMarkupCore(markup, { noRaster: Boolean(window.__abcarusDebugPrintNoRaster) });
}

function getSongbookSuggestedBaseName() {
  if (activeFilePath) {
    const raw = safeBasename(activeFilePath).replace(/\.abc$/i, "");
    return sanitizeFileBaseName(raw || "songbook");
  }
  return getSuggestedBaseName();
}

async function runPrintAction(type) {
  if (!window.api) return;
  setStatus("Rendering…");
  const renderRes = await renderCurrentTuneSvgMarkupForPrint();
  if (!renderRes.ok) {
    setStatus("Error");
    logErr(renderRes.error || "Unable to render.");
    return;
  }
  const svgMarkup = applyPrintDebugMarkup(renderRes.svg);
  let res = null;
  const suggestedName = getSuggestedPrintBaseName();
  if (type === "preview" && typeof window.api.printPreview === "function") {
    res = await window.api.printPreview(svgMarkup, suggestedName);
  } else if (type === "print" && typeof window.api.printDialog === "function") {
    res = await window.api.printDialog(svgMarkup, suggestedName);
  } else if (type === "pdf" && typeof window.api.exportPdf === "function") {
    res = await window.api.exportPdf(svgMarkup, suggestedName);
  }
  if (res && res.ok) {
    setStatus("OK");
    if (type === "pdf" && res.path) {
      showToast(`Exported PDF: ${res.path}`);
    }
  } else if (res && res.error) {
    setStatus("Error");
    logErr(res.error);
  }
}

function ensureAbc2svgModulesReady(content) {
  return new Promise((resolve) => {
    if (!window.abc2svg || !window.abc2svg.modules || typeof window.abc2svg.modules.load !== "function") {
      resolve(true);
      return;
    }
    const done = window.abc2svg.modules.load(content, () => resolve(true), () => resolve(false));
    if (done) resolve(true);
  });
}

async function scanActiveFileForTuneErrors(entry, { filterToErrorTunes = false } = {}) {
  if (!errorsEnabled) return;
  if (!entry || !entry.path) return;
  if (currentDoc && currentDoc.dirty) {
    const choice = await confirmUnsavedChanges("scanning error tunes");
    if (choice === "cancel") {
      tuneErrorScanInFlight = false;
      setScanErrorButtonState(false);
      return;
    }
    if (choice === "save") {
      const ok = await performSaveFlow();
      if (!ok) {
        tuneErrorScanInFlight = false;
        setScanErrorButtonState(false);
        return;
      }
    }
  }
  tuneErrorFilter = Boolean(filterToErrorTunes);
  const token = ++tuneErrorScanToken;
  tuneErrorScanInFlight = true;
  setScanErrorButtonState(true);
  setScanErrorButtonActive(tuneErrorFilter);
  clearErrorIndexForFile(entry);
  const contentRes = await getFileContentCached(entry.path);
  if (!contentRes.ok) {
    tuneErrorScanInFlight = false;
    setScanErrorButtonState(false);
    return;
  }
  const tunes = entry.tunes || [];
  setErrorLineOffsetFromHeader("");
  const previousTuneId = activeTuneId;
  const previousEditorScroll = editorView && editorView.scrollDOM ? editorView.scrollDOM.scrollTop : 0;
  const previousRenderScroll = $renderPane ? $renderPane.scrollTop : 0;
  suppressRecentEntries = true;
  for (let i = 0; i < tunes.length; i += 1) {
    if (token !== tuneErrorScanToken) {
      suppressRecentEntries = false;
      tuneErrorScanInFlight = false;
      setScanErrorButtonState(false);
      return;
    }
    const tune = tunes[i];
    if (!tune || !Number.isFinite(tune.startOffset) || !Number.isFinite(tune.endOffset)) {
      setLibraryErrorIndexForTune(tune && tune.id ? tune.id : "", 0);
      continue;
    }
    await selectTune(tune.id, { skipConfirm: true, suppressRecent: true });
    const hasError = Boolean(libraryErrorIndex.has(tune.id));
    setLibraryErrorIndexForTune(tune.id, hasError ? 1 : 0);
    if (i % 10 === 0) {
      setStatus(`Scanning error tunes… ${i + 1}/${tunes.length}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  suppressRecentEntries = false;
  let restoredTuneId = previousTuneId;
  if (tuneErrorFilter) {
    const firstErrorTune = tunes.find((tune) => tune && libraryErrorIndex.has(tune.id));
    if (firstErrorTune && firstErrorTune.id) {
      restoredTuneId = firstErrorTune.id;
    }
  }
  if (restoredTuneId && restoredTuneId !== activeTuneId) {
    await selectTune(restoredTuneId, { skipConfirm: true });
  }
  if (editorView && editorView.scrollDOM) editorView.scrollDOM.scrollTop = previousEditorScroll;
  if ($renderPane) $renderPane.scrollTop = previousRenderScroll;
  tuneErrorScanInFlight = false;
  setScanErrorButtonState(false);
  setScanErrorButtonActive(tuneErrorFilter);
  buildTuneSelectOptions(entry);
  setScanErrors(errorEntries);
  setStatus("OK");
}

async function renderAbcToSvgMarkup(abcText, options = {}) {
  const errors = [];
  try {
    ensureAbc2svgLoader();
    const normalized = normalizeHeaderNoneSpacing(abcText);
    const baseText = normalized;
    const context = options && options.errorContext ? options.errorContext : null;
    const stopOnFirstError = Boolean(options && options.stopOnFirstError);
    const noSvg = Boolean(options && options.noSvg);
    const pageFormat = Boolean(options && options.pageFormat);

    const sepStripInitial = stripSepForRender(baseText);
    let renderText = sepStripInitial.replaced ? sepStripInitial.text : baseText;
    let sepFallbackUsed = sepStripInitial.replaced;
    let attempts = 0;
    while (attempts < 2) {
      attempts += 1;
      try {
        const ready = await ensureAbc2svgModulesReady(renderText);
        if (!ready) return { ok: false, error: "ABC modules failed to load." };
        const svgParts = [];
        if (errorsEnabled && tuneErrorScanInFlight) {
          const keyWarn = detectKeyFieldNotLastBeforeBody(renderText);
          if (keyWarn && keyWarn.detail) {
            const msg = `Warning: ${keyWarn.detail}`;
            errors.push({ message: msg, loc: keyWarn.loc || null });
            if (!options || !options.suppressGlobalErrors) {
              logErr(msg, keyWarn.loc || null, { ...(context || {}), skipMeasureRange: true });
            }
          }
        }
        const user = {
          page_format: pageFormat,
          img_out: (s) => {
            if (!noSvg) svgParts.push(s);
          },
          err: (msg) => {
            const entry = { message: String(msg) };
            errors.push(entry);
            if (!options || !options.suppressGlobalErrors) logErr(msg, null, context);
            if (stopOnFirstError) throw new Error(entry.message);
          },
          errmsg: (msg, line, col) => {
            const loc = Number.isFinite(line) && Number.isFinite(col)
              ? { line: line + 1, col: col + 1 }
              : null;
            const entry = { message: String(msg), loc };
            errors.push(entry);
            if (!options || !options.suppressGlobalErrors) logErr(msg, loc, context);
            if (stopOnFirstError) throw new Error(entry.message);
          },
        };
        const AbcCtor = getAbcCtor();
        if (!AbcCtor) return { ok: false, error: "abc2svg constructor not found." };
        const abc = new AbcCtor(user);
        abc.tosvg("out", renderText);
        if (window.abc2svg && typeof window.abc2svg.abc_end === "function") {
          window.abc2svg.abc_end();
        }
        const svg = svgParts.join("");
        if (noSvg) return { ok: true, svg: "", errors };
        if (!svg.trim()) return { ok: false, error: "No SVG output produced.", svg, errors };
        return { ok: true, svg, errors, sepFallbackUsed };
      } catch (e) {
        if (!sepFallbackUsed) {
          const sepStrip = stripSepForRender(baseText);
          if (sepStrip.replaced) {
            renderText = sepStrip.text;
            sepFallbackUsed = true;
            continue;
          }
        }
        throw e;
      }
    }
    return { ok: false, error: "No SVG output produced.", errors, sepFallbackUsed };
  } catch (e) {
    const message = (e && e.message) ? e.message : String(e);
    if (stopOnFirstError) return { ok: false, error: message, errors };
    return { ok: false, error: message };
  }
}

async function renderCurrentTuneSvgMarkupForPrint() {
  const tuneText = getEditorValue();
  if (!String(tuneText || "").trim()) return { ok: false, error: "No notation to print." };
  const entry = getActiveFileEntry();
  const headerText = entry ? getHeaderEditorValue() : "";
  const prefixPayload = buildHeaderPrefix(headerText, true, tuneText);
  const text = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
  const res = await renderAbcToSvgMarkup(text, { pageFormat: true });
  if (res && res.ok && res.svg) {
    const sourceMarkup = await sourceLinkFeature.buildPrintMarkup(tuneText);
    if (sourceMarkup) res.svg = `${res.svg.trim()}\n${sourceMarkup}`;
  }
  return res;
}

async function getFileContentCached(filePath) {
  let content = getFileContentFromCache(filePath);
  if (content == null) {
    const res = await readFile(filePath);
    if (!res.ok) return res;
    content = res.data;
    setFileContentInCache(filePath, content);
  }
  return { ok: true, data: content };
}

function setPrintAllFromSettings(settings) {
  printAllFeature.applySettings(settings);
}

async function runPrintAllAction(type) {
  await printAllFeature.runAction(type);
}

function setCurrentDocument(doc) {
  currentDoc = doc;
  updateUIFromDocument(doc);
}

function clearCurrentDocument() {
  currentDoc = null;
  showEmptyState();
}

function updateUIFromDocument(doc) {
  suppressDirty = true;
  setEditorValue(doc ? doc.content : "");
  suppressDirty = false;
  if (!rawMode) scheduleRenderNow({ clearOutput: true });
}

function showEmptyState() {
  setRawModeUI(false);
  chordProFeature.setMode(false);
  chordProFeature.resetState();
  rawModeFilePath = null;
  rawModeHeaderEndOffset = 0;
  rawModeOriginalTuneId = null;
  suppressDirty = true;
  setEditorValue("");
  suppressDirty = false;
  $out.innerHTML = "";
  setRenderBusy(false);
  activeTuneMeta = null;
  activeTuneId = null;
  activeFilePath = null;
  clearSaveSession();
  headerDirty = false;
  setTuneMetaText(UNTITLED_UNSAVED_LABEL);
  setFileNameMeta(UNTITLED_UNSAVED_LABEL);
  clearErrors();
  setStatus("Ready");
  updateFileHeaderPanel();
  updateHeaderStateUI();
}

function getAbcCtor() {
  return (window.abc2svg && window.abc2svg.Abc) ? window.abc2svg.Abc : window.Abc;
}

function ensureAbc2svgLoader() {
  if (!window.abc2svg || window.abc2svg.__abcarusLoader) return;
  const base = new URL("../../third_party/abc2svg/", window.location.href).href;
  const loaded = new Set();
  window.abc2svg.loadjs = (fn, relay, onerror) => {
    if (loaded.has(fn)) {
      if (relay) relay();
      return;
    }
    const script = document.createElement("script");
    script.src = `${base}${fn}`;
    script.async = true;
    script.onload = () => {
      loaded.add(fn);
      if (relay) relay();
    };
    script.onerror = () => {
      if (onerror) onerror(fn);
    };
    document.head.appendChild(script);
  };
  window.abc2svg.__abcarusLoader = true;
}

function ensureAbc2svgModules(content) {
  if (!window.abc2svg || !window.abc2svg.modules || typeof window.abc2svg.modules.load !== "function") {
    return true;
  }
  return window.abc2svg.modules.load(content, () => scheduleRenderNow(), logErr);
}

function ensureAbc2svgModulesAsync(content) {
  if (!window.abc2svg || !window.abc2svg.modules || typeof window.abc2svg.modules.load !== "function") {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const ok = window.abc2svg.modules.load(
      content,
      () => resolve(true),
      () => resolve(false)
    );
    if (ok) resolve(true);
  });
}

let midiGenLoadPromise = null;
function ensureMidiGenLoaded() {
  if (typeof window.midigen === "function") return Promise.resolve();
  if (midiGenLoadPromise) return midiGenLoadPromise;
  ensureAbc2svgLoader();
  midiGenLoadPromise = new Promise((resolve, reject) => {
    if (!window.abc2svg || typeof window.abc2svg.loadjs !== "function") {
      reject(new Error("abc2svg loader not available."));
      return;
    }
    window.abc2svg.loadjs("midigen.js", () => {
      if (typeof window.midigen === "function") resolve();
      else reject(new Error("midigen.js loaded but midigen() not found."));
    }, (fn) => reject(new Error(`Failed to load ${fn}`)));
  });
  return midiGenLoadPromise;
}

function normalizeHeaderNoneSpacing(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  for (const line of lines) {
    const match = line.match(/^(\s*[KM]:)(\s+)(none\b.*)$/i);
    if (match) {
      const lead = match[1];
      const gap = match[2] || "";
      const rest = match[3] || "";
      out.push(`${lead}${rest}${" ".repeat(gap.length)}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

function injectPlaybackMidiFxControls(text, offset) {
  const fxSettings = resolvePlaybackFxSettings(latestSettingsSnapshot || {});
  const reverbRaw = fxSettings && fxSettings.playbackMidiReverb != null
    ? Number(fxSettings.playbackMidiReverb)
    : NaN;
  const chorusRaw = fxSettings && fxSettings.playbackMidiChorus != null
    ? Number(fxSettings.playbackMidiChorus)
    : NaN;
  const toLevel = (value) => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.max(1, Math.min(127, Math.round(value)));
  };
  const reverb = toLevel(reverbRaw);
  const chorus = toLevel(chorusRaw);
  if (!reverb && !chorus) {
    return { text, offset: Number(offset) || 0 };
  }

  const lines = [];
  if (reverb) lines.push(`%%MIDI control 91 ${reverb}`);
  if (chorus) lines.push(`%%MIDI control 93 ${chorus}`);
  const insert = `${lines.join("\n")}\n`;
  const base = String(text || "");
  const idx = Math.max(0, Math.min(base.length, Number(offset) || 0));
  const next = `${base.slice(0, idx)}${insert}${base.slice(idx)}`;
  return { text: next, offset: idx + insert.length };
}

function normalizeAccThreeQuarterToneForAbc2svg(text) {
  // abc2svg has built-in glyphs for quarter-tones as 1/2 semitone (acc-1_2) and 3/2 semitones (acc-3_2),
  // but some real-world ABC uses 3/4 tone accidentals written as "_3/4" or "^3/4".
  // For tolerant playback, normalize to the abc2svg-supported 3/2 semitone form (same musical intent).
  return String(text || "").replace(/([_^])3\/4/g, "$13/2");
}

function assertCleanAbcText(text, originLabel) {
  const src = String(text || "");
  if (src.includes("[object Object]")) {
    console.error(`[abcarus] ABC text corruption detected (${originLabel || "unknown"}): contains "[object Object]"`);
    return false;
  }
  return true;
}

function stripSepForRender(text) {
  const value = String(text || "");
  let replaced = false;
  // Important: keep the output string length identical to the input.
  // The SVG <-> editor mapping uses character offsets; changing length breaks follow/highlight after a %%sep line.
  const stripped = value.replace(/^[ \t]*%%sep\b.*$/gmi, (line) => {
    replaced = true;
    const len = String(line || "").length;
    if (len <= 0) return "%";
    return `%${" ".repeat(Math.max(0, len - 1))}`;
  });
  return { text: stripped, replaced };
}

function parseBarToken(rawToken) {
  const raw = String(rawToken || "");
  const digitMatch = raw.match(/(\d+)$/);
  const voltaNumber = digitMatch ? Number(digitMatch[1]) : null;
  const rawNoDigits = digitMatch ? raw.slice(0, raw.length - digitMatch[1].length) : raw;

  let normalized = rawNoDigits
    .replace(/[\[\]]/g, "|")
    .replace(/\./g, "|");
  normalized = normalized.replace(/\|+/g, "|");

  const isCombined = normalized === "::" || (/^:.*:$/.test(normalized) && normalized.includes("|"));
  const startMulti = normalized.match(/^\|(:{2,})/);
  const endMulti = normalized.match(/(:{2,})\|$/);

  const repeatCountStart = startMulti ? (startMulti[1].length + 1) : 0;
  const repeatCountEnd = endMulti ? (endMulti[1].length + 1) : 0;

  const isRepeatStart = isCombined || normalized.includes("|:") || repeatCountStart > 0;
  const isRepeatEnd = isCombined || normalized.includes(":|") || repeatCountEnd > 0;

  const isFirstEnding = voltaNumber === 1
    && /(?:\||\[|:)/.test(rawNoDigits);
  const isSecondEnding = voltaNumber === 2
    && /(?:\||\[|:)/.test(rawNoDigits);

  return {
    raw,
    rawNoDigits,
    normalized,
    voltaNumber: Number.isFinite(voltaNumber) ? voltaNumber : null,
    isCombined,
    isRepeatStart,
    isRepeatEnd,
    repeatCountStart,
    repeatCountEnd,
    isFirstEnding,
    isSecondEnding,
  };
}

function normalizeBarToken(token) {
  if (!token) return "";
  const info = parseBarToken(token);
  if (info.isRepeatStart || info.isRepeatEnd || info.isFirstEnding || info.isSecondEnding) {
    return "|";
  }
  return token;
}

function hasRepeatTokens(text) {
  return /(\|\:|\:\||::|\|\s*\d+|\[\s*\d+)/.test(String(text || ""));
}

function shouldForceRepeatExpansionForPlayback(text) {
  const src = String(text || "");
  // abc2svg/abcplay can behave unpredictably on some complex repeat barlines; expand for deterministic playback.
  return /(\|:::|:::\||\|::|::\||::)/.test(src);
}

function expandRepeatsInString(line) {
  const value = String(line || "").trim();
  if (!value || !hasRepeatTokens(value)) return line;
  const bars = [];
  let current = "";
  let startToken = "";
  let inQuote = false;
  for (let i = 0; i < value.length; ) {
    const ch = value[i];
    if (ch === "\"") {
      inQuote = !inQuote;
      current += ch;
      i += 1;
      continue;
    }
    if (!inQuote) {
      const token = matchBarToken(value, i);
      if (token) {
        bars.push({ startToken, content: current.trim() });
        startToken = token.token;
        current = "";
        i += token.len;
        continue;
      }
    }
    current += ch;
    i += 1;
  }
  if (current.trim() || startToken) {
    bars.push({ startToken, content: current.trim() });
  }
  if (bars.length === 0) return line;

  const out = [];
  let repeatStart = null; // { idx, times }
  let firstEndStart = null;
  let secondEndStart = null;

  const emitBars = (slice) => {
    for (const bar of slice) {
      const token = normalizeBarToken(bar.startToken);
      if (bar.content) out.push(`${token}${bar.content}`);
      else if (token) out.push(token);
    }
  };

  for (let i = 0; i < bars.length; i += 1) {
    const token = bars[i].startToken || "";
    const info = parseBarToken(token);

    if (repeatStart != null && info.isFirstEnding) {
      firstEndStart = i;
      continue;
    }
    if (repeatStart != null && info.isSecondEnding) {
      secondEndStart = i;
      continue;
    }
    if (repeatStart != null && info.isRepeatEnd) {
      const repeatEnd = i;
      const times = Math.max(2, info.repeatCountEnd || (repeatStart && repeatStart.times) || 2);
      const repeatStartIdx = repeatStart ? repeatStart.idx : null;
      if (repeatStartIdx != null) {
        if (firstEndStart != null && secondEndStart != null && times === 2) {
          const partA = bars.slice(repeatStartIdx, firstEndStart);
          const partB = bars.slice(firstEndStart, secondEndStart);
          const partC = bars.slice(secondEndStart, repeatEnd);
          emitBars(partA);
          emitBars(partB);
          emitBars(partA);
          emitBars(partC);
        } else {
          const part = bars.slice(repeatStartIdx, repeatEnd);
          for (let rep = 0; rep < times; rep += 1) emitBars(part);
        }
      }

      repeatStart = null;
      firstEndStart = null;
      secondEndStart = null;
      if (info.isRepeatStart) {
        repeatStart = { idx: i, times: info.repeatCountStart || 2 };
        continue;
      }
      continue;
    }
    if (info.isRepeatStart) {
      repeatStart = { idx: i, times: info.repeatCountStart || 2 };
      continue;
    }
    if (repeatStart == null) {
      emitBars([bars[i]]);
    }
  }

  if (!out.length) {
    emitBars(bars);
  }
  return out.join(" ");
}

function expandRepeatsForPlayback(text) {
  if (!hasRepeatTokens(String(text || ""))) return text;
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let buffer = [];
  let inBody = false;

  const flushBuffer = () => {
    if (!buffer.length) return;
    const expanded = expandRepeatsInString(buffer.join(" "));
    out.push(expanded);
    buffer = [];
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!inBody && /^K:/.test(trimmed)) {
      flushBuffer();
      out.push(rawLine);
      inBody = true;
      continue;
    }
    if (!inBody || /^%/.test(trimmed) || /^%%/.test(trimmed) || /^[Ww]:/.test(trimmed)
      || (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed))) {
      flushBuffer();
      out.push(rawLine);
      continue;
    }
    if (/^V:/.test(trimmed)) {
      flushBuffer();
      out.push(rawLine);
      continue;
    }
    buffer.push(rawLine);
  }
  flushBuffer();
  return out.join("\n");
}

let pendingRenderTimer = null;
let pendingRenderRaf = null;
let renderRequestToken = 0;
let renderBusy = false;

function setRenderBusy(next) {
  renderBusy = Boolean(next);
  try {
    if ($renderPane) $renderPane.classList.toggle("is-rendering", renderBusy);
  } catch {}
}

function clearRenderOutput(statusText = "Ready") {
  setBarMismatchMarkers([]);
  setStatus(statusText || "Ready");
  if ($out) $out.innerHTML = "";
  invalidateNoteHighlightIndexCache();
  setRenderBusy(false);
  updateLibraryErrorIndexFromCurrentErrors();
  reconcileActiveErrorHighlightAfterRender({ renderSucceeded: false });
}

function scheduleRenderNow({ delayMs = 0, clearOutput = false } = {}) {
  if (rawMode || chordProFeature.isFullView()) return;
  renderRequestToken += 1;
  const token = renderRequestToken;
  if (pendingRenderTimer) {
    clearTimeout(pendingRenderTimer);
    pendingRenderTimer = null;
  }
  if (pendingRenderRaf) {
    cancelAnimationFrame(pendingRenderRaf);
    pendingRenderRaf = null;
  }

  if (clearOutput) {
    try {
      setStatus("Rendering…");
      setRenderBusy(true);
    } catch {}
  }

  const run = () => {
    if (token !== renderRequestToken) return;
    renderNow();
  };

  if (delayMs > 0) {
    pendingRenderTimer = setTimeout(() => {
      pendingRenderTimer = null;
      pendingRenderRaf = requestAnimationFrame(() => {
        pendingRenderRaf = null;
        run();
      });
    }, delayMs);
    return;
  }

  pendingRenderRaf = requestAnimationFrame(() => {
    pendingRenderRaf = null;
    run();
  });
}

function refreshBarMismatchMarkersForTune(tuneText, { lineOffset = 0, startOffset = 0 } = {}) {
  if (!editorView || rawMode || isPayloadMode() || !errorsEnabled) {
    setBarMismatchMarkers([]);
    return;
  }
  try {
    let markers = analyzeBarMismatchesForGutter(tuneText);
    const lineDelta = Number(lineOffset) || 0;
    const offsetDelta = Number(startOffset) || 0;
    if ((lineDelta || offsetDelta) && Array.isArray(markers)) {
      markers = markers.map((marker) => {
        if (!marker) return marker;
        const next = { ...marker };
        if (Number.isFinite(next.offset)) next.offset = Number(next.offset) + offsetDelta;
        if (Number.isFinite(next.line)) next.line = Number(next.line) + lineDelta;
        return next;
      });
    }
    setBarMismatchMarkers(markers);
    if (window.__abcarusDebugBarMismatch === true) {
      console.info("[bar-mismatch]", {
        count: Array.isArray(markers) ? markers.length : 0,
        first: Array.isArray(markers) ? markers.slice(0, 8) : [],
      });
    }
  } catch {
    setBarMismatchMarkers([]);
    if (window.__abcarusDebugBarMismatch === true) {
      console.warn("[bar-mismatch] analyze failed");
    }
  }
}

function addBarMismatchErrorsFromMarkers(markers) {
  if (!errorsEnabled || !editorView) return;
  if (!Array.isArray(markers) || markers.length === 0) return;
  const docLen = editorView.state.doc.length;
  const clamp = (value) => Math.max(0, Math.min(docLen, Math.floor(Number(value) || 0)));
  for (const marker of markers) {
    if (!marker || !Number.isFinite(marker.offset)) continue;
    const start = clamp(marker.offset);
    const len = Math.max(1, Math.min(16, Math.floor(Number(marker.len) || 1)));
    const end = Math.max(start + 1, clamp(start + len));
    const barLabel = marker.barLabel
      ? String(marker.barLabel)
      : (marker.barNumber ? `Bar ${marker.barNumber}` : "Bar");
    const deltaLabel = marker.deltaText ? ` ${marker.deltaText}` : "";
    const voicePrefix = marker.voiceId ? `V:${marker.voiceId} · ` : "";
    const detail = marker.detail ? String(marker.detail) : `${voicePrefix}${barLabel}${deltaLabel} mismatch.`;
    const message = `Bar mismatch: ${detail}`;
    const loc = Number.isFinite(marker.line)
      ? { line: Number(marker.line), col: Number.isFinite(marker.col) ? Number(marker.col) : 1 }
      : null;
    addError(message, loc, {
      source: "bar-mismatch",
      skipMeasureRange: true,
      skipLineOffset: true,
      errorStartOffset: start,
      errorEndOffset: end,
      barNumber: marker.barNumber || null,
      voiceId: marker.voiceId || "",
    });
  }
}

function renderNow() {
  clearNoteSelection();
  invalidateNoteHighlightIndexCache();
  clearErrors();
  setRenderBusy(true);
  const currentText = getEditorValue();
  if (chordProFeature.isEnabled() && chordProFeature.isFullView()) {
    clearRenderOutput("ChordPro full view.");
    return;
  }
  if (chordProFeature.isEnabled() && !chordProFeature.hasBlocks()) {
    clearRenderOutput("No ABC blocks.");
    return;
  }
  if (!currentText.trim()) {
    setBarMismatchMarkers([]);
    setStatus("Ready");
    setRenderBusy(false);
    updateLibraryErrorIndexFromCurrentErrors();
    reconcileActiveErrorHighlightAfterRender({ renderSucceeded: true });
    return;
  }
  refreshBarMismatchMarkersForTune(currentText);
  const renderPayload = getRenderPayload();
  if (!assertCleanAbcText(renderPayload.text, "renderNow")) {
    logErr("ABC text corruption detected (render).");
    setStatus("Error");
    setRenderBusy(false);
    updateLibraryErrorIndexFromCurrentErrors();
    return;
  }
  const renderTextBase = normalizeHeaderNoneSpacing(renderPayload.text);
  const sepStripInitial = stripSepForRender(renderTextBase);
  let renderText = sepStripInitial.replaced ? sepStripInitial.text : renderTextBase;
  let sepFallbackUsed = sepStripInitial.replaced;
  lastRenderPayload = {
    text: renderText,
    offset: renderPayload.offset || 0,
    lineOffset: Number.isFinite(renderPayload.lineOffset) ? renderPayload.lineOffset : null,
    compatMap: null,
  };
  if (Number.isFinite(renderPayload.lineOffset)) {
    errorLineOffset = renderPayload.lineOffset;
  } else {
    setErrorLineOffsetFromHeader(renderPayload.text.slice(0, renderPayload.offset || 0));
  }
  addBarMismatchErrorsFromMarkers(barMismatchMarkers);
  setStatus("Rendering…");

  try {
    ensureAbc2svgLoader();
    if (!ensureAbc2svgModules(renderText)) {
      setStatus("Loading modules…");
      setRenderBusy(true);
      return;
    }

    let attempts = 0;
    while (attempts < 2) {
      attempts += 1;
      try {
        const svgParts = [];
        let abcInstance = null;

        const user = {
          img_out: (s) => svgParts.push(s),
          err: (msg) => logErr(msg),
          errmsg: (msg, line, col) => {
            const loc = Number.isFinite(line) && Number.isFinite(col)
              ? { line: line + 1, col: col + 1 }
              : null;
            logErr(msg, loc);
          },
          anno_stop: (type, start, stop, x, y, w, h) => {
            if (!abcInstance) return;
            if (type === "beam" || type === "slur" || type === "tuplet") return;
            const cls = type === "bar" ? "bar-hl" : "note-hl";
            abcInstance.out_svg(
              '<rect class="' + cls + ' _' + start + '_" data-start="' + start + '" data-end="' + stop + '" x="'
            );
            abcInstance.out_sxsy(x, '" y="', y);
            abcInstance.out_svg(
              '" width="' + w.toFixed(2) + '" height="' + abcInstance.sh(h).toFixed(2) + '"/>\n'
            );
          },
        };

        const AbcCtor = getAbcCtor();
        if (!AbcCtor) throw new Error("abc2svg constructor not found. Check third_party/abc2svg scripts.");

        const abc = new AbcCtor(user);
        abcInstance = abc;
        abc.tosvg("out", renderText);
        const meterWarn = detectMeterMismatchInBarlines(renderText);
        if (meterWarn && meterWarn.detail) {
          addError(`Warning: Meter mismatch: ${meterWarn.detail}`, meterWarn.loc || null, { skipMeasureRange: true });
        }
        const repeatWarn = detectRepeatMarkerAfterShortBar(renderText);
        if (repeatWarn && repeatWarn.detail) {
          addError(`Warning: ${repeatWarn.detail}`, repeatWarn.loc || null, { skipMeasureRange: true });
        }

        const svg = svgParts.join("");
        if (!svg.trim()) throw new Error("No SVG output produced (see errors).");
        $out.innerHTML = svg;
        invalidateNoteHighlightIndexCache();
        applyMeasureHighlights(renderPayload.offset || 0);
        // Keep notation synced to the editor selection (especially after edits re-render the SVG).
        if (editorView) {
          const anchor = editorView.state.selection.main.anchor;
          highlightNoteAtIndex(anchor);
          const activeErrorRange = errorsHighlightState.getRange();
          if (activeErrorRange && Number.isFinite(activeErrorRange.from)) {
            highlightSvgAtEditorOffset(activeErrorRange.from);
          }
        if (!isPlaybackBusy() && transportJumpHighlightActive && Number.isFinite(anchor)) {
          try {
            highlightSvgPracticeBarAtEditorOffset(anchor);
          } catch {}
        }
      }
        if (sepFallbackUsed && isDebugMessagesEnabled()) {
          setTransientBufferStatus("Note: %%sep ignored for rendering.");
        }
        setStatus("OK");
        setRenderBusy(false);
        ensureDrumMismatchErrorVisible();
        updateLibraryErrorIndexFromCurrentErrors();
        reconcileActiveErrorHighlightAfterRender({ renderSucceeded: true });
        break;
      } catch (e) {
        if (!sepFallbackUsed) {
          const sepStrip = stripSepForRender(renderText);
          if (sepStrip.replaced) {
            sepFallbackUsed = true;
            renderText = sepStrip.text;
            lastRenderPayload = {
              text: renderText,
              offset: renderPayload.offset || 0,
              lineOffset: Number.isFinite(renderPayload.lineOffset) ? renderPayload.lineOffset : null,
              compatMap: null,
            };
            continue;
          }
        }
        throw e;
      }
    }
  } catch (e) {
    logErr((e && e.stack) ? e.stack : String(e));
    setStatus("Error");
    setRenderBusy(false);
    updateLibraryErrorIndexFromCurrentErrors();
    reconcileActiveErrorHighlightAfterRender({ renderSucceeded: false });
  }
}

initEditor();
initSearchPanelShortcuts();
initHeaderEditor();
setHeaderCollapsed(headerCollapsed);
setCurrentDocument(createBlankDocument());
updateWindowTitle();
updateHeaderStateUI();
initPaneResizer();
initRightPaneResizer();
initSidebarResizer();
initPlaybackAutoScrollListeners();
setLibraryVisible(false);

// Preload soundfont in background to avoid first-play delay.
(async () => {
  try {
    await ensureSoundfontLoaded();
    setStatus("OK");
  } catch (e) {
    logErr((e && e.stack) ? e.stack : String(e));
    setStatus("Error");
  }
})();

checkExternalTools().catch(() => {});

function serializeDocument(doc) {
  return doc.content;
}

function deserializeToDocument(data) {
  return {
    path: null,
    dirty: false,
    content: data,
  };
}

async function confirmUnsavedChanges(contextLabel) {
  if (!window.api || typeof window.api.confirmUnsavedChanges !== "function") return "cancel";
  return window.api.confirmUnsavedChanges(contextLabel);
}

async function confirmOverwrite(filePath) {
  if (!window.api || typeof window.api.confirmOverwrite !== "function") return "cancel";
  return window.api.confirmOverwrite(filePath);
}

async function confirmAppendToFile(filePath) {
  if (!window.api || typeof window.api.confirmAppendToFile !== "function") return "cancel";
  return window.api.confirmAppendToFile(filePath);
}

async function confirmImportMusicXmlTarget(filePath) {
  if (!window.api || typeof window.api.confirmImportMusicXmlTarget !== "function") {
    return filePath ? "this_file" : "cancel";
  }
  return window.api.confirmImportMusicXmlTarget(filePath || "");
}

async function confirmDeleteTune(label) {
  if (!window.api || typeof window.api.confirmDeleteTune !== "function") return "cancel";
  return window.api.confirmDeleteTune(label);
}

async function showOpenDialog() {
  if (!window.api || typeof window.api.showOpenDialog !== "function") return null;
  return window.api.showOpenDialog();
}

async function showSaveDialog(suggestedName, suggestedDir) {
  if (!window.api || typeof window.api.showSaveDialog !== "function") return null;
  return window.api.showSaveDialog(suggestedName, suggestedDir);
}

async function showOpenFolderDialog() {
  if (!window.api || typeof window.api.showOpenFolderDialog !== "function") return null;
  return window.api.showOpenFolderDialog();
}

const fileOpQueues = new Map();

function normalizeFileOpKey(filePath) {
  const raw = String(filePath || "");
  const normalized = normalizeLibraryPath(raw);
  return normalized || raw;
}

async function withFileLock(filePath, operation) {
  const key = normalizeFileOpKey(filePath);
  if (!key) return operation();
  const prev = fileOpQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(operation);
  const tail = next.finally(() => {
    if (fileOpQueues.get(key) === tail) fileOpQueues.delete(key);
  });
  fileOpQueues.set(key, tail);
  return tail;
}

async function withFileLocks(filePaths, operation) {
  const list = Array.from(new Set((filePaths || []).map((p) => normalizeFileOpKey(p)).filter(Boolean)));
  if (!list.length) return operation();
  list.sort((a, b) => a.localeCompare(b));
  let chained = operation;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    const prevFn = chained;
    chained = () => withFileLock(p, prevFn);
  }
  return chained();
}

function countLines(text) {
  if (!text) return 1;
  return text.split(/\r\n|\n|\r/).length;
}

function isValidTuneSliceInFullText(fullText, startOffset, endOffset, expectedX = "") {
  const text = String(fullText || "");
  const start = Number(startOffset);
  const end = Number(endOffset);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > text.length) return false;
  const slice = text.slice(start, end);
  if (!/^\s*X:/.test(slice)) return false;
  const x = String(expectedX || "").trim();
  if (x) {
    const match = slice.match(/^\s*X:\s*([^\r\n]*)/);
    if (!match || String(match[1] || "").trim() !== x) return false;
  }
  return true;
}

function getActiveFileTuneEntries(filePath) {
  const p = String(filePath || "");
  if (!p || !libraryIndex || !Array.isArray(libraryIndex.files)) return [];
  const fileEntry = libraryIndex.files.find((f) => pathsEqual(f && f.path, p));
  return fileEntry && Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
}

function resolveActiveTuneSliceInFullText(filePath, fullText) {
  const expectedX = activeTuneMeta && activeTuneMeta.xNumber != null ? String(activeTuneMeta.xNumber || "").trim() : "";
  const candidates = [];
  const pushCandidate = (source, startOffset, endOffset, tune = null) => {
    if (!Number.isFinite(Number(startOffset)) || !Number.isFinite(Number(endOffset))) return;
    candidates.push({
      source,
      startOffset: Number(startOffset),
      endOffset: Number(endOffset),
      tune,
    });
  };

  if (activeTuneMeta && activeTuneMeta.path && pathsEqual(activeTuneMeta.path, filePath)) {
    pushCandidate("active_meta", activeTuneMeta.startOffset, activeTuneMeta.endOffset);
  }

  const tunes = getActiveFileTuneEntries(filePath);
  if (tunes.length) {
    if (activeTuneId) {
      const byId = tunes.find((t) => t && t.id && String(t.id) === String(activeTuneId));
      if (byId) pushCandidate("library_id", byId.startOffset, byId.endOffset, byId);
    }
    if (activeTuneUid) {
      const byUid = tunes.find((t) => t && t.tuneUid && String(t.tuneUid) === String(activeTuneUid));
      if (byUid) pushCandidate("library_uid", byUid.startOffset, byUid.endOffset, byUid);
    }
    if (Number.isFinite(Number(activeTuneIndex))) {
      const byIndex = tunes[Number(activeTuneIndex)];
      if (byIndex) pushCandidate("library_index", byIndex.startOffset, byIndex.endOffset, byIndex);
    }
    if (expectedX) {
      const byX = tunes.find((t) => t && String(t.xNumber || "").trim() === expectedX);
      if (byX) pushCandidate("library_x", byX.startOffset, byX.endOffset, byX);
    }
  }

  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${candidate.startOffset}:${candidate.endOffset}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isValidTuneSliceInFullText(fullText, candidate.startOffset, candidate.endOffset, expectedX)) {
      return candidate;
    }
  }
  return null;
}

function replaceFileHeaderText(fullText, headerText) {
  const text = String(fullText || "");
  let header = String(headerText || "");
  const body = text.slice(findHeaderEndOffset(text));
  if (header && !/[\r\n]$/.test(header) && /^[\t ]*X:/.test(body)) header += "\n";
  return `${header}${body}`;
}

function updateActiveTuneMetaAfterSimpleSave(filePath, updatedFile) {
  if (!updatedFile || !Array.isArray(updatedFile.tunes) || !updatedFile.tunes.length) return;
  const prevIndex = Number.isFinite(Number(activeTuneIndex)) ? Number(activeTuneIndex) : null;
  const prevX = activeTuneMeta && activeTuneMeta.xNumber != null ? String(activeTuneMeta.xNumber || "").trim() : "";
  const prevId = activeTuneId ? String(activeTuneId) : "";
  const prevStart = activeTuneMeta && Number.isFinite(Number(activeTuneMeta.startOffset)) ? Number(activeTuneMeta.startOffset) : null;
  let tune = null;
  if (prevIndex != null) tune = updatedFile.tunes[prevIndex] || null;
  if (!tune && prevX) tune = updatedFile.tunes.find((t) => t && String(t.xNumber || "").trim() === prevX) || null;
  if (!tune && prevId) tune = updatedFile.tunes.find((t) => t && t.id && String(t.id) === prevId) || null;
  if (!tune && prevStart != null) tune = updatedFile.tunes.find((t) => Number(t && t.startOffset) === prevStart) || null;
  if (!tune) return;

  activeTuneId = tune.id || activeTuneId;
  activeTuneUid = tune.tuneUid || activeTuneUid || null;
  activeTuneIndex = Number.isFinite(Number(tune.tuneIndex))
    ? Number(tune.tuneIndex)
    : (Number.isFinite(Number(updatedFile.tunes.indexOf(tune))) ? updatedFile.tunes.indexOf(tune) : activeTuneIndex);
  activeTuneMeta = {
    ...(activeTuneMeta || {}),
    id: tune.id || (activeTuneMeta && activeTuneMeta.id) || "",
    tuneUid: tune.tuneUid || (activeTuneMeta && activeTuneMeta.tuneUid) || "",
    tuneIndex: Number.isFinite(Number(activeTuneIndex)) ? Number(activeTuneIndex) : null,
    path: updatedFile.path || filePath,
    basename: updatedFile.basename || safeBasename(filePath),
    xNumber: tune.xNumber || (activeTuneMeta && activeTuneMeta.xNumber) || "",
    title: tune.title || (activeTuneMeta && activeTuneMeta.title) || "",
    composer: tune.composer || (activeTuneMeta && activeTuneMeta.composer) || "",
    key: tune.key || (activeTuneMeta && activeTuneMeta.key) || "",
    startLine: tune.startLine,
    endLine: tune.endLine,
    startOffset: tune.startOffset,
    endOffset: tune.endOffset,
  };
  markActiveTuneButton(activeTuneUid || activeTuneId);
  setTuneMetaText(buildTuneMetaLabel(activeTuneMeta));
  setFileNameMeta(stripFileExtension(activeTuneMeta.basename || safeBasename(filePath)));
  setSaveSession({
    intent: SAVE_INTENT.REPLACE_TUNE,
    targetPath: String(filePath || ""),
    targetTuneUid: String(activeTuneUid || ""),
    source: "simple_tune_save",
  });
}

async function alignWorkingCopyWithDiskAfterSimpleSave(filePath) {
  const p = String(filePath || "");
  if (!p || !isWorkingCopyOpenForFile(p)) return;
  try {
    if (window.api && typeof window.api.reloadWorkingCopyFromDisk === "function") {
      await window.api.reloadWorkingCopyFromDisk();
      await refreshWorkingCopySnapshot();
    }
  } catch {}
}

async function performSimpleTuneSave(filePath, { includeHeader = false } = {}) {
  const p = String(filePath || "");
  if (!p) {
    await showSaveError("Unable to save: tune path is missing.");
    return false;
  }
  return withFileLock(p, async () => {
    const cached = getFileContentFromCache(p);
    let fullText = cached != null ? String(cached) : "";
    if (cached == null) {
      const readRes = await readFile(p);
      if (!readRes || !readRes.ok) {
        await showSaveError((readRes && readRes.error) ? readRes.error : "Unable to read file.");
        return false;
      }
      fullText = String(readRes.data || "");
    }
    let slice = resolveActiveTuneSliceInFullText(p, fullText);
    if (!slice) {
      const refreshed = await refreshLibraryFile(p, { force: true });
      if (refreshed) slice = resolveActiveTuneSliceInFullText(p, fullText);
    }
    if (!slice && cached != null) {
      const readRes = await readFile(p);
      if (readRes && readRes.ok) {
        fullText = String(readRes.data || "");
        slice = resolveActiveTuneSliceInFullText(p, fullText);
      }
    }
    if (!slice) {
      await showSaveError("Unable to save: active tune slice was not found in the file buffer.");
      return false;
    }

    const targetX = activeTuneMeta && activeTuneMeta.xNumber != null
      ? String(activeTuneMeta.xNumber || "").trim()
      : "";
    const tuneText = targetX
      ? ensureXNumberInAbc(getEditorValue(), targetX)
      : ensureXNumberInAbc(getEditorValue(), "");
    let updatedText = `${fullText.slice(0, slice.startOffset)}${tuneText}${fullText.slice(slice.endOffset)}`;
    if (includeHeader) {
      updatedText = replaceFileHeaderText(updatedText, getHeaderEditorValue());
    }
    const writeRes = await writeFile(p, updatedText);
    if (!writeRes || !writeRes.ok) {
      await showSaveError((writeRes && writeRes.error) ? writeRes.error : "Unable to save file.");
      return false;
    }

    const verifyRes = await readFile(p);
    if (!verifyRes || !verifyRes.ok) {
      await showSaveError((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify saved file.");
      return false;
    }
    if (String(verifyRes.data || "") !== updatedText) {
      await showSaveError("Save verification failed: disk file does not match the editor buffer.");
      return false;
    }

    setFileContentInCache(p, updatedText);
    if (currentDoc) {
      currentDoc.path = p;
      currentDoc.content = tuneText;
      currentDoc.dirty = false;
    }
    if (includeHeader) {
      headerDirty = false;
      updateHeaderStateUI();
    }
    markDiskConflictPath(p, false);
    resetTransposePreviewState();
    setDirtyIndicator(false);
    activeFilePath = p;
    recordNavFilePath(p);

    await alignWorkingCopyWithDiskAfterSimpleSave(p);
    const updatedFile = await refreshLibraryFile(p, { force: true });
    updateActiveTuneMetaAfterSimpleSave(p, updatedFile);
    updateLibraryStatus();
    scheduleRenderLibraryTree();
    updateFileHeaderPanel();
    scheduleAutoWcDump("save-simple", p ? safeBasename(p) : "");
    recordRecentAction("save.simple_tune.ok", { path: p });
    return true;
  });
}

async function showSaveError(message) {
  if (!window.api || typeof window.api.showSaveError !== "function") return;
  await window.api.showSaveError(message);
}

async function showOpenError(message) {
  if (!window.api || typeof window.api.showOpenError !== "function") return;
  await window.api.showOpenError(message);
}

async function openExternal(url) {
  if (!window.api || typeof window.api.openExternal !== "function") return;
  const res = await window.api.openExternal(url);
  if (res && res.error) logErr(res.error);
}

window.dumpDebugToFile = (...args) => debugDumpFeature.dumpToFile(...args);

let libraryListYieldedByThisOpen = false;
let libraryTreeHintToastShown = false;
document.addEventListener("library-modal:closed", () => {
  if (!libraryListYieldedByThisOpen) return;
  document.body.classList.remove("library-list-open");
  libraryListYieldedByThisOpen = false;
});

document.addEventListener("set-list:add", (ev) => {
  try {
    const row = ev && ev.detail && ev.detail.row ? ev.detail.row : null;
    if (!row) return;
    const tuneId = row && row.tuneId ? String(row.tuneId) : "";
    setListFeature.addTuneById(tuneId, { fallbackTitle: row.title, fallbackComposer: row.composer }).then(() => {
      showToast("Added to Set List.", 2000);
    }).catch((e) => {
      showToast(e && e.message ? e.message : String(e), 5000);
    });
  } catch {}
});

function openLibraryListFromCurrentLibraryIndex() {
  if (chordProFeature.isEnabled()) {
    showToast("Library is disabled while editing ChordPro.", 2400);
    return false;
  }
  if (!libraryIndex || !libraryIndex.root || !Array.isArray(libraryIndex.files) || !libraryIndex.files.length) {
    setStatus("Load a library folder first.");
    return false;
  }
  if (!window.openLibraryModal) return false;

  const rows = libraryViewStore.getModalRows();
  if (!hasFullLibraryIndex()) {
    ensureFullLibraryIndex({ reason: "library list" }).catch(() => {});
  }

  if (!isLibraryVisible && !libraryTreeHintToastShown) {
    libraryTreeHintToastShown = true;
    showToast("Tip: Library Tree is hidden. Click Library or press Ctrl+L.", 4200);
  }

  libraryListYieldedByThisOpen = false;
  if (isLibraryVisible) {
    document.body.classList.add("library-list-open");
    libraryListYieldedByThisOpen = true;
  }

  window.openLibraryModal(rows);
  return true;
}

async function openAbout() {
  await aboutModalController.open();
}

async function buildSetListItemForTuneId(
  tuneId,
  { fallbackTitle = "", fallbackComposer = "" } = {}
) {
  const id = String(tuneId || "").trim();
  if (!id) throw new Error("Missing tune id.");

  if (currentDoc && currentDoc.dirty && activeTuneId && id === activeTuneId) {
    const choice = await confirmUnsavedChanges("adding this tune to Set List");
    if (choice === "cancel") return;
    if (choice === "save") {
      const ok = await performSaveFlow();
      if (!ok) return;
    }
  }

  const res = findTuneById(id);
  if (!res) throw new Error("Tune not found in library.");

  const readRes = await readFile(res.file.path);
  if (!readRes || !readRes.ok) throw new Error(readRes && readRes.error ? readRes.error : "Unable to read file.");
  const content = String(readRes.data || "");
  const entryHeader = (activeFilePath && pathsEqual(activeFilePath, res.file.path))
    ? getHeaderEditorValue()
    : (res.file.headerText || "");

  const startOffset = Number(res.tune.startOffset);
  const endOffset = Number(res.tune.endOffset);
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > content.length) {
    throw new Error("Refusing to add: tune offsets look stale. Refresh the library and try again.");
  }
  const slice = content.slice(startOffset, endOffset);
  const trimmed = slice.replace(/^\s+/, "");
  const xMatch = trimmed.match(/^X:\s*(\d+)/);
  if (!xMatch) {
    throw new Error("Refusing to add: tune offsets look stale. Refresh the library and try again.");
  }
  const expectedX = String(res.tune.xNumber || "");
  if (expectedX && xMatch[1] !== expectedX) {
    throw new Error(`Refusing to add: tune offsets look stale (expected X:${expectedX}). Refresh the library and try again.`);
  }

  return {
    sourceTuneId: id,
    sourcePath: res.file.path,
    xNumber: res.tune.xNumber || "",
    title: res.tune.title || fallbackTitle || "",
    composer: res.tune.composer || fallbackComposer || "",
    headerText: entryHeader,
    text: slice,
  };
}

async function renderSetListItemToSvg({ abcText, headerText, tune } = {}) {
  const body = String(abcText || "");
  const sanitizedHeader = sanitizeFileHeaderForPerTuneRender(headerText);
  const prefix = buildHeaderPrefix(sanitizedHeader, false, body);
  const block = prefix.text ? `${prefix.text}${body}` : body;
  const context = { tuneLabel: buildPrintTuneLabel(tune || {}) };
  setErrorLineOffsetFromHeader(prefix.text);
  const res = await renderAbcToSvgMarkup(block, { errorContext: context, pageFormat: true });
  return { ...res, blockText: block };
}

async function saveSetListAbcContent({ suggestedName, content } = {}) {
  const suggestedDir = getDefaultSaveDir();
  const filePath = await showSaveDialog(suggestedName || "set-list.abc", suggestedDir);
  if (!filePath) return false;
  return withFileLock(filePath, async () => {
    const res = await writeFile(filePath, content);
    if (res && res.ok) return true;
    await showSaveError((res && res.error) ? res.error : "Unable to export set list.");
    return false;
  });
}

async function outputSetListPrintMarkup({ type, svgMarkup, suggestedName } = {}) {
  if (!window.api) return null;
  if (type === "print" && typeof window.api.printDialog === "function") {
    return window.api.printDialog(svgMarkup, suggestedName);
  }
  if (type === "pdf" && typeof window.api.exportPdf === "function") {
    return window.api.exportPdf(svgMarkup, suggestedName);
  }
  if (type === "preview" && typeof window.api.printPreview === "function") {
    return window.api.printPreview(svgMarkup, suggestedName);
  }
  return null;
}

function showDisclaimerIfNeeded(settings) {
  if (disclaimerShown) return;
  if (!$disclaimerModal || !$disclaimerOk) return;
  if (!settings || settings.disclaimerSeen) return;
  disclaimerShown = true;
  $disclaimerModal.classList.add("open");
  $disclaimerModal.setAttribute("aria-hidden", "false");
}

async function dismissDisclaimer() {
  if (!$disclaimerModal) return;
  $disclaimerModal.classList.remove("open");
  $disclaimerModal.setAttribute("aria-hidden", "true");
  if (window.api && typeof window.api.updateSettings === "function") {
    await window.api.updateSettings({ disclaimerSeen: true });
  }
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function parseLengthString(lenStr) {
  if (!lenStr) return { num: 1, den: 1 };
  if (/^\/+$/.test(lenStr)) {
    return { num: 1, den: 2 ** lenStr.length };
  }
  if (/^\d+$/.test(lenStr)) {
    return { num: Number(lenStr), den: 1 };
  }
  const slashOnly = lenStr.match(/^(\d+)(\/+)$/);
  if (slashOnly) {
    const num = Number(slashOnly[1]);
    const den = 2 ** slashOnly[2].length;
    return { num, den };
  }
  const ratio = lenStr.match(/^(\d+)\/(\d+)$/);
  if (ratio) {
    return { num: Number(ratio[1]), den: Number(ratio[2]) };
  }
  const denomOnly = lenStr.match(/^\/(\d+)$/);
  if (denomOnly) {
    return { num: 1, den: Number(denomOnly[1]) };
  }
  const trailingSlash = lenStr.match(/^(\d+)\/$/);
  if (trailingSlash) {
    return { num: Number(trailingSlash[1]), den: 2 };
  }
  return null;
}

function formatLengthString(num, den) {
  if (den === 1) {
    return num === 1 ? "" : String(num);
  }
  if (num === 1) return `/${den}`;
  return `${num}/${den}`;
}

function scaleLengthString(lenStr, factorNum, factorDen) {
  const parsed = parseLengthString(lenStr);
  if (!parsed) return lenStr;
  let num = parsed.num * factorNum;
  let den = parsed.den * factorDen;
  const div = gcd(num, den);
  num /= div;
  den /= div;
  return formatLengthString(num, den);
}

	function scaleLengthsInLine(line, factorNum, factorDen) {
	  if (!line) return line;
	  if (/^\s*%/.test(line)) return line;
	  if (/^\s*[wW]:/.test(line)) return line;
	  if (/^\s*[A-Za-z]:/.test(line)) return line;

  let inQuote = false;
  let inGrace = false;
  let i = 0;
  let out = "";

  const pushChar = () => {
    out += line[i];
    i += 1;
  };

	  while (i < line.length) {
	    const ch = line[i];
	    // Skip decorations like !fermata! and +trill+ (and anything inside them).
	    if (!inQuote && !inGrace && (ch === "!" || ch === "+")) {
	      const next = line.indexOf(ch, i + 1);
	      if (next >= 0) {
	        out += line.slice(i, next + 1);
	        i = next + 1;
	        continue;
	      }
	    }
	    // Skip inline fields like [K:D] or [M:9/8] (but not chord brackets like [CEG]).
	    if (!inQuote && !inGrace && ch === "[" && /[A-Za-z]:/.test(line.slice(i + 1, i + 3))) {
	      const next = line.indexOf("]", i + 1);
	      if (next >= 0) {
	        out += line.slice(i, next + 1);
	        i = next + 1;
	        continue;
	      }
	    }
	    if (ch === "\"") {
	      inQuote = !inQuote;
	      pushChar();
	      continue;
	    }
    if (!inQuote && ch === "{") {
      inGrace = true;
      pushChar();
      continue;
    }
    if (inGrace && ch === "}") {
      inGrace = false;
      pushChar();
      continue;
    }
    if (!inQuote && !inGrace && ch === "%") {
      out += line.slice(i);
      break;
    }
    if (!inQuote && !inGrace) {
      let j = i;
      while (line[j] === "^" || line[j] === "_" || line[j] === "=") j += 1;
      if (/[A-Ga-gxzZ]/.test(line[j] || "")) {
        j += 1;
        while (line[j] === "," || line[j] === "'") j += 1;
        const lenStart = j;
        while (/[0-9/]/.test(line[j] || "")) j += 1;
        const lenStr = line.slice(lenStart, j);
        const scaled = scaleLengthString(lenStr, factorNum, factorDen);
        out += line.slice(i, lenStart) + scaled;
        i = j;
        continue;
      }
    }
    pushChar();
  }
  return out;
}

function adjustDefaultLengthLine(line, factorNum, factorDen) {
  const match = line.match(/^L:\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) return line;
  let num = Number(match[1]);
  let den = Number(match[2]);
  num *= factorNum;
  den *= factorDen;
  const div = gcd(num, den);
  num /= div;
  den /= div;
  return `L:${num}/${den}`;
}

function transformLengthScaling(text, mode) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const factorNum = mode === "double" ? 2 : 1;
  const factorDen = mode === "double" ? 1 : 2;
  const lFactorNum = mode === "double" ? 1 : 2;
  const lFactorDen = mode === "double" ? 2 : 1;
  const out = [];
  let i = 0;
  let inTextBlock = false;

  while (i < lines.length) {
    if (/^\s*%%\s*begintext\b/i.test(lines[i])) {
      inTextBlock = true;
    }
    if (inTextBlock) {
      out.push(lines[i]);
      if (/^\s*%%\s*endtext\b/i.test(lines[i])) inTextBlock = false;
      i += 1;
      continue;
    }
    if (!/^\s*X:/.test(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const start = i;
    i += 1;
    while (i < lines.length && !/^\s*X:/.test(lines[i])) i += 1;
    const block = lines.slice(start, i);
    let kIndex = -1;
    for (let j = 0; j < block.length; j += 1) {
      if (/^\s*K:/.test(block[j])) {
        kIndex = j;
        break;
      }
    }
    if (kIndex === -1) {
      out.push(...block);
      continue;
    }

    let hasL = false;
    for (let j = 0; j < kIndex; j += 1) {
      if (/^\s*L:/.test(block[j])) {
        block[j] = adjustDefaultLengthLine(block[j].trim(), lFactorNum, lFactorDen);
        hasL = true;
        break;
      }
    }
    if (!hasL) {
      const baseLine = adjustDefaultLengthLine("L:1/8", lFactorNum, lFactorDen);
      block.splice(kIndex, 0, baseLine);
      kIndex += 1;
    }

    for (let j = kIndex + 1; j < block.length; j += 1) {
      block[j] = scaleLengthsInLine(block[j], factorNum, factorDen);
    }
    out.push(...block);
  }
  return out.join("\n");
}

async function applyAbc2abcTransform(options) {
  const abcText = getEditorValue();
  if (!abcText.trim()) {
    setStatus("No notation to transform.");
    return;
  }
  if (options.doubleLengths && options.halfLengths) {
    await showSaveError("Choose either double or half note lengths, not both.");
    return;
  }
  const hasOnlyLengthTransform = (options.doubleLengths || options.halfLengths)
    && options.transposeSemitones == null
    && !options.measuresPerLine
    && !options.linebreakMarker
    && !options.voice
    && options.renumberX == null;
  if (hasOnlyLengthTransform) {
    const mode = options.doubleLengths ? "double" : "half";
    let transformed = transformLengthScaling(abcText, mode);
    if (latestSettingsSnapshot && latestSettingsSnapshot.autoAlignBarsAfterTransforms) {
      transformed = alignBarsInText(transformed);
    }
    applyTransformedText(transformed);
    setStatus("OK");
    return;
  }
  const hasOnlyMeasuresPerLine = options.measuresPerLine
    && options.transposeSemitones == null
    && !options.linebreakMarker
    && !options.voice
    && options.renumberX == null
    && !options.doubleLengths
    && !options.halfLengths;
  if (hasOnlyMeasuresPerLine) {
    let transformed = transformMeasuresPerLine(abcText, options.measuresPerLine);
    transformed = normalizeMeasuresLineBreaks(transformed);
    transformed = alignBarsInText(transformed);
    transformed = normalizeMeasuresLineBreaks(transformed);
    applyTransformedText(transformed);
    setStatus("OK");
    return;
  }
  const hasOnlyLinebreakMarker = options.linebreakMarker
    && options.transposeSemitones == null
    && !options.measuresPerLine
    && !options.voice
    && options.renumberX == null
    && !options.doubleLengths
    && !options.halfLengths;
  if (hasOnlyLinebreakMarker) {
    let transformed = transformMeasuresByLinebreakMarker(abcText);
    transformed = normalizeMeasuresLineBreaks(transformed);
    if (latestSettingsSnapshot && latestSettingsSnapshot.autoAlignBarsAfterTransforms) {
      transformed = alignBarsInText(transformed);
      transformed = normalizeMeasuresLineBreaks(transformed);
    }
    applyTransformedText(transformed);
    setStatus("OK");
    return;
  }
  const hasOnlyTranspose = options.transposeSemitones != null
    && !options.measuresPerLine
    && !options.linebreakMarker
    && !options.voice
    && options.renumberX == null
    && !options.doubleLengths
    && !options.halfLengths;
  if (hasOnlyTranspose) {
    const preferNative = !latestSettingsSnapshot || latestSettingsSnapshot.useNativeTranspose !== false;
    if (preferNative) {
      const preview = getAccumulatedTransposePreview({ currentText: abcText, currentHeaderText: getHeaderEditorValue() });
      const nextDelta = preview.delta + Number(options.transposeSemitones || 0);
      const headerText = preview.headerText;
      const support = getNativeTransposeSupport(preview.baseText, { headerText });
      if (!support.ok) {
        await showSaveError(support.reason || "Default transpose is not supported for this tune.");
        setStatus("Error");
        return;
      }
      try {
        const transformed = nextDelta === 0
          ? preview.baseText
          : transformTranspose(preview.baseText, nextDelta, { headerText });
        const aligned = (latestSettingsSnapshot && latestSettingsSnapshot.autoAlignBarsAfterTransforms)
          ? alignBarsInText(transformed)
          : transformed;
        setAccumulatedTransposePreview(preview.baseText, headerText, nextDelta);
        applyTransformedText(aligned, { resetTransposePreview: false });
        setStatus("OK");
        return;
      } catch (e) {
        logErr(`Native transpose failed.\n\n${(e && e.stack) ? e.stack : String(e)}`);
      }
    }
  }
  // Remaining combinations previously supported by abc2abc are intentionally not implemented here.
  // Keep strict-write behavior: refuse rather than risk corrupting data.
  await showSaveError("This transform combination is not supported.");
  setStatus("Error");
}

function formatConversionError(res) {
  if (!res) return "Unknown error.";
  const parts = [];
  if (res.error) parts.push(String(res.error));
  if (res.detail) parts.push(String(res.detail));
  if (!parts.length) return "Unknown error.";
  return parts.join("\n\n");
}

function deriveTitleFromPath(filePath) {
  if (!filePath) return "Imported tune";
  const name = safeBasename(filePath) || "Imported tune";
  const base = name.replace(/\.[^.]+$/, "");
  return base.trim() || "Imported tune";
}

function ensureTitleInAbc(abcText, fallbackTitle) {
  const text = String(abcText || "");
  if (!text.trim()) return text;
  if (/^T:/m.test(text)) return text;
  const title = fallbackTitle || "Imported tune";
  const lines = text.split(/\r\n|\n|\r/);
  const xIdx = lines.findIndex((line) => /^X:/.test(line));
  const insertIdx = xIdx >= 0 ? xIdx + 1 : 0;
  lines.splice(insertIdx, 0, `T:${title}`);
  return lines.join("\n");
}

function ensureCopyTitleInAbc(abcText) {
  const text = String(abcText || "");
  if (!text.trim()) return text;
  const lines = text.split(/\r\n|\n|\r/);
  const titleIdx = lines.findIndex((line) => /^T:/.test(line));
  const prefix = "(Copy) ";
  if (titleIdx >= 0) {
    const raw = lines[titleIdx].replace(/^T:\s*/, "").trim();
    if (/^\(copy\)\s*/i.test(raw)) return text;
    const title = raw || "Untitled";
    lines[titleIdx] = `T:${prefix}${title}`;
    return lines.join("\n");
  }
  const xIdx = lines.findIndex((line) => /^X:/.test(line));
  const insertIdx = xIdx >= 0 ? xIdx + 1 : 0;
  lines.splice(insertIdx, 0, `T:${prefix}Untitled`);
  return lines.join("\n");
}

async function confirmAbandonIfDirty(contextLabel) {
  const tuneDirty = Boolean(currentDoc && currentDoc.dirty);
  const hdrDirty = Boolean(headerDirty);
  const fileDirty = hasUnsavedChangesInActiveEditContext();
  if (!tuneDirty && !hdrDirty && !fileDirty) return true;

  const choice = await confirmUnsavedChanges(contextLabel);
  if (choice === "cancel") return false;
  if (choice === "dont_save") {
    // Explicit discard path: user chose not to save.
    headerDirty = false;
    updateHeaderStateUI();
    if (tuneDirty) {
      await discardWorkingCopyChangesForActiveFile();
    }
    return true;
  }

  const ok = rawMode ? await performRawSaveFlow() : await performSaveFlow();
  return Boolean(ok);
}

async function ensureSafeToAbandonCurrentDoc(actionLabel) {
  return confirmAbandonIfDirty(actionLabel);
}

		async function finalizeWorkingCopySave(filePath) {
		  const normalized = String(filePath || "");
		  if (!normalized) return false;

		  markDiskConflictPath(normalized, false);
		  if (currentDoc) {
		    currentDoc.dirty = false;
	    // Do not rewrite the editor buffer on Save.
	    // Replacing the entire doc (even with identical text) resets the selection/cursor to the start,
		    // which is disruptive while typing (Ctrl+S). The working copy snapshot/renderer already uses
		    // the live editor buffer; Save should only clear the dirty state.
		  }
		  resetTransposePreviewState();
		  setDirtyIndicator(false);

  try {
    const snapshot = await refreshWorkingCopySnapshot();
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, normalized)) {
      setFileContentInCache(normalized, snapshot.text);
      attachTuneUidsToLibraryFile(normalized, snapshot);
    }
  } catch {}

  try { await refreshLibraryFile(normalized, { force: true }); } catch {}
  updateLibraryStatus();
  scheduleRenderLibraryTree();
  scheduleAutoWcDump("save", normalized ? safeBasename(normalized) : "");
  return true;
}

async function handleMissingWorkingCopySave(filePath) {
  const p = String(filePath || "");
  if (!p) return { ok: false };
  if (!window.api || typeof window.api.confirmMissingOnDisk !== "function") return { ok: false };

  const choice = await window.api.confirmMissingOnDisk(p);
  if (choice === "recreate") {
    const forced = await window.api.commitWorkingCopyToDisk({ force: true });
    if (forced && forced.ok) {
      await finalizeWorkingCopySave(p);
      return { ok: true, path: p, action: "recreate" };
    }
    await showSaveError((forced && forced.error) ? forced.error : "Unable to recreate missing file.");
    return { ok: false };
  }
  if (choice === "save_as") {
    const ok = await performSaveAsFlow();
    if (!ok) return { ok: false };
    const snap = await refreshWorkingCopySnapshot();
    const nextPath = snap && snap.path ? String(snap.path) : "";
    return { ok: true, path: nextPath || p, action: "save_as" };
  }
  return { ok: false, cancelled: true };
}

async function performSaveFlow() {
  if (!currentDoc) return false;
  const session = resolveSaveSession();

  recordRecentAction("save.start", {
    currentDocPath: currentDoc && currentDoc.path ? String(currentDoc.path) : null,
    currentDocDirty: currentDoc ? Boolean(currentDoc.dirty) : null,
    headerDirty: Boolean(headerDirty),
    isNewTuneDraft: Boolean(isNewTuneDraft),
    activeTunePath: activeTuneMeta && activeTuneMeta.path ? String(activeTuneMeta.path) : null,
    wcSnapshotPath: workingCopySnapshot && workingCopySnapshot.path ? String(workingCopySnapshot.path) : null,
    payloadMode: Boolean(isPayloadMode()),
    rawMode: Boolean(rawMode),
    focusMode: Boolean(focusModeEnabled),
    saveIntent: session.intent,
    saveTargetPath: session.targetPath || null,
    saveSource: session.source || null,
  });

  const headerTargetPath = String(
    session.targetPath
    || activeFilePath
    || (activeTuneMeta && activeTuneMeta.path)
    || ""
  );
  const combineHeaderWithWorkingCopySave = Boolean(
    headerDirty
    && headerTargetPath
    && session.intent === SAVE_INTENT.REPLACE_TUNE
    && activeTuneMeta
    && activeTuneMeta.path
    && pathsEqual(activeTuneMeta.path, headerTargetPath)
  );
  if (headerDirty && headerTargetPath && !combineHeaderWithWorkingCopySave) {
    try {
      const headerRes = await saveFileHeaderText(headerTargetPath, getHeaderEditorValue());
      if (headerRes && headerRes.ok) {
        headerDirty = false;
        updateHeaderStateUI();
        setStatus(headerRes.action === "save_copy_as" ? "Saved copy and switched." : "Header saved.");
      } else if (headerRes && headerRes.action === "discard_reload") {
        headerEditorFilePath = null;
        headerDirty = false;
        updateHeaderStateUI();
        updateFileHeaderPanel();
        setStatus("Reloaded from disk.");
        return false;
      } else {
        setStatus("Save canceled.");
        updateHeaderStateUI();
        return false;
      }
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
      updateHeaderStateUI();
      return false;
    }
  }

  if (chordProFeature.isEnabled()) {
    const filePath = activeFilePath || (currentDoc && currentDoc.path) || "";
    if (!filePath) return performSaveAsFlow();
    const wcOk = await ensureWorkingCopyOpenForPath(filePath);
    if (!wcOk) {
      await showSaveError("Unable to save file: no working copy open.");
      return false;
    }
    await refreshWorkingCopySnapshot();
    try {
      await flushWorkingCopyFullSync();
    } catch {}
    if (window.api && typeof window.api.commitWorkingCopyToDisk === "function") {
      const res = await window.api.commitWorkingCopyToDisk({ force: false });
      if (res && res.missingOnDisk) {
        const handled = await handleMissingWorkingCopySave(filePath);
        return Boolean(handled && handled.ok);
      }
      if (res && res.ok) {
        markDiskConflictPath(filePath, false);
        const snap = await refreshWorkingCopySnapshot();
        if (snap && snap.path && pathsEqual(snap.path, filePath)) {
          setFileContentInCache(filePath, snap.text);
        }
        if (currentDoc) currentDoc.dirty = false;
        setDirtyIndicator(false);
        updateWindowTitle();
        return true;
      }
      if (res && res.conflict) {
        const forced = await window.api.commitWorkingCopyToDisk({ force: true });
        if (forced && forced.ok) {
          markDiskConflictPath(filePath, false);
          const snap = await refreshWorkingCopySnapshot();
          if (snap && snap.path && pathsEqual(snap.path, filePath)) {
            setFileContentInCache(filePath, snap.text);
          }
          if (currentDoc) currentDoc.dirty = false;
          setDirtyIndicator(false);
          updateWindowTitle();
          return true;
        }
        markDiskConflictPath(filePath, true);
        await showSaveError((forced && forced.error) ? forced.error : "Unable to save file.");
        return false;
      }
      await showSaveError((res && res.error) ? res.error : "Unable to save file.");
      return false;
    }
    await showSaveError("Internal error: working copy save is unavailable.");
    return false;
  }

  if (session.intent === SAVE_INTENT.APPEND_TO_FILE && session.targetPath) {
    activeFilePath = String(session.targetPath);
    const ok = await performAppendFlow();
    return Boolean(ok);
  }

  if (session.intent === SAVE_INTENT.REPLACE_TUNE && activeTuneMeta && activeTuneMeta.path) {
    const ok = await performSimpleTuneSave(activeTuneMeta.path, {
      includeHeader: Boolean(combineHeaderWithWorkingCopySave && headerDirty),
    });
    return Boolean(ok);
  }

  if (session.intent === SAVE_INTENT.FULL_FILE && currentDoc.path) {
    const filePath = currentDoc.path;
    if (isWorkingCopyOpenForFile(filePath)) {
      await showSaveError("Internal error: the file is open in the editor. Save via the working copy.");
      return false;
    }
    const content = serializeDocument(currentDoc);
    return withFileLock(filePath, async () => {
      const res = await writeFile(filePath, content);
      if (res.ok) {
        setFileContentInCache(filePath, content);
        currentDoc.dirty = false;
        resetTransposePreviewState();
        setDirtyIndicator(false);
        setFileNameMeta(stripFileExtension(safeBasename(filePath)));
        updateFileHeaderPanel();
        return true;
      }
      await showSaveError(res.error || "Unable to save file.");
      return false;
    });
  }

  if (session.intent === SAVE_INTENT.REPLACE_TUNE && (!activeTuneMeta || !activeTuneMeta.path)) {
    await showSaveError("Unable to save: tune context is missing. Re-open the tune and try again.");
    return false;
  }
  if (session.intent === SAVE_INTENT.APPEND_TO_FILE && !session.targetPath) {
    await showSaveError("Unable to save: append target is missing. Select/open the target file and try again.");
    return false;
  }

  return performSaveAsFlow();
}

async function performSaveAsFlow() {
  if (!currentDoc) return false;

  if (chordProFeature.isEnabled()) {
    try {
      await flushWorkingCopyFullSync();
    } catch {}

    const currentPath = activeFilePath || (currentDoc && currentDoc.path) || "";
    const base = currentPath ? safeBasename(currentPath) : "";
    const extMatch = base.match(/(\.[^.]+)$/);
    const suffix = extMatch ? extMatch[1] : ".cho";
    const suggestedName = `${stripFileExtension(base || "untitled")}${suffix}`;
    const suggestedDir = getDefaultSaveDir();
    const filePath = await showSaveDialog(suggestedName, suggestedDir);
    if (!filePath) return false;

    const hasWorkingCopy = Boolean(
      currentPath
      && isWorkingCopyOpenForFile(currentPath)
      && window.api
      && typeof window.api.writeWorkingCopyToPathAndSwitch === "function"
    );
    if (!hasWorkingCopy) {
      const content = String((chordProFeature.isFullView() ? getEditorValue() : chordProFeature.getFullText()) || "");
      const saved = await createNewFileAtPath(filePath, content, { confirmOverwrite: false });
      if (!saved) return false;
	      currentDoc.path = filePath;
	      currentDoc.dirty = false;
	      resetTransposePreviewState();
	      activeFilePath = filePath;
      recordNavFilePath(filePath);
      setFileNameMeta(stripFileExtension(safeBasename(filePath)));
      updateWindowTitle();
      return true;
    }

    if (await fileExists(filePath)) {
      const ok = await confirmOverwrite(filePath);
      if (!ok) return false;
    }
    const out = await window.api.writeWorkingCopyToPathAndSwitch(filePath);
    if (!out || !out.ok) {
      await showSaveError((out && out.error) ? out.error : "Unable to save file.");
      return false;
    }
    const snap = await refreshWorkingCopySnapshot();
    if (snap && snap.path && pathsEqual(snap.path, filePath)) {
      setFileContentInCache(filePath, snap.text);
    }
	    currentDoc.path = filePath;
	    currentDoc.dirty = false;
	    resetTransposePreviewState();
	    activeFilePath = filePath;
    recordNavFilePath(filePath);
    setDirtyIndicator(false);
    setFileNameMeta(stripFileExtension(safeBasename(filePath)));
    updateWindowTitle();
    return true;
  }

  try {
    await flushWorkingCopyTuneSync();
  } catch {}
  if (headerDirty && window.api && typeof window.api.applyWorkingCopyHeaderText === "function") {
    try {
      const res = await window.api.applyWorkingCopyHeaderText(getHeaderEditorValue());
      if (res && res.ok) {
        headerDirty = false;
        updateHeaderStateUI();
      }
    } catch {}
  }

  const suggestedName = `${getSuggestedBaseName()}.abc`;
  const suggestedDir = getDefaultSaveDir();
  const filePath = await showSaveDialog(suggestedName, suggestedDir);
  if (!filePath) return false;

  const hasWorkingCopy = Boolean(
    activeTuneMeta
    && activeTuneMeta.path
    && workingCopySnapshot
    && workingCopySnapshot.path
    && pathsEqual(workingCopySnapshot.path, activeTuneMeta.path)
    && window.api
    && typeof window.api.writeWorkingCopyToPath === "function"
  );
  if (!hasWorkingCopy) {
    const content = serializeDocument(currentDoc);
    const saved = await createNewFileAtPath(filePath, content, { confirmOverwrite: false });
    if (!saved) return false;
    const root = libraryIndex && libraryIndex.root ? normalizeLibraryPath(libraryIndex.root) : "";
    const normalizedDest = normalizeLibraryPath(filePath);
    const inRoot = Boolean(
      root
      && (normalizedDest === root || normalizedDest.startsWith(root.endsWith("/") ? root : `${root}/`))
    );
    if (!inRoot) {
      const dirPath = safeDirname(filePath);
      showToastWithAction(
        "Saved file outside current Library.",
        "Load folder…",
        () => { loadLibraryFromFolder(dirPath).catch(() => {}); },
        8000
      );
    }
    setFileContentInCache(filePath, content);
    currentDoc.path = filePath;
    currentDoc.dirty = false;
    setDirtyIndicator(false);
    setFileNameMeta(stripFileExtension(safeBasename(filePath)));
    updateFileHeaderPanel();
    updateWindowTitle();
    return true;
  }

  // Working Copy path: Save the whole file (header + all tunes), atomically, then switch to it.
  if (await fileExists(filePath)) {
    const ok = await confirmOverwrite(filePath);
    if (!ok) return false;
  }
  const out = await window.api.writeWorkingCopyToPath(filePath);
  if (!out || !out.ok) {
    await showSaveError((out && out.error) ? out.error : "Unable to save file.");
    return false;
  }
  try {
    await refreshLibraryFile(filePath, { force: true });
  } catch {}

  const switched = await loadLibraryFileIntoEditor(filePath);
  if (switched && switched.ok) {
    const root = libraryIndex && libraryIndex.root ? normalizeLibraryPath(libraryIndex.root) : "";
    const normalizedDest = normalizeLibraryPath(filePath);
    const inRoot = Boolean(
      root
      && (normalizedDest === root || normalizedDest.startsWith(root.endsWith("/") ? root : `${root}/`))
    );
    if (!inRoot) {
      const dir = safeDirname(filePath);
      showToastWithAction(
        "Saved file outside current Library.",
        "Load folder…",
        () => { loadLibraryFromFolder(dir).catch(() => {}); },
        8000
      );
    }
    return true;
  }
  return true;
}

function appendTuneToContent(existingContent, tuneText) {
  const existing = existingContent || "";
  const tune = String(tuneText || "").replace(/\s+$/, "");
  if (!existing.trim()) return `${tune}\n`;
  let separator = "\n\n";
  if (existing.endsWith("\n\n")) separator = "";
  else if (existing.endsWith("\n")) separator = "\n";
  return `${existing}${separator}${tune}\n`;
}

function dropLibraryFileEntry(filePath) {
  const p = filePath ? String(filePath) : "";
  if (!p || !libraryIndex || !Array.isArray(libraryIndex.files)) return false;
  const idx = libraryIndex.files.findIndex((f) => pathsEqual(f && f.path, p));
  if (idx >= 0) {
    libraryIndex.files.splice(idx, 1);
    libraryViewStore.invalidate();
  }
  if (activeFilePath && pathsEqual(activeFilePath, p)) activeFilePath = null;
  if (activeTuneMeta && pathsEqual(activeTuneMeta.path, p)) {
    activeTuneMeta = null;
    activeTuneId = null;
    activeTuneUid = null;
    activeTuneIndex = null;
  }
  if (currentDoc && currentDoc.path && pathsEqual(currentDoc.path, p)) {
    currentDoc.path = null;
    currentDoc.content = "";
    currentDoc.dirty = false;
  }
  setDirtyIndicator(false);
  updateLibraryStatus();
  scheduleRenderLibraryTree();
  return true;
}

function getNextXNumber(existingContent) {
  let max = 0;
  const re = /^\s*X:\s*(\d+)/gm;
  let match;
  const text = String(existingContent || "");
  while ((match = re.exec(text)) !== null) {
    const num = Number(match[1]);
    if (Number.isFinite(num)) max = Math.max(max, num);
  }
  return max + 1;
}

function ensureXNumberInAbc(abcText, xNumber) {
  const text = String(abcText || "");
  if (!text.trim()) return text;
  const lines = text.split(/\r\n|\n|\r/);
  const idx = lines.findIndex((line) => /^\s*X:/.test(line));
  const line = `X:${xNumber}`;
  if (idx >= 0) {
    const rawLine = String(lines[idx] || "");
    const prefix = rawLine.match(/^(\s*)X:/) ? RegExp.$1 : "";
    const normalizedX = `${prefix}${line}`;
    // Normalize appended tunes to X-first form. Any preamble lines before X
    // are preserved after X so tune segmentation stays deterministic.
    return [normalizedX, ...lines.slice(0, idx), ...lines.slice(idx + 1)].join("\n");
  }
  lines.unshift(line);
  return lines.join("\n");
}

function renumberXLinesConsecutive(fullText) {
  const text = String(fullText || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r\n|\n|\r/);
  let foundAny = false;
  let n = 0;
  const out = [];
  for (const line of lines) {
    const match = String(line || "").match(/^(\s*X:\s*)(.*)$/);
    if (!match) {
      out.push(line);
      continue;
    }
    foundAny = true;
    n += 1;
    const prefix = match[1] || "X:";
    out.push(`${prefix}${n}`);
  }
  if (!foundAny) return { ok: false, error: "No X: headers found in file." };
  return { ok: true, text: out.join(newline), count: n };
}

function removeTuneFromContent(content, startOffset, endOffset) {
  let before = content.slice(0, startOffset);
  let after = content.slice(endOffset);
  if (/\r?\n$/.test(before) && /^\r?\n/.test(after)) {
    after = after.replace(/^\r?\n/, "");
  }
  return before + after;
}

async function refreshLibraryFile(filePath, options) {
  if (!window.api || typeof window.api.parseLibraryFile !== "function") return null;
  if (!await fileExists(filePath)) {
    // If the file is currently open as a working copy, keep the editor session authoritative
    // and let Save handle the "missing on disk" decision.
    if (!isWorkingCopyOpenForFile(filePath)) {
      dropLibraryFileEntry(filePath);
    }
    return null;
  }
  const res = await window.api.parseLibraryFile(filePath, options);
  if (!res || !res.files || !res.files.length) return null;
  const updatedFile = res.files[0];
  if (!libraryIndex) {
    libraryIndex = { root: res.root, files: [updatedFile] };
    libraryViewStore.invalidate();
  } else {
    const idx = libraryIndex.files.findIndex((f) => pathsEqual(f.path, updatedFile.path));
    if (idx >= 0) libraryIndex.files[idx] = updatedFile;
    else libraryIndex.files.push(updatedFile);
    libraryViewStore.invalidate();
  }

  // If this file is the active working copy, immediately attach tuneUid/tuneIndex so
  // tune selection can reliably slice from `workingCopySnapshot.text` (not stale disk/cache).
  try {
    if (
      workingCopySnapshot
      && workingCopySnapshot.path
      && pathsEqual(workingCopySnapshot.path, updatedFile.path)
    ) {
      attachTuneUidsToLibraryFile(updatedFile.path, workingCopySnapshot);
    }
  } catch {}

  renderLibraryTree();
  updateFileContext();
  updateFileHeaderPanel();
  return updatedFile;
}

async function renameLibraryFile(oldPath, newPath) {
  if (!window.api || typeof window.api.parseLibraryFile !== "function") return null;
  const res = await window.api.parseLibraryFile(newPath);
  if (!res || !res.files || !res.files.length) return null;
  const updatedFile = res.files[0];
  if (!libraryIndex) {
    libraryIndex = { root: res.root, files: [updatedFile] };
    libraryViewStore.invalidate();
  } else {
    libraryIndex.files = (libraryIndex.files || []).filter((f) => !pathsEqual(f.path, oldPath));
    libraryIndex.files.push(updatedFile);
    libraryViewStore.invalidate();
  }

  if (fileContentCache.has(oldPath)) {
    const cached = getFileContentFromCache(oldPath);
    if (cached != null) {
      setFileContentInCache(newPath, cached);
      fileContentCache.delete(oldPath);
    }
  }

  if (pathsEqual(activeFilePath, oldPath)) activeFilePath = newPath;

  if (activeTuneMeta && pathsEqual(activeTuneMeta.path, oldPath)) {
    activeTuneMeta.path = newPath;
    const tune = (updatedFile.tunes || []).find((t) => t.startOffset === activeTuneMeta.startOffset);
    if (tune) {
      activeTuneId = tune.id;
      activeTuneMeta.xNumber = tune.xNumber;
      activeTuneMeta.title = tune.title || "";
      activeTuneMeta.composer = tune.composer || "";
      activeTuneMeta.key = tune.key || "";
    } else {
      activeTuneId = `${newPath}::${activeTuneMeta.startOffset}`;
    }
    setTuneMetaText(buildTuneMetaLabel(activeTuneMeta));
    setFileNameMeta(stripFileExtension(updatedFile.basename || ""));
    markActiveTuneButton(activeTuneId);
  }

  renderLibraryTree();
  updateFileHeaderPanel();
  return updatedFile;
}

async function saveFileHeaderText(filePath, headerText) {
  const p = String(filePath || "");
  if (!p) throw new Error("Missing file path.");
  if (
    !window.api
    || typeof window.api.openWorkingCopy !== "function"
    || typeof window.api.applyWorkingCopyHeaderText !== "function"
    || typeof window.api.commitWorkingCopyToDisk !== "function"
  ) {
    throw new Error("Working copy header save is unavailable.");
  }

  return withFileLock(p, async () => {
    await window.api.openWorkingCopy(p);
    const applyRes = await window.api.applyWorkingCopyHeaderText(String(headerText || ""));
    if (!applyRes || !applyRes.ok) throw new Error((applyRes && applyRes.error) ? applyRes.error : "Unable to update header.");

    const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
    if (saveRes && saveRes.missingOnDisk) {
      const handled = await handleMissingWorkingCopySave(p);
      if (handled && handled.ok) return { ok: true, action: "saved" };
      return { ok: false, action: "cancel" };
    }
    if (!saveRes || !saveRes.ok) {
      if (saveRes && saveRes.conflict) {
        const tuneIdToRestore = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
        const resolved = await resolveWorkingCopySaveConflictDefault(p, { restoreTuneId: tuneIdToRestore });
        if (resolved && resolved.ok && resolved.action === "overwrite") {
          // continue below (post-save snapshot/refresh)
        } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
          return { ok: true, action: "save_copy_as" };
        } else {
          if (resolved && resolved.error) throw new Error(resolved.error);
          if (resolved && resolved.action === "discard_reload") return { ok: false, action: "discard_reload" };
          return { ok: false, cancelled: true, action: "cancel" };
        }
      } else {
        throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save header.");
      }
    }

    markDiskConflictPath(p, false);
    const snapshot = await refreshWorkingCopySnapshot();
    if (snapshot && snapshot.path && pathsEqual(snapshot.path, p)) {
      setFileContentInCache(p, snapshot.text);
      attachTuneUidsToLibraryFile(p, snapshot);
    }
    // Re-parse from disk to update the library header text. This is the most reliable source of truth
    // for UI, and avoids depending on WC segmentation heuristics for where the header ends.
    const updatedFile = await refreshLibraryFile(p, { force: true });
    try {
      // Mark the header editor clean after successful save.
      if (updatedFile && updatedFile.path && pathsEqual(updatedFile.path, p) && headerEditorFilePath && pathsEqual(headerEditorFilePath, p)) {
        headerDirty = false;
        updateHeaderStateUI();
      }
    } catch {}
    if (activeTuneMeta && pathsEqual(activeTuneMeta.path, p)) {
      const tuneIdToRestore = rawMode ? activeTuneId : (activeTuneUid || activeTuneId);
      if (tuneIdToRestore) await selectTune(tuneIdToRestore, { skipConfirm: true, suppressRecent: true });
      const label = updatedFile ? updatedFile.basename : safeBasename(p);
      setFileNameMeta(stripFileExtension(label || ""));
    }
    return { ok: true, action: "saved" };
  });
}

function findTuneById(tuneId) {
  if (!libraryIndex || !tuneId) return null;
  for (const file of libraryIndex.files) {
    const tune = file.tunes.find((t) => t.id === tuneId);
    if (tune) return { tune, file };
  }
  return null;
}

async function getTuneText(tune, fileMeta) {
  if (
    fileMeta
    && fileMeta.path
    && workingCopySnapshot
    && workingCopySnapshot.path
    && pathsEqual(workingCopySnapshot.path, fileMeta.path)
  ) {
    const entry = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
      tuneUid: tune && tune.tuneUid,
      tuneIndex: tune && tune.tuneIndex,
      startOffset: tune && tune.startOffset,
    });
    if (entry && Number.isFinite(Number(entry.start)) && Number.isFinite(Number(entry.end))) {
      const text = String(workingCopySnapshot.text || "");
      setFileContentInCache(fileMeta.path, text);
      return text.slice(entry.start, entry.end);
    }
  }
  let content = getFileContentFromCache(fileMeta.path);
  if (content == null) {
    const res = await readFile(fileMeta.path);
    if (!res.ok) throw new Error(res.error || "Unable to read file.");
    content = res.data;
    setFileContentInCache(fileMeta.path, content);
  }
  return content.slice(tune.startOffset, tune.endOffset);
}

async function copyTuneById(tuneId, mode) {
  const res = findTuneById(tuneId);
  if (!res) return;
  try {
    const text = await getTuneText(res.tune, res.file);
    clipboardTune = {
      text,
      sourcePath: res.file.path,
      tuneId,
      tuneUid: res.tune ? res.tune.tuneUid || null : null,
      tuneIndex: Number.isFinite(Number(res.tune && res.tune.tuneIndex)) ? Number(res.tune.tuneIndex) : null,
      startOffset: Number.isFinite(Number(res.tune && res.tune.startOffset)) ? Number(res.tune.startOffset) : null,
      mode,
    };
    setStatus(mode === "move" ? "Tune cut to buffer." : "Tune copied to buffer.");
    setBufferStatus(mode === "move" ? "Buffer: cut tune" : "Buffer: copied tune");
  } catch (e) {
    await showSaveError(e && e.message ? e.message : String(e));
  }
}

async function duplicateTuneById(tuneId) {
  const res = findTuneById(tuneId);
  if (!res) return;
  if (!(await requireCleanForFileOp(res.file.path, "duplicating a tune"))) return;
  try {
    if (
      isWorkingCopyOpenForFile(res.file.path)
      && window.api
      && typeof window.api.openWorkingCopy === "function"
      && typeof window.api.insertWorkingCopyTuneAfter === "function"
      && typeof window.api.renumberWorkingCopyXStartingAt1 === "function"
      && typeof window.api.commitWorkingCopyToDisk === "function"
    ) {
      await window.api.openWorkingCopy(res.file.path);
      let snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path) || !Array.isArray(snapshot.tunes)) {
        throw new Error("Unable to access working copy for duplication.");
      }
      attachTuneUidsToLibraryFile(res.file.path, snapshot);

      // Resolve tuneIndex against the working copy snapshot.
      let tuneIndex = Number.isFinite(Number(res.tune.tuneIndex)) ? Number(res.tune.tuneIndex) : null;
      if (tuneIndex == null) {
        const startOff = Number.isFinite(Number(res.tune.startOffset)) ? Number(res.tune.startOffset) : null;
        if (startOff != null) {
          const idx = snapshot.tunes.findIndex((t) => t && Number(t.start) === startOff);
          if (idx >= 0) tuneIndex = idx;
        }
      }
      if (tuneIndex == null || tuneIndex < 0 || tuneIndex >= snapshot.tunes.length) {
        throw new Error("Unable to duplicate: tune index not found.");
      }

      const wcTune = snapshot.tunes[tuneIndex];
      const start = Number(wcTune.start);
      const end = Number(wcTune.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Unable to duplicate: tune slice is invalid.");
      const slice = String(snapshot.text || "").slice(start, end);
      const prepared = ensureCopyTitleInAbc(slice);

      const insertRes = await window.api.insertWorkingCopyTuneAfter({ afterTuneIndex: tuneIndex, text: prepared });
      if (!insertRes || !insertRes.ok) throw new Error((insertRes && insertRes.error) ? insertRes.error : "Unable to duplicate tune.");

      snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path) || !Array.isArray(snapshot.tunes)) {
        throw new Error("Unable to refresh working copy after duplication.");
      }
      const insertedUid = (snapshot.tunes[tuneIndex + 1] && snapshot.tunes[tuneIndex + 1].tuneUid)
        ? snapshot.tunes[tuneIndex + 1].tuneUid
        : null;

      const renRes = await window.api.renumberWorkingCopyXStartingAt1();
      if (!renRes || !renRes.ok) throw new Error((renRes && renRes.error) ? renRes.error : "Unable to renumber file after duplication.");

      snapshot = await refreshWorkingCopySnapshot();
      if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, res.file.path)) {
        throw new Error("Unable to refresh working copy after renumber.");
      }

      let saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          const forced = await window.api.commitWorkingCopyToDisk({ force: true });
          if (forced && forced.ok) {
            markDiskConflictPath(res.file.path, false);
            saveRes = forced;
          } else {
            markDiskConflictPath(res.file.path, true);
            throw new Error((forced && forced.error) ? forced.error : "Unable to save file after duplication.");
          }
        }
      }
      if (!saveRes || !saveRes.ok) {
        throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save file after duplication.");
      }

      setFileContentInCache(res.file.path, snapshot.text);
      syncLibraryFileFromWorkingCopySnapshot(res.file.path, snapshot);
      await refreshLibraryFile(res.file.path, { force: true });
      activeFilePath = res.file.path;
      if (insertedUid) {
        await selectTune(insertedUid, { skipConfirm: true, suppressRecent: true });
      }
      setStatus("OK");
      return;
    }

    const updated = await withFileLock(res.file.path, async () => {
      const readRes = await readFile(res.file.path);
      if (!readRes || !readRes.ok) throw new Error(readRes && readRes.error ? readRes.error : "Unable to read file.");
      const content = String(readRes.data || "");
      const verifyRes = await readFile(res.file.path);
      if (!verifyRes || !verifyRes.ok) throw new Error(verifyRes && verifyRes.error ? verifyRes.error : "Unable to verify file.");
      if (String(verifyRes.data || "") !== content) {
        throw new Error("Refusing to duplicate: file changed on disk. Refresh/reopen the file and try again.");
      }
      const startOffset = Number(res.tune.startOffset);
      const endOffset = Number(res.tune.endOffset);
      if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > content.length) {
        throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
      }
      const slice = content.slice(startOffset, endOffset);
      const trimmed = slice.replace(/^\s+/, "");
      if (!/^\s*X:/.test(trimmed)) {
        throw new Error("Refusing to duplicate: tune offsets look stale. Refresh the library and try again.");
      }

      const newline = content.includes("\r\n") ? "\r\n" : "\n";
      let before = content.slice(0, endOffset);
      let after = content.slice(endOffset);
      let prepared = ensureCopyTitleInAbc(slice);
      if (prepared && !/\r?\n$/.test(prepared)) prepared += newline;
      if (before && !/\r?\n$/.test(before)) before += newline;
      if (/^\r?\n/.test(prepared) && /\r?\n$/.test(before)) prepared = prepared.replace(/^\r?\n/, "");
      if (/^\r?\n/.test(after) && /\r?\n$/.test(prepared)) after = after.replace(/^\r?\n/, "");

      const inserted = `${before}${prepared}${after}`;
      const renum = renumberXInTextKeepingFirst(inserted);
      if (!renum || !renum.ok || typeof renum.abcText !== "string") {
        throw new Error("Unable to renumber file after duplicating a tune.");
      }
      const updatedContent = renum.abcText;
      const writeRes = await writeFile(res.file.path, updatedContent);
      if (!writeRes || !writeRes.ok) throw new Error(writeRes && writeRes.error ? writeRes.error : "Unable to duplicate tune.");
      setFileContentInCache(res.file.path, updatedContent);
      const updatedFile = await refreshLibraryFile(res.file.path, { force: true });
      return { updatedContent, updatedFile };
    });
    const updatedContent = updated ? updated.updatedContent : null;
    const updatedFile = updated ? updated.updatedFile : null;
    activeFilePath = res.file.path;
    if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
      const fallbackOriginalIdx = Number.isFinite(Number(res.tune.indexInFile)) ? Number(res.tune.indexInFile) - 1 : null;
      const originalIdx = fallbackOriginalIdx != null
        ? fallbackOriginalIdx
        : (Array.isArray(res.file.tunes) ? res.file.tunes.findIndex((t) => t && t.id === res.tune.id) : -1);
      const duplicateIdx = originalIdx >= 0 ? originalIdx + 1 : -1;
      const tune = (duplicateIdx >= 0 && duplicateIdx < updatedFile.tunes.length)
        ? updatedFile.tunes[duplicateIdx]
        : updatedFile.tunes[updatedFile.tunes.length - 1];
      activeTuneId = tune.id;
      markActiveTuneButton(activeTuneId);
      const tuneText = updatedContent ? updatedContent.slice(tune.startOffset, tune.endOffset) : "";
      setActiveTuneText(tuneText, {
        id: tune.id,
        path: updatedFile.path,
        basename: updatedFile.basename,
        xNumber: tune.xNumber,
        title: tune.title || "",
        composer: tune.composer || "",
        key: tune.key || "",
        startLine: tune.startLine,
        endLine: tune.endLine,
        startOffset: tune.startOffset,
        endOffset: tune.endOffset,
      });
    }
    setStatus("OK");
  } catch (e) {
    await showSaveError(e && e.message ? e.message : String(e));
  }
}

async function appendTuneTextToFileUnlocked(filePath, text) {
  const activePath = getActiveEditFilePath();
  if (hasGlobalUnsavedChanges() && activePath && !pathsEqual(activePath, filePath)) {
    throw new Error("Please Save/Discard your current changes before modifying other files.");
  }
  if (isWorkingCopyOpenForFile(filePath)) {
    throw new Error("Refusing to append: file is open in the editor. Save/close it first.");
  }
  const res = await readFile(filePath);
  if (!res.ok) throw new Error(res.error || "Unable to read file.");
  const before = String(res.data || "");
  const verifyRes = await readFile(filePath);
  if (!verifyRes || !verifyRes.ok) throw new Error((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify file before appending.");
  const verifyText = String(verifyRes.data || "");
  if (verifyText !== before) throw new Error("Refusing to append: file changed on disk. Refresh/reopen the file and try again.");
  const nextX = getNextXNumber(res.data || "");
  const prepared = ensureXNumberInAbc(text, nextX);
  const updated = appendTuneToContent(before, prepared);
  const writeRes = await writeFile(filePath, updated);
  if (!writeRes.ok) throw new Error(writeRes.error || "Unable to append to file.");
  setFileContentInCache(filePath, updated);
  return updated;
}

async function appendTuneTextToFile(filePath, text) {
  return withFileLock(filePath, async () => appendTuneTextToFileUnlocked(filePath, text));
}

async function pasteClipboardToFile(targetPath) {
  if (!clipboardTune || !clipboardTune.text) {
    await showSaveError("Nothing to paste yet.");
    return;
  }
  if (!targetPath) {
    await showSaveError("Select a target file in the Library panel first.");
    return;
  }
  if (!(await requireCleanForFileOp(targetPath, clipboardTune && clipboardTune.mode === "move" ? "moving a tune" : "pasting a tune"))) {
    return;
  }
  if (clipboardTune.sourcePath && clipboardTune.sourcePath === targetPath) {
    await showSaveError("Target file is the same as source.");
    return;
  }

  if (clipboardTune.mode === "move") {
    const sourcePath = clipboardTune.sourcePath ? String(clipboardTune.sourcePath) : "";
    if (!sourcePath) {
      await showSaveError("Unable to move: source path missing.");
      return;
    }
    if (sourcePath === targetPath) {
      await showSaveError("Target file is the same as source.");
      return;
    }
    if (!(await requireCleanForFileOp(sourcePath, "moving a tune"))) return;

    const found = findTuneById(clipboardTune.tuneId);
    if (!found || !found.file || !found.file.path) {
      await showSaveError("Unable to move: source tune not found. Refresh the library and try again.");
      return;
    }
  }

  const confirm = await confirmAppendToFile(targetPath);
  if (confirm !== "append") return;

  try {
    const sourceCandidate = clipboardTune && clipboardTune.mode === "move" ? clipboardTune.sourcePath : "";
    await withFileLocks([targetPath, sourceCandidate].filter(Boolean), async () => {
      if (clipboardTune.mode !== "move") {
        if (
          isWorkingCopyOpenForFile(targetPath)
          && window.api
          && typeof window.api.openWorkingCopy === "function"
          && typeof window.api.insertWorkingCopyTuneAfter === "function"
          && typeof window.api.commitWorkingCopyToDisk === "function"
        ) {
          await window.api.openWorkingCopy(targetPath);
          const snap = await refreshWorkingCopySnapshot();
          if (!snap || !snap.path || !pathsEqual(snap.path, targetPath)) {
            throw new Error("Unable to open working copy for pasting.");
          }
          const nextX = getNextXNumber(String(snap.text || ""));
          const prepared = ensureXNumberInAbc(String(clipboardTune.text || ""), nextX);
          const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;
          const ins = await window.api.insertWorkingCopyTuneAfter({ afterTuneIndex, text: prepared });
          if (!ins || !ins.ok) throw new Error((ins && ins.error) ? ins.error : "Unable to paste.");
          const saved = await window.api.commitWorkingCopyToDisk({ force: false });
          if (!saved || !saved.ok) {
            if (saved && saved.conflict) throw new Error("Refusing to paste: file changed on disk. Reload/reopen and try again.");
            throw new Error((saved && saved.error) ? saved.error : "Unable to save file.");
          }
          const snapAfter = await refreshWorkingCopySnapshot();
          if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, targetPath)) {
            setFileContentInCache(targetPath, snapAfter.text);
            syncLibraryFileFromWorkingCopySnapshot(targetPath, snapAfter);
          }
          await refreshLibraryFile(targetPath, { force: true });
          activeFilePath = targetPath;
          return;
        }
        await appendTuneTextToFileUnlocked(targetPath, clipboardTune.text);
        await refreshLibraryFile(targetPath, { force: true });
        activeFilePath = targetPath;
        return;
      }

      const found = findTuneById(clipboardTune.tuneId);
      if (!found || !found.file || !found.file.path) {
        throw new Error("Unable to move: source tune not found. Refresh the library and try again.");
      }
      const sourcePath = found.file.path;
      if (!sourcePath) throw new Error("Unable to move: source path missing.");
      if (sourcePath === targetPath) throw new Error("Target file is the same as source.");

      // Transaction prerequisite: both files must be in a committed/safe state.
      // (If the active editor is on either file, it must be clean; otherwise the move could silently
      // commit unrelated pending changes.)
      const hasUnsavedInActiveFile = Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
      const activePath = activeTuneMeta && activeTuneMeta.path ? String(activeTuneMeta.path) : (activeFilePath ? String(activeFilePath) : "");
      if (
        activePath
        && hasUnsavedInActiveFile
        && (pathsEqual(activePath, sourcePath) || pathsEqual(activePath, targetPath))
      ) {
        throw new Error("Refusing to move: please Save/Discard your unsaved changes in the source/target file first.");
      }
      if (
        workingCopySnapshot
        && workingCopySnapshot.dirty
        && workingCopySnapshot.path
        && (pathsEqual(workingCopySnapshot.path, sourcePath) || pathsEqual(workingCopySnapshot.path, targetPath))
      ) {
        throw new Error("Refusing to move: source/target file has unsaved changes. Save/Discard them and try again.");
      }

      if (workingCopySnapshot && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, sourcePath)) {
        try { await flushWorkingCopyTuneSync(); } catch {}
        await refreshWorkingCopySnapshot();
      }
      if (workingCopySnapshot && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, targetPath)) {
        await refreshWorkingCopySnapshot();
      }

      let sourceContent = "";
      let startOffset = Number(found.tune.startOffset);
      let endOffset = Number(found.tune.endOffset);
      if (
        clipboardTune.tuneUid
        && workingCopySnapshot
        && workingCopySnapshot.path
        && pathsEqual(workingCopySnapshot.path, sourcePath)
      ) {
        const entry = resolveTuneEntryFromSnapshot(workingCopySnapshot, {
          tuneUid: clipboardTune.tuneUid,
          tuneIndex: clipboardTune.tuneIndex,
          startOffset: clipboardTune.startOffset,
        });
        if (!entry) {
          throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
        }
        sourceContent = String(workingCopySnapshot.text || "");
        startOffset = entry.start;
        endOffset = entry.end;
        setFileContentInCache(sourcePath, sourceContent);
      } else {
        const sourceRes = await readFile(sourcePath);
        if (!sourceRes.ok) throw new Error(sourceRes.error || "Unable to read source file.");
        sourceContent = String(sourceRes.data || "");
      }

      let targetContent = "";
      if (
        workingCopySnapshot
        && workingCopySnapshot.path
        && pathsEqual(workingCopySnapshot.path, targetPath)
      ) {
        targetContent = String(workingCopySnapshot.text || "");
        setFileContentInCache(targetPath, targetContent);
      } else {
        const targetRes = await readFile(targetPath);
        if (!targetRes.ok) throw new Error(targetRes.error || "Unable to read target file.");
        targetContent = String(targetRes.data || "");
      }

      if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > sourceContent.length) {
        throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
      }

      const sourceSlice = sourceContent.slice(startOffset, endOffset);
      const expectedSlice = String(clipboardTune.text || "");
      if (sourceSlice !== expectedSlice) {
        throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
      }
      const trimmedSourceSlice = sourceSlice.replace(/^\s+/, "");
      if (!/^\s*X:/.test(trimmedSourceSlice)) {
        throw new Error("Refusing to move: tune offsets look stale. Reload/refresh the library and try again.");
      }

      // Step 1: append into target and renumber, then save target.
      const nextX = getNextXNumber(targetContent);
      const prepared = ensureXNumberInAbc(expectedSlice, nextX);
      const updatedTarget = appendTuneToContent(targetContent, prepared);
      const renumTarget = renumberXInTextKeepingFirst(updatedTarget);
      if (!renumTarget || !renumTarget.ok || typeof renumTarget.abcText !== "string") {
        throw new Error("Unable to renumber target file after move.");
      }
      const finalTarget = renumTarget.abcText;

      // Step 2: delete from source and renumber, then save source.
      const updatedSource = removeTuneFromContent(sourceContent, startOffset, endOffset);
      const renumSource = renumberXInTextKeepingFirst(updatedSource);
      if (!renumSource || !renumSource.ok || typeof renumSource.abcText !== "string") {
        throw new Error("Unable to renumber source file after move.");
      }
      const finalSource = renumSource.abcText;

      const useWorkingCopyCommit = Boolean(
        window.api
        && typeof window.api.openWorkingCopy === "function"
        && typeof window.api.applyWorkingCopyFullText === "function"
        && typeof window.api.commitWorkingCopyToDisk === "function"
        && (isWorkingCopyOpenForFile(sourcePath) || isWorkingCopyOpenForFile(targetPath))
      );

      if (useWorkingCopyCommit) {
        const commitViaWorkingCopy = async (filePath, text, { force = false } = {}) => {
          await window.api.openWorkingCopy(filePath);
          const applyRes = await window.api.applyWorkingCopyFullText(text);
          if (!applyRes || !applyRes.ok) throw new Error((applyRes && applyRes.error) ? applyRes.error : "Unable to update working copy.");
          let saveRes = await window.api.commitWorkingCopyToDisk({ force: Boolean(force) });
          if (!saveRes || !saveRes.ok) {
            if (saveRes && saveRes.conflict) {
              const forced = await window.api.commitWorkingCopyToDisk({ force: true });
              if (forced && forced.ok) {
                markDiskConflictPath(filePath, false);
                saveRes = forced;
              } else {
                markDiskConflictPath(filePath, true);
                throw new Error((forced && forced.error) ? forced.error : "Unable to save file.");
              }
            }
          }
          if (!saveRes || !saveRes.ok) {
            throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
          }
          const snap = await refreshWorkingCopySnapshot();
          if (snap && snap.path && pathsEqual(snap.path, filePath)) {
            setFileContentInCache(filePath, snap.text);
            syncLibraryFileFromWorkingCopySnapshot(filePath, snap);
          }
        };

        await commitViaWorkingCopy(targetPath, finalTarget);
        try {
          await commitViaWorkingCopy(sourcePath, finalSource);
        } catch (e) {
          try { await commitViaWorkingCopy(targetPath, targetContent, { force: false }); } catch {}
          throw e;
        }
      } else {
        const writeTargetRes = await writeFile(targetPath, finalTarget);
        if (!writeTargetRes.ok) throw new Error(writeTargetRes.error || "Unable to update target file.");

        const writeSourceRes = await writeFile(sourcePath, finalSource);
        if (!writeSourceRes.ok) {
          const rollback = await writeFile(targetPath, targetContent);
          if (rollback && rollback.ok) {
            throw new Error(writeSourceRes.error || "Unable to update source file.");
          }
          throw new Error((writeSourceRes && writeSourceRes.error)
            ? `${writeSourceRes.error} (rollback failed; the tune may now be duplicated)`
            : "Unable to update source file (rollback failed; the tune may now be duplicated)");
        }
      }

      setFileContentInCache(targetPath, finalTarget);
      setFileContentInCache(sourcePath, finalSource);
      await refreshLibraryFile(targetPath, { force: true });
      await refreshLibraryFile(sourcePath, { force: true });
      activeFilePath = targetPath;

      if (activeTuneId === clipboardTune.tuneId) {
        activeTuneId = null;
        activeTuneMeta = null;
        setCurrentDocument(createBlankDocument());
      }

      clipboardTune = null;
      setBufferStatus("");
    });
    setStatus("OK");
  } catch (e) {
    await showSaveError(e && e.message ? e.message : String(e));
  }
}

async function deleteTuneById(tuneId) {
  if (!libraryIndex || !tuneId) return;
  const ok = await ensureSafeToAbandonCurrentDoc("deleting a tune");
  if (!ok) return;

  const found = findTuneById(tuneId);
  if (!found || !found.tune || !found.file) return;
  let selected = found.tune;
  const fileMeta = found.file;

  const label = selected.title || selected.preview || `X:${selected.xNumber || ""}`.trim();
  const confirm = await confirmDeleteTune(label);
  if (confirm !== "delete") return;

  if (!(await requireCleanForFileOp(fileMeta.path, "deleting a tune"))) return;

  if (
    window.api
    && typeof window.api.openWorkingCopy === "function"
    && typeof window.api.deleteWorkingCopyTune === "function"
    && typeof window.api.commitWorkingCopyToDisk === "function"
    && fileMeta.path
  ) {
    if (
      pathsEqual(activeFilePath, fileMeta.path)
      && (Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft))
    ) {
      await showSaveError("Please Save/Discard your unsaved changes in this file before deleting tunes.");
      return;
    }

    try {
      await window.api.openWorkingCopy(fileMeta.path);
      const snapshotBefore = await refreshWorkingCopySnapshot();
      if (snapshotBefore && snapshotBefore.path && pathsEqual(snapshotBefore.path, fileMeta.path)) {
        attachTuneUidsToLibraryFile(fileMeta.path, snapshotBefore);
        const refreshed = findTuneById(tuneId);
        if (refreshed && refreshed.tune) selected = refreshed.tune;
      }
    } catch {}

    try {
      const payload = { tuneUid: selected.tuneUid || null, tuneIndex: selected.tuneIndex };
      await window.api.deleteWorkingCopyTune(payload);

      const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
      if (!saveRes || !saveRes.ok) {
        if (saveRes && saveRes.conflict) {
          await showSaveError("Refusing to delete: file changed on disk. Reload/reopen the file and try again.");
          try { await discardWorkingCopyChangesForActiveFile(); } catch {}
          try { await refreshLibraryFile(fileMeta.path, { force: true }); } catch {}
          return;
        }
        await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to delete tune.");
        return;
      }

      const snapshotAfter = await refreshWorkingCopySnapshot();
      if (!snapshotAfter || !snapshotAfter.path || !pathsEqual(snapshotAfter.path, fileMeta.path)) return;

      setFileContentInCache(fileMeta.path, snapshotAfter.text);
      const updatedFile = syncLibraryFileFromWorkingCopySnapshot(fileMeta.path, snapshotAfter);
      activeFilePath = fileMeta.path;

      if (activeTuneId === tuneId) {
        activeTuneId = null;
        activeTuneUid = null;
        activeTuneIndex = null;
        activeTuneMeta = null;
      }

      const tunes = updatedFile && Array.isArray(updatedFile.tunes) ? updatedFile.tunes : [];
      if (tunes.length) {
        const prevIndex = Number.isFinite(Number(payload.tuneIndex)) ? Number(payload.tuneIndex) : 0;
        const nextIndex = Math.min(Math.max(0, prevIndex), tunes.length - 1);
        const nextTune = tunes[nextIndex];
        const nextKey = rawMode ? nextTune.id : (nextTune.tuneUid || nextTune.id);
        await selectTune(nextKey, { skipConfirm: true, suppressRecent: true });
        if (currentDoc) currentDoc.dirty = false;
        setDirtyIndicator(false);
      } else {
        const text = String(snapshotAfter.text || "");
        const pseudoMeta = {
          id: `${fileMeta.path}::0`,
          path: fileMeta.path,
          basename: fileMeta.basename || safeBasename(fileMeta.path),
          xNumber: "",
          title: "",
          startLine: 1,
          endLine: countLines(text),
          startOffset: 0,
          endOffset: text.length,
        };
        setActiveTuneText(text, pseudoMeta, { suppressRecent: true });
        activeTuneId = pseudoMeta.id;
        activeTuneUid = null;
        activeTuneIndex = null;
        if (currentDoc) currentDoc.dirty = false;
        setDirtyIndicator(false);
        markActiveTuneButton(activeTuneId);
      }
      try { await refreshLibraryFile(fileMeta.path, { force: true }); } catch {}
      return;
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
      return;
    }
  }

  await showSaveError("Internal error: working copy delete is unavailable.");
}

async function performAppendFlow() {
  const session = resolveSaveSession();
  const filePath = String(
    session.targetPath
    || activeFilePath
    || getCurrentNavFilePath()
    || ""
  );
  if (!filePath) {
    await showSaveError("Select a target file in the Library panel first.");
    return false;
  }

  // Strict-write: when saving/appending, read the current editor text directly
  // to avoid losing last-moment edits due to debounced `currentDoc.content` sync.
  const editorText = getEditorValue();
  if (currentDoc) currentDoc.content = editorText;

  const deriveTuneLabel = () => {
    try {
      const parsed = parseTuneIdentityFields(editorText);
      const xPart = parsed && parsed.xNumber ? `X:${parsed.xNumber}` : "";
      const title = parsed && parsed.title ? String(parsed.title) : "";
      return `${xPart} ${title}`.trim() || "Untitled";
    } catch {
      return "Untitled";
    }
  };
  const confirm = (window.api && typeof window.api.confirmAppendToFileDetailed === "function")
    ? await window.api.confirmAppendToFileDetailed(filePath, deriveTuneLabel())
    : await confirmAppendToFile(filePath);
  if (confirm !== "append") return false;

  if (
    !window.api
    || typeof window.api.openWorkingCopy !== "function"
    || typeof window.api.insertWorkingCopyTuneAfter !== "function"
    || typeof window.api.commitWorkingCopyToDisk !== "function"
  ) {
    await showSaveError("Internal error: working copy append is unavailable.");
    return false;
  }

  return withFileLock(filePath, async () => {
    await window.api.openWorkingCopy(filePath);
    const snap = await refreshWorkingCopySnapshot();
    if (!snap || !snap.path || !pathsEqual(snap.path, filePath)) {
      await showSaveError("Unable to open working copy for appending.");
      return false;
    }

    const nextX = getNextXNumber(String(snap.text || ""));
    const prepared = ensureXNumberInAbc(editorText, nextX);
    const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;
    const insertRes = await window.api.insertWorkingCopyTuneAfter({ afterTuneIndex, text: prepared });
    if (!insertRes || !insertRes.ok) {
      await showSaveError((insertRes && insertRes.error) ? insertRes.error : "Unable to append to file.");
      return false;
    }

    const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
    if (!saveRes || !saveRes.ok) {
      if (saveRes && saveRes.conflict) {
        const resolved = await resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId: null });
        if (resolved && resolved.ok && resolved.action === "overwrite") {
          // continue below (post-save snapshot/refresh)
        } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
          showToast("Saved copy and switched.", 3000);
          return true;
        } else {
          if (resolved && resolved.action === "discard_reload") showToast("Reloaded from disk.", 2200);
          else if (resolved && resolved.error) await showSaveError(resolved.error);
          else setStatus("Save canceled.");
          return false;
        }
      }
      await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
      return false;
    }

    markDiskConflictPath(filePath, false);
    const snapAfter = await refreshWorkingCopySnapshot();
    if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, filePath)) {
      setFileContentInCache(filePath, snapAfter.text);
      syncLibraryFileFromWorkingCopySnapshot(filePath, snapAfter);
    }
    const updatedFile = await refreshLibraryFile(filePath, { force: true });
    activeFilePath = filePath;
    if (updatedFile && Array.isArray(updatedFile.tunes) && updatedFile.tunes.length) {
      const last = updatedFile.tunes[updatedFile.tunes.length - 1];
      if (last && last.id) {
        await selectTune(last.tuneUid || last.id, { skipConfirm: true, suppressRecent: true });
      }
    }

    isNewTuneDraft = false;
    setSaveSession({
      intent: SAVE_INTENT.REPLACE_TUNE,
      targetPath: filePath,
      targetTuneUid: String(activeTuneUid || ""),
      source: "append_saved",
    });
    if (currentDoc) {
      currentDoc.path = filePath;
      currentDoc.dirty = false;
    }
    headerDirty = false;
    updateHeaderStateUI();
    setDirtyIndicator(false);
    return true;
  });
}

async function fileNew() {
  const ok = await ensureSafeToAbandonCurrentDoc("creating a new file");
  if (!ok) return;
  const suggestedName = `${getSuggestedBaseName() || "NewTune"}.abc`;
  const suggestedDir = getDefaultSaveDir();
  const filePath = await showSaveDialog(suggestedName, suggestedDir);
  if (!filePath) return;
  const created = await createNewFileAtPath(filePath, NEW_FILE_MINIMAL_ABC, { confirmOverwrite: false });
  if (created) {
    showToast("New file created.", 2200);
  }
}

async function createNewFileAtPath(filePath, content, options = {}) {
  if (!filePath) return false;
  const dir = safeDirname(filePath);
  if (dir) await mkdirp(dir);
  if (await fileExists(filePath) && options.confirmOverwrite) {
    const ok = await confirmOverwrite(filePath);
    if (!ok) return false;
  }
  const writeRes = await withFileLock(filePath, async () => writeFile(filePath, content));
  if (!writeRes || !writeRes.ok) {
    await showSaveError((writeRes && writeRes.error) ? writeRes.error : "Unable to create file.");
    return false;
  }
  setFileContentInCache(filePath, content);
  if (currentDoc) {
    currentDoc.path = filePath;
    currentDoc.dirty = false;
  }
  setDirtyIndicator(false);
  setFileNameMeta(stripFileExtension(safeBasename(filePath)));
  updateFileHeaderPanel();
  updateWindowTitle();
  try {
    await refreshLibraryFile(filePath, { force: true });
  } catch {}
  const switched = await loadLibraryFileIntoEditor(filePath);
  if (switched && switched.ok) return true;
  // Fallback: ensure the session is still pointed at the chosen path even if library navigation fails.
  activeFilePath = filePath;
  recordNavFilePath(filePath);
  try {
    if (window.api && typeof window.api.openWorkingCopy === "function") {
      await window.api.openWorkingCopy(filePath);
      await refreshWorkingCopySnapshot();
    }
  } catch {}
  setActiveTuneText(content, null, { markDirty: false });
  return true;
}

async function fileNewFromTemplate() {
  const ok = await ensureSafeToAbandonCurrentDoc("creating a new tune");
  if (!ok) return;

  const targetPath = (activeTuneMeta && activeTuneMeta.path)
    ? String(activeTuneMeta.path)
    : (activeFilePath ? String(activeFilePath) : "");
  if (!targetPath) {
    setActiveTuneText(TEMPLATE_ABC, null, { markDirty: true });
    showToast("Template opened.", 1800);
    return;
  }

  let nextX = "";
  try {
    const res = await getFileContentCached(targetPath);
    if (res && res.ok) nextX = getNextXNumber(res.data || "");
  } catch {}

  const withX = ensureXNumberInAbc(TEMPLATE_ABC, nextX || "");
  setNewTuneDraftInActiveFile(withX, {
    filePath: targetPath,
    basename: (activeTuneMeta && activeTuneMeta.basename) ? activeTuneMeta.basename : safeBasename(targetPath),
    xNumber: nextX,
  });
  showToast("New tune draft from template (Save will append to the active file).", 3200);
}

function buildNewTuneDraftTemplate(nextX) {
  const x = Number.isFinite(Number(nextX)) ? Number(nextX) : "";
  const xLine = x ? `X:${x}` : "X:";
  return [
    xLine,
    "T:",
    "C:",
    "M:4/4",
    "L:1/8",
    "Q:1/4=120",
    "K:C",
    "",
  ].join("\n");
}

function setNewTuneDraftInActiveFile(text, { filePath, basename, xNumber } = {}) {
  if (!editorView) return;
  if (!filePath) return;
  if (errorsHighlightState.hasActive()) clearActiveErrorHighlight("docReplaced");
  resetPlaybackState();

  suppressDirty = true;
  setEditorValue(text);
  suppressDirty = false;

  isNewTuneDraft = true;
  activeTuneMeta = null;
  activeTuneId = null;
  activeFilePath = filePath;
  setSaveSession({
    intent: SAVE_INTENT.APPEND_TO_FILE,
    targetPath: String(filePath || ""),
    targetTuneUid: "",
    source: "new_tune_draft",
  });

  refreshHeaderLayers().catch(() => {});
  const label = xNumber ? `New tune (X:${xNumber})` : "New tune";
  setTuneMetaText(label);
  setFileNameMeta(stripFileExtension(basename || safeBasename(filePath)));

  if (!currentDoc) currentDoc = createBlankDocument();
  currentDoc.path = null;
  currentDoc.content = text || "";
  currentDoc.dirty = true;
  updateFileContext();
  setDirtyIndicator(true);
  updateFileHeaderPanel();
  scheduleRenderNow({ clearOutput: true });
}

async function fileNewTune() {
  // Keep the menu action compatible, but use the same semantics as the [+] button:
  // immediately append a new tune to the active file and save it.
  await fileNewTuneAndAppendNow();
}

async function appendTuneTextToFileNow(filePath, tuneText, { toastOk = "" } = {}) {
  const p = String(filePath || "");
  if (!p) return false;
  const raw = String(tuneText || "");
  if (!raw.trim()) return false;
  if (
    !window.api
    || typeof window.api.openWorkingCopy !== "function"
    || typeof window.api.insertWorkingCopyTuneAfter !== "function"
    || typeof window.api.commitWorkingCopyToDisk !== "function"
  ) {
    await showSaveError("Internal error: working copy is unavailable.");
    return false;
  }

  return withFileLock(p, async () => {
    await window.api.openWorkingCopy(p);
    const snap = await refreshWorkingCopySnapshot();
    if (!snap || !snap.path || !pathsEqual(snap.path, p)) {
      await showSaveError("Unable to open working copy.");
      return false;
    }

    const nextX = getNextXNumber(String(snap.text || ""));
    const prepared = ensureXNumberInAbc(raw, nextX);
    const afterTuneIndex = Array.isArray(snap.tunes) ? (snap.tunes.length - 1) : -1;

    const insertRes = await window.api.insertWorkingCopyTuneAfter({ afterTuneIndex, text: prepared });
    if (!insertRes || !insertRes.ok) {
      await showSaveError((insertRes && insertRes.error) ? insertRes.error : "Unable to add tune.");
      return false;
    }

    const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
    if (!saveRes || !saveRes.ok) {
      if (saveRes && saveRes.conflict) {
        const resolved = await resolveWorkingCopySaveConflictDefault(p, { restoreTuneId: null });
        if (resolved && resolved.ok && resolved.action === "overwrite") {
          // continue below (post-save snapshot/refresh)
        } else if (resolved && resolved.ok && resolved.action === "save_copy_as") {
          showToast("Saved copy and switched.", 3000);
          return true;
        } else {
          if (resolved && resolved.action === "discard_reload") showToast("Reloaded from disk.", 2200);
          else if (resolved && resolved.error) await showSaveError(resolved.error);
          else setStatus("Save canceled.");
          return false;
        }
      }
      await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
      return false;
    }

    markDiskConflictPath(p, false);
    const snapAfter = await refreshWorkingCopySnapshot();
    if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, p)) {
      setFileContentInCache(p, snapAfter.text);
      syncLibraryFileFromWorkingCopySnapshot(p, snapAfter);
    }

    const updatedFile = await refreshLibraryFile(p, { force: true });
    activeFilePath = p;
    if (updatedFile && Array.isArray(updatedFile.tunes) && updatedFile.tunes.length) {
      const last = updatedFile.tunes[updatedFile.tunes.length - 1];
      if (last && last.id) {
        await selectTune(last.tuneUid || last.id, { skipConfirm: true, suppressRecent: true });
      }
    }

    headerDirty = false;
    updateHeaderStateUI();
    if (currentDoc) {
      currentDoc.path = p;
      currentDoc.dirty = false;
    }
    isNewTuneDraft = false;
    setDirtyIndicator(false);
    if (toastOk) showToast(toastOk, 1800);
    return true;
  });
}

async function fileNewTuneAndAppendNow() {
  const entry = getActiveFileEntry();
  const filePath = String(
    (entry && entry.path)
    || (activeTuneMeta && activeTuneMeta.path)
    || activeFilePath
    || getCurrentNavFilePath()
    || (currentDoc && currentDoc.path)
    || ""
  );
  if (!filePath) {
    showToast("Open/select a file first.", 2400);
    return;
  }

  const ok = await ensureSafeToAbandonCurrentDoc("creating a new tune");
  if (!ok) return;

  const template = buildNewTuneDraftTemplate("");
  await appendTuneTextToFileNow(filePath, template, { toastOk: "New tune added." });
}

async function fileOpen() {
  const ok = await ensureSafeToAbandonCurrentDoc("opening a file");
  if (!ok) return;

  const filePath = await showOpenDialog();
  if (!filePath) return;

  const readRes = await readFile(filePath);
  if (readRes && readRes.ok && (isChordProText(readRes.data) || isChordProFilePath(filePath))) {
    await chordProFeature.open(filePath, readRes.data);
    return;
  }
  chordProFeature.setMode(false);
  await loadLibraryFromFolder(safeDirname(filePath));
  if (libraryIndex && libraryIndex.files) {
    const fileEntry = libraryIndex.files.find((f) => pathsEqual(f.path, filePath));
    if (fileEntry && fileEntry.tunes && fileEntry.tunes.length) {
      await selectTune(fileEntry.tunes[0].id);
    } else {
      setActiveTuneText("", null);
    }
  }
}

async function importPreparedAbcItems(preparedItems, opts = {}) {
  const items = Array.isArray(preparedItems) ? preparedItems : [];
  if (!items.length) {
    setStatus("Ready");
    return;
  }
  const cleanContext = String(opts.cleanContext || "importing files");
  const preflightOk = await ensureSafeToAbandonCurrentDoc(cleanContext);
  if (!preflightOk) {
    setStatus("Ready");
    return;
  }

  const suggestDir = (() => {
    try {
      if (currentDoc && currentDoc.path) return safeDirname(String(currentDoc.path));
      if (activeFilePath) return safeDirname(String(activeFilePath));
      if (activeTuneMeta && activeTuneMeta.path) return safeDirname(String(activeTuneMeta.path));
    } catch {}
    return "";
  })();

  // Use editor-owned path first; tune metadata can lag behind after recent save/switch flows.
  let existingTargetPath = (currentDoc && currentDoc.path)
    ? String(currentDoc.path)
    : (activeFilePath ? String(activeFilePath) : "");
  if (!existingTargetPath && activeTuneMeta && activeTuneMeta.path) existingTargetPath = String(activeTuneMeta.path);

  const targetChoice = await confirmImportMusicXmlTarget(existingTargetPath || "");
  if (targetChoice === "cancel") {
    setStatus("Ready");
    return;
  }

  let targetPath = existingTargetPath;
  if (targetChoice === "new_file") {
    const ok = await ensureSafeToAbandonCurrentDoc("creating a new file");
    if (!ok) {
      setStatus("Ready");
      return;
    }
    const newPath = await showSaveDialog("import.abc", suggestDir);
    if (!newPath) {
      setStatus("Ready");
      return;
    }
    const created = await writeFile(newPath, "");
    if (!created || !created.ok) {
      setStatus("Error");
      await showSaveError((created && created.error) ? created.error : "Unable to create target file.");
      return;
    }
    targetPath = String(newPath);
    activeTuneId = null;
    activeTuneMeta = null;
    activeFilePath = targetPath;
    setTuneMetaText("Untitled");
    setFileNameMeta(stripFileExtension(safeBasename(targetPath)));
    setCurrentDocument({ path: targetPath, dirty: false, content: "" });
    setDirtyIndicator(false);
    updateFileHeaderPanel();
    updateHeaderStateUI();
    clearErrors();
    scheduleRenderNow({ clearOutput: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      await refreshLibraryFile(targetPath);
    } catch {}
  } else if (!targetPath) {
    setStatus("Ready");
    return;
  }

  if (!(await requireCleanForFileOp(targetPath, cleanContext))) {
    setStatus("Ready");
    return;
  }

  const countTunesByX = (text) => {
    try {
      const m = String(text || "").match(/^X:\s*\d+\s*$/gm);
      return m ? m.length : 0;
    } catch {
      return 0;
    }
  };

  let dropPlaceholderTune = false;
  try {
    const readRes = await readFile(targetPath);
    if (readRes && readRes.ok) {
      const before = String(readRes.data || "");
      const looksEmpty = !before.trim();
      const looksLikeNewFile = before.trim() === String(NEW_FILE_MINIMAL_ABC || "").trim();
      if (looksLikeNewFile) dropPlaceholderTune = true;
      if (!looksEmpty && !looksLikeNewFile) {
        const confirm = await confirmAppendToFile(targetPath);
        if (confirm !== "append") {
          setStatus("Ready");
          return;
        }
      }
    }
  } catch {}

  if (targetPath) {
    try {
      await withFileLock(targetPath, async () => {
        const readRes = await readFile(targetPath);
        if (!readRes || !readRes.ok) throw new Error((readRes && readRes.error) ? readRes.error : "Unable to read target file.");
        const before = String(readRes.data || "");
        if (targetChoice !== "new_file") {
          const verifyRes = await readFile(targetPath);
          if (!verifyRes || !verifyRes.ok) throw new Error((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify file before importing.");
          const verifyText = String(verifyRes.data || "");
          if (verifyText !== before) throw new Error("Refusing to import: target file changed on disk. Refresh/reopen the file and try again.");
        }

        const beforeTrimmed = before.trim();
        const isEmpty = !beforeTrimmed;
        const isPlaceholder = beforeTrimmed === String(NEW_FILE_MINIMAL_ABC || "").trim();
        const beforeTuneCount = (isEmpty || (dropPlaceholderTune && isPlaceholder)) ? 0 : countTunesByX(before);
        let updated = (dropPlaceholderTune && isPlaceholder) ? "" : before;
        let lastWithX = "";
        for (const item of items) {
          const nextX = getNextXNumber(updated);
          lastWithX = ensureXNumberInAbc(String(item.abcText || ""), nextX);
          updated = appendTuneToContent(updated, lastWithX);
        }

        const shouldUseWorkingCopyCommit = Boolean(
          isWorkingCopyOpenForFile(targetPath)
          && window.api
          && typeof window.api.openWorkingCopy === "function"
          && typeof window.api.applyWorkingCopyFullText === "function"
          && typeof window.api.commitWorkingCopyToDisk === "function"
        );
        if (shouldUseWorkingCopyCommit) {
          await window.api.openWorkingCopy(targetPath);
          const applyRes = await window.api.applyWorkingCopyFullText(updated);
          if (!applyRes || !applyRes.ok) throw new Error((applyRes && applyRes.error) ? applyRes.error : "Unable to update working copy.");
          const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
          if (!saveRes || !saveRes.ok) {
            if (saveRes && saveRes.conflict) {
              const forced = await window.api.commitWorkingCopyToDisk({ force: true });
              if (forced && forced.ok) {
                markDiskConflictPath(targetPath, false);
              } else {
                markDiskConflictPath(targetPath, true);
                throw new Error((forced && forced.error) ? forced.error : "Unable to save file.");
              }
            }
            if (!saveRes || !saveRes.ok) {
              throw new Error((saveRes && saveRes.error) ? saveRes.error : "Unable to save file.");
            }
          }
          const snapAfter = await refreshWorkingCopySnapshot();
          if (snapAfter && snapAfter.path && pathsEqual(snapAfter.path, targetPath)) {
            setFileContentInCache(targetPath, snapAfter.text);
            syncLibraryFileFromWorkingCopySnapshot(targetPath, snapAfter);
          } else {
            setFileContentInCache(targetPath, updated);
          }
        } else {
          const writeRes = await writeFile(targetPath, updated);
          if (!writeRes || !writeRes.ok) throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to write imported tunes.");
          setFileContentInCache(targetPath, updated);
        }

        const updatedFile = await refreshLibraryFile(targetPath);
        if (updatedFile && updatedFile.tunes && updatedFile.tunes.length) {
          const tune = updatedFile.tunes[Math.min(beforeTuneCount, updatedFile.tunes.length - 1)];
          activeTuneId = tune.id;
          markActiveTuneButton(activeTuneId);
          const tuneText = updated.slice(tune.startOffset, tune.endOffset);
          setActiveTuneText(tuneText, {
            id: tune.id,
            path: updatedFile.path,
            basename: updatedFile.basename,
            xNumber: tune.xNumber,
            title: tune.title || "",
            composer: tune.composer || "",
            key: tune.key || "",
            startLine: tune.startLine,
            endLine: tune.endLine,
            startOffset: tune.startOffset,
            endOffset: tune.endOffset,
          });
        } else {
          setActiveTuneText(lastWithX, null, { markDirty: false });
          if (currentDoc) currentDoc.dirty = false;
        }
      });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      logErr(msg);
      setStatus("Error");
      await showSaveError(msg);
      return;
    }

    for (const item of items) {
      if (item && item.backend) {
        const p = item.sourcePath ? ` (${safeBasename(item.sourcePath)})` : "";
        logErr(`Import backend${p}: ${item.backend}`);
      }
      if (item && item.warnings) {
        const p = item.sourcePath ? ` (${safeBasename(item.sourcePath)})` : "";
        logErr(`Import warning${p}: ${item.warnings}`);
      }
    }
    setStatus(`OK (imported ${items.length} file${items.length === 1 ? "" : "s"})`);
    return;
  }

  const ok = await ensureSafeToAbandonCurrentDoc("importing a file");
  if (!ok) {
    setStatus("Ready");
    return;
  }

  if (!currentDoc) setCurrentDocument(createBlankDocument());
  const last = items.length ? items[items.length - 1] : null;
  setActiveTuneText(last ? String(last.abcText || "") : "", null, { markDirty: true });
  for (const item of items) {
    if (item && item.backend) {
      const p = item.sourcePath ? ` (${safeBasename(item.sourcePath)})` : "";
      logErr(`Import backend${p}: ${item.backend}`);
    }
    if (item && item.warnings) {
      const p = item.sourcePath ? ` (${safeBasename(item.sourcePath)})` : "";
      logErr(`Import warning${p}: ${item.warnings}`);
    }
  }
  setStatus("OK");
}

async function importMusicXml() {
  if (!window.api) return;
  if (typeof window.api.pickMusicXmlFiles !== "function") return;
  if (typeof window.api.convertMusicXmlFile !== "function") return;
  const preflightOk = await ensureSafeToAbandonCurrentDoc("importing MusicXML");
  if (!preflightOk) {
    setStatus("Ready");
    return;
  }

  let cancelRequested = false;
  const cancelHintToast = () => {
    try {
      showToast("Importing… Press Esc to cancel.", 2600);
    } catch {}
  };
  const cancelHandler = (e) => {
    try {
      if (!e) return;
      if (e.key !== "Escape") return;
      cancelRequested = true;
      e.preventDefault();
      e.stopPropagation();
    } catch {}
  };

  setStatus("Choose MusicXML files…");
  const pickRes = await window.api.pickMusicXmlFiles();
  if (!pickRes || pickRes.canceled) {
    setStatus("Ready");
    return;
  }
  if (!pickRes.ok) {
    const msg = formatConversionError(pickRes);
    logErr(msg);
    setStatus("Error");
    await showOpenError(msg);
    return;
  }
  const pickedPaths = Array.isArray(pickRes.paths) ? pickRes.paths.map(String) : [];
  if (!pickedPaths.length) {
    setStatus("Ready");
    return;
  }

  const preparedItems = [];
  const total = pickedPaths.length;
  window.addEventListener("keydown", cancelHandler, true);
  cancelHintToast();
  try {
    for (let i = 0; i < pickedPaths.length; i += 1) {
      if (cancelRequested) break;
      const sourcePath = pickedPaths[i];
      setStatus(`Converting MusicXML… ${i + 1}/${total}`);
      const converted = await window.api.convertMusicXmlFile(sourcePath);
      if (!converted || !converted.ok) {
        const msg = formatConversionError(converted);
        logErr(msg);
        setStatus("Error");
        await showOpenError(msg);
        return;
      }
      const fallbackTitle = deriveTitleFromPath(converted.sourcePath ? converted.sourcePath : sourcePath);
      let prepared = ensureTitleInAbc(String(converted.abcText || ""), fallbackTitle);
      prepared = normalizeMeasuresLineBreaks(transformMeasuresPerLine(prepared, 4));
      const aligned = alignBarsInText(prepared);
      preparedItems.push({
        abcText: aligned || prepared,
        warnings: converted.warnings ? converted.warnings : null,
        sourcePath: converted.sourcePath ? converted.sourcePath : sourcePath,
      });
    }
  } finally {
    window.removeEventListener("keydown", cancelHandler, true);
  }

  if (cancelRequested && preparedItems.length) {
    try {
      showToast(`Import canceled (imported ${preparedItems.length}/${total}).`, 2600);
    } catch {}
  } else if (cancelRequested) {
    setStatus("Ready");
    return;
  }

  await importPreparedAbcItems(preparedItems, { cleanContext: "importing MusicXML" });
}

async function importMidi() {
  if (!window.api || typeof window.api.importMidi !== "function") return;
  const preflightOk = await ensureSafeToAbandonCurrentDoc("importing MIDI");
  if (!preflightOk) {
    setStatus("Ready");
    return;
  }
  setStatus("Choose MIDI files…");
  midiImportInProgress = true;
  let res = null;
  try {
    res = await window.api.importMidi();
  } finally {
    midiImportInProgress = false;
  }
  if (!res || res.canceled) {
    setStatus("Ready");
    return;
  }
  if (!res.ok) {
    const msg = formatConversionError(res);
    logErr(msg);
    setStatus("Error");
    await showOpenError(msg);
    return;
  }

  const rawItems = Array.isArray(res.items) ? res.items : [];
  if (!rawItems.length) {
    setStatus("Ready");
    return;
  }

  const preparedItems = rawItems.map((item) => {
    const sourcePath = item && item.sourcePath ? String(item.sourcePath) : "";
    const fallbackTitle = deriveTitleFromPath(sourcePath);
    let prepared = ensureTitleInAbc(String((item && item.abcText) || ""), fallbackTitle);
    prepared = normalizeMeasuresLineBreaks(transformMeasuresPerLine(prepared, 4));
    const aligned = alignBarsInText(prepared);
    return {
      abcText: aligned || prepared,
      warnings: item && item.warnings ? item.warnings : null,
      sourcePath,
    };
  });

  await importPreparedAbcItems(preparedItems, { cleanContext: "importing MIDI" });
}

async function fileSave() {
  if (!currentDoc) return;
  if (isPayloadMode()) {
    showToast("Payload Mode is diagnostics-only (no saves).", 2600);
    return;
  }
  if (rawMode) {
    await performRawSaveFlow();
    return;
  }
  await performSaveFlow();
}

async function fileSaveAs() {
  if (!currentDoc) return;
  if (isPayloadMode()) {
    showToast("Exit Payload Mode to Save As.", 2400);
    return;
  }
  await performSaveAsFlow();
}

async function requestCloseDocument() {
  if (abandonFlowInProgress) return;
  if (!currentDoc) return;
  abandonFlowInProgress = true;
  try {
    const ok = await confirmAbandonIfDirty("closing this file");
    if (!ok) return;
    clearCurrentDocument();
    setDirtyIndicator(false);
  } finally {
    abandonFlowInProgress = false;
  }
}

async function requestQuitApplication() {
  if (abandonFlowInProgress) return;
  abandonFlowInProgress = true;
  try {
    const ok = await confirmAbandonIfDirty("quitting");
    if (!ok) return;
    await flushLibraryPrefsSave();
    if (window.api && typeof window.api.quitApplication === "function") {
      await window.api.quitApplication();
    }
  } finally {
    abandonFlowInProgress = false;
  }
}

async function fileClose() {
  // Unified close behavior: close current file to empty state.
  // Keep this wrapper for toolbar call sites.
  await requestCloseDocument();
}

async function exportMusicXml() {
  if (!window.api || typeof window.api.exportMusicXml !== "function") return;
  const abcText = getEditorValue();
  if (!abcText.trim()) {
    setStatus("No notation to export.");
    return;
  }

  setStatus("Exporting…");
  try {
    const res = await window.api.exportMusicXml(abcText, getSuggestedBaseName());
    if (!res || res.canceled) {
      setStatus("Ready");
      return;
    }
    if (!res.ok) {
      const msg = formatConversionError(res);
      logErr(msg);
      setStatus("Error");
      await showSaveError(msg);
      return;
    }
    if (res.warnings) logErr(`Export warning: ${res.warnings}`);
    setStatus("OK");
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    logErr(msg);
    setStatus("Error");
    await showSaveError(msg);
  }
}

async function buildMidiBytesFromAbc(abcText) {
  ensureAbc2svgLoader();
  const AbcCtor = getAbcCtor();
  if (!AbcCtor) throw new Error("abc2svg not available.");
  const payload = getPlaybackPayload();
  let text = normalizeHeaderNoneSpacing(payload.text || "");
  if (/[\\^_]3\/4/.test(text)) {
    text = normalizeAccThreeQuarterToneForAbc2svg(text);
  }
  const modulesOk = await ensureAbc2svgModulesAsync(text);
  if (!modulesOk) throw new Error("Failed to load abc2svg modules.");
  await ensureMidiGenLoaded();

  const errors = [];
  const user = {
    errtxt: "",
    img_out: () => {},
    err: (m) => {
      const msg = String(m || "").trim();
      if (msg) errors.push(msg);
    },
    errmsg: (m, line, col) => {
      const msg = String(m || "").trim();
      if (!msg) return;
      if (Number.isFinite(line) && Number.isFinite(col)) {
        errors.push(`Line ${line + 1}, Col ${col + 1}: ${msg}`);
      } else {
        errors.push(msg);
      }
      user.errtxt += `${msg}\n`;
    },
  };

  const prevAbc = window.abc;
  const prevUser = window.user;
  let abc = null;
  try {
    abc = new AbcCtor(user);
    window.abc = abc;
    window.user = user;
    abc.tosvg("midi_export", text);
    if (typeof window.midigen !== "function") throw new Error("midigen() not loaded.");
    window.midigen();
  } finally {
    if (prevAbc === undefined) delete window.abc;
    else window.abc = prevAbc;
    if (prevUser === undefined) delete window.user;
    else window.user = prevUser;
  }

  const tunes = abc && Array.isArray(abc.tunes) ? abc.tunes : [];
  const midi = tunes.length ? tunes[0][4] : null;
  if (!midi || !midi.length) {
    const detail = errors.length ? errors[0] : "No MIDI output produced.";
    throw new Error(detail);
  }
  return midi;
}

async function exportMidi() {
  if (!window.api || typeof window.api.exportMidi !== "function") return;
  const abcText = getEditorValue();
  if (!abcText.trim()) {
    setStatus("No notation to export.");
    return;
  }
  setStatus("Exporting…");
  try {
    const midiBytes = await buildMidiBytesFromAbc(abcText);
    const res = await window.api.exportMidi(midiBytes, getSuggestedBaseName());
    if (!res || res.canceled) {
      setStatus("Ready");
      return;
    }
    if (!res.ok) {
      const msg = formatConversionError(res);
      logErr(msg);
      setStatus("Error");
      await showSaveError(msg);
      return;
    }
    setStatus("OK");
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    logErr(msg);
    setStatus("Error");
    await showSaveError(msg);
  }
}

async function exportMp3() {
  if (!window.api || typeof window.api.exportMp3 !== "function") return;
  const abcText = getEditorValue();
  if (!abcText.trim()) {
    setStatus("No notation to export.");
    return;
  }
  setStatus("Exporting…");
  try {
    const midiBytes = await buildMidiBytesFromAbc(abcText);
    const res = await window.api.exportMp3(midiBytes, getSuggestedBaseName());
    if (!res || res.canceled) {
      setStatus("Ready");
      return;
    }
    if (!res.ok) {
      const msg = formatConversionError(res);
      logErr(msg);
      setStatus("Error");
      await showSaveError(msg);
      return;
    }
    setStatus("OK");
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    logErr(msg);
    setStatus("Error");
    await showSaveError(msg);
  }
}

function renumberXInTextKeepingFirst(abcText) {
  const lines = String(abcText || "").split(/\r\n|\n|\r/);
  const xStartRe = /^(\s*X:\s*)(.*)$/;
  const out = [];
  let base = null;
  let tuneIndex = 0;

  for (const line of lines) {
    const match = line.match(xStartRe);
    if (!match) {
      out.push(line);
      continue;
    }

    const prefix = match[1];
    const rest = match[2] || "";
    const numMatch = rest.match(/^(\s*)(\d+)(.*)$/);

    if (base == null) {
      if (numMatch) {
        const num = Number(numMatch[2]);
        if (Number.isFinite(num)) {
          base = num;
          tuneIndex = 0;
          out.push(line);
          continue;
        }
      }

      base = 1;
      tuneIndex = 0;
      out.push(`${prefix}${base}${rest}`);
      continue;
    }

    tuneIndex += 1;
    const next = base + tuneIndex;
    if (numMatch) {
      out.push(`${prefix}${numMatch[1]}${next}${numMatch[3]}`);
    } else {
      out.push(`${prefix}${next}${rest}`);
    }
  }

  if (base == null) {
    return { ok: false, error: "No X: headers found in file." };
  }

  return {
    ok: true,
    abcText: out.join("\n"),
    base,
    tuneCount: tuneIndex + 1,
  };
}

function renumberXInTextStartingAt1(abcText) {
  const text = String(abcText || "");
  const lines = text.split(/\r\n|\n|\r/);
  let base = null;
  let tuneIndex = -1;
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^(\s*X:\s*)(\d+)(\s*)$/);
    if (!match) {
      out.push(line);
      continue;
    }
    const prefix = match[1] || "X:";
    const suffix = match[3] || "";
    if (base == null) {
      base = 1;
      tuneIndex = 0;
      out.push(`${prefix}${base}${suffix}`);
      continue;
    }
    tuneIndex += 1;
    out.push(`${prefix}${base + tuneIndex}${suffix}`);
  }

  if (base == null) return { ok: false, error: "No X: headers found in file." };
  return { ok: true, abcText: out.join("\n"), base: 1, tuneCount: tuneIndex + 1 };
}

async function renumberXInActiveFile(explicitFilePath) {
  const filePath = explicitFilePath
    || ((activeTuneMeta && activeTuneMeta.path) ? activeTuneMeta.path : null)
    || (activeFilePath || (currentDoc && currentDoc.path) || null);
  if (!filePath) {
    showToast("No active file selected.", 2200);
    return;
  }

  if (rawMode) {
    showToast("Raw mode: switch to tune mode to renumber.", 2400);
    return;
  }

  const activePath = (activeTuneMeta && activeTuneMeta.path)
    ? String(activeTuneMeta.path)
    : (activeFilePath ? String(activeFilePath) : "");
  const globalDirty = Boolean(currentDoc && currentDoc.dirty) || Boolean(headerDirty) || Boolean(isNewTuneDraft);
  const isTargetActive = Boolean(activePath && pathsEqual(activePath, filePath));

  if (globalDirty && !isTargetActive) {
    await showSaveError("Please Save/Discard your current changes before renumbering another file.");
    return;
  }
  if (hasUnsavedChangesForFile(filePath)) {
    await showSaveError("Renumber X is disabled while the file has unsaved changes. Save/Discard first.");
    return;
  }

  // Non-open file: do a safe disk-first renumber (read → transform → write).
  if (!isTargetActive && !isWorkingCopyOpenForFile(filePath)) {
    try {
      await withFileLock(filePath, async () => {
        const readRes = await readFile(filePath);
        if (!readRes || !readRes.ok) throw new Error((readRes && readRes.error) ? readRes.error : "Unable to read file.");
        const before = String(readRes.data || "");
        const verifyRes = await readFile(filePath);
        if (!verifyRes || !verifyRes.ok) throw new Error((verifyRes && verifyRes.error) ? verifyRes.error : "Unable to verify file.");
        if (String(verifyRes.data || "") !== before) throw new Error("Refusing to renumber: file changed on disk. Refresh/reopen and try again.");
        const ren = renumberXLinesConsecutive(before);
        if (!ren || !ren.ok) throw new Error((ren && ren.error) ? ren.error : "Unable to renumber X.");
        const writeRes = await writeFile(filePath, ren.text);
        if (!writeRes || !writeRes.ok) throw new Error((writeRes && writeRes.error) ? writeRes.error : "Unable to write file.");
        setFileContentInCache(filePath, ren.text);
      });
      await refreshLibraryFile(filePath, { force: true });
      setStatus("Renumbered X.");
      return;
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
      return;
    }
  }

  try {
    if (window.api && typeof window.api.openWorkingCopy === "function") {
      await window.api.openWorkingCopy(filePath);
      const snapshot = await refreshWorkingCopySnapshot();
      if (snapshot && snapshot.path && pathsEqual(snapshot.path, filePath)) {
        attachTuneUidsToLibraryFile(filePath, snapshot);
      }
    }
  } catch {}

  try { await flushWorkingCopyTuneSync(); } catch {}

  if (!window.api || typeof window.api.renumberWorkingCopyXStartingAt1 !== "function") {
    await showSaveError("Working copy renumber API is unavailable.");
    return;
  }

  const prevIndex = Number.isFinite(Number(activeTuneIndex)) ? Number(activeTuneIndex) : null;
  const prevUid = activeTuneUid;
  const prevFileEntry = getActiveFileEntry();
  const prevTuneCount = prevFileEntry && Array.isArray(prevFileEntry.tunes) ? prevFileEntry.tunes.length : 0;

  const res = await window.api.renumberWorkingCopyXStartingAt1();
  if (!res || !res.ok) {
    await showSaveError((res && res.error) ? res.error : "Unable to renumber X.");
    return;
  }

  const snapshot = await refreshWorkingCopySnapshot();
  if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, filePath)) {
    await showSaveError("Unable to refresh working copy after renumber.");
    return;
  }

  setFileContentInCache(filePath, snapshot.text);
  attachTuneUidsToLibraryFile(filePath, snapshot);
  scheduleRenderLibraryTree();
  updateFileContext();

  // Keep the editor aligned with the active tune slice (its X line changed).
  // If we can't reliably restore the exact tune, fall back to best-effort selection.
  const fileEntry = libraryIndex && Array.isArray(libraryIndex.files)
    ? libraryIndex.files.find((f) => pathsEqual(f.path, filePath))
    : null;
  const tunes = fileEntry && Array.isArray(fileEntry.tunes) ? fileEntry.tunes : [];
  const countSame = Boolean(prevTuneCount && Array.isArray(snapshot.tunes) && snapshot.tunes.length === prevTuneCount);

  const candidate = (() => {
    if (prevUid && countSame) return tunes.find((t) => t && t.tuneUid === prevUid) || null;
    if (activeTuneMeta && activeTuneMeta.path && pathsEqual(activeTuneMeta.path, filePath)) {
      const startOff = Number.isFinite(Number(activeTuneMeta.startOffset)) ? Number(activeTuneMeta.startOffset) : null;
      if (startOff != null) return tunes.find((t) => Number(t.startOffset) === startOff) || null;
    }
    if (prevIndex != null) return tunes[Math.max(0, Math.min(tunes.length - 1, prevIndex))] || null;
    return tunes.length ? tunes[0] : null;
  })();

  if (candidate) {
    const key = candidate.tuneUid || candidate.id;
    if (key) {
      // Avoid late debounced pushes of stale editor text overwriting the renumber result.
      try {
        workingCopyTuneSyncEpoch += 1;
        if (workingCopyTuneSyncTimer) clearTimeout(workingCopyTuneSyncTimer);
        workingCopyTuneSyncTimer = null;
        workingCopyTuneSyncQueued = false;
      } catch {}
      await selectTune(key, { skipConfirm: true, suppressRecent: true });
    }
  }

  // Renumber X is a structural operation; if the file was clean (required), commit immediately so
  // users can continue navigating and running file ops without being stuck in a dirty state.
  if (window.api && typeof window.api.commitWorkingCopyToDisk === "function") {
    const saveRes = await window.api.commitWorkingCopyToDisk({ force: false });
    if (!saveRes || !saveRes.ok) {
      await showSaveError((saveRes && saveRes.error) ? saveRes.error : "Unable to save file after renumber.");
      if (currentDoc) currentDoc.dirty = true;
      setDirtyIndicator(true);
      setStatus("Renumbered X (unsaved).");
      return;
    }
    markDiskConflictPath(filePath, false);
    const snapAfterSave = await refreshWorkingCopySnapshot();
    if (snapAfterSave && snapAfterSave.path && pathsEqual(snapAfterSave.path, filePath)) {
      setFileContentInCache(filePath, snapAfterSave.text);
      attachTuneUidsToLibraryFile(filePath, snapAfterSave);
      scheduleRenderLibraryTree();
    }
    if (currentDoc) currentDoc.dirty = false;
    setDirtyIndicator(false);
    setStatus("Renumbered X.");
    return;
  }

  if (currentDoc) currentDoc.dirty = true;
  setDirtyIndicator(true);
  setStatus("Renumbered X (unsaved).");
}

async function appQuit() {
  await requestQuitApplication();
}

function wireMenuActions() {
  if (!window.api || typeof window.api.onMenuAction !== "function") return;
  window.api.onMenuAction(async (action) => {
    try {
      const actionType = typeof action === "string" ? action : action && action.type;
      const busy = isPlaybackBusy();
      if (busy) {
        // During Play/Pause, ignore menu actions (except Play/Pause itself, Reset Layout, and Quit).
        const allowed = new Set([
          "playToggle",
          "stopPlayback",
          "resetLayout",
          "quit",
          "openPayloadMode",
          "playGotoMeasure",
          "toggleFocusMode",
          "setSplitOrientation",
          "toggleSplitOrientation",
          "toggleDebugMessages",
          "toggleAutoDump",
          "toggleNoteTypingPreview",
          "openIntonationExplorer",
        ]);
        if (!allowed.has(actionType)) return;
      }
      if (isPayloadMode()) {
        // Payload Mode is diagnostics-only. Keep actions that don't touch the library/working copy.
        const allowed = new Set([
          "openPayloadMode",
          "playStart",
          "playPrev",
          "playToggle",
          "playNext",
          "stopPlayback",
          "playGotoMeasure",
          "zoomIn",
          "zoomOut",
          "zoomReset",
          "resetLayout",
          "setSplitOrientation",
          "toggleSplitOrientation",
          "toggleDebugMessages",
          "toggleAutoDump",
          "toggleNoteTypingPreview",
          "openKeyboardHelp",
          "openSettings",
          "openSettingsFolder",
        ]);
        if (!allowed.has(actionType)) {
          showToast("Payload Mode: exit to use file/library actions.", 2600);
          return;
        }
      }
      if (rawMode) {
        const blocked = new Set([
          "playStart",
          "playPrev",
          "playToggle",
          "playNext",
          "transformTransposeUp",
          "transformTransposeDown",
          "transformDouble",
          "transformHalf",
          "transformMeasures",
          "alignBars",
          "printPreview",
          "print",
          "printAll",
          "exportPdf",
          "exportPdfAll",
          "exportMusicXml",
          "exportMidi",
          "exportMp3",
          "importMusicXml",
          "importMidi",
          "templatesModal",
          "abcHelpers",
          "revertToDisk",
        ]);
        if (blocked.has(actionType)) {
          showToast("Raw mode: switch to tune mode for tools/playback/print/export.", 2400);
          return;
        }

        const needsExit = new Set([
          "new",
          "newTune",
          "newFromTemplate",
          "open",
          "openFolder",
          "openRecentTune",
          "openRecentFile",
          "openRecentFolder",
          "templatesModal",
          "revertToDisk",
          "close",
          "quit",
        ]);
        if (needsExit.has(actionType)) {
          const labelMap = {
            new: "creating a new file",
            newTune: "creating a new tune",
            newFromTemplate: "creating a new tune",
            open: "opening a file",
            openFolder: "opening a folder",
            openRecentTune: "opening a recent tune",
            openRecentFile: "opening a recent file",
            openRecentFolder: "opening a recent folder",
            templatesModal: "opening templates",
            revertToDisk: "reverting to disk",
            close: "closing this file",
            quit: "quitting",
          };
          const ok = await leaveRawModeForAction(labelMap[actionType] || "continuing");
          if (!ok) return;
        }
      }
      if (actionType === "new") await fileNew();
      else if (actionType === "newTune") await fileNewTune();
      else if (actionType === "newFromTemplate") await fileNewFromTemplate();
      else if (actionType === "templatesModal") {
        if (isPayloadMode()) {
          showToast("Exit Payload Mode to use templates.", 2400);
          return;
        }
        await openTemplatesModal();
      }
      else if (actionType === "open") await fileOpen();
      else if (actionType === "openFolder") await scanAndLoadLibrary();
      else if (actionType === "importMusicXml") await importMusicXml();
      else if (actionType === "importMidi") await importMidi();
      else if (actionType === "save") await fileSave();
      else if (actionType === "saveAs") await fileSaveAs();
      else if (actionType === "revertToDisk") {
        const entry = getActiveFileEntry();
        const filePath = entry && entry.path ? String(entry.path) : "";
        if (!filePath) {
          showToast("Open a file first.", 2200);
          return;
        }
        if (isPlaying || isPaused) {
          showToast("Stop playback to revert.", 2200);
          return;
        }
        const confirm = await confirmReloadFromDisk(filePath);
        if (!confirm) return;
        const restoreTuneId = rawMode ? null : (activeTuneId || null);
        const res = await discardAndReloadWorkingCopyFromDisk(filePath, { restoreTuneId });
        if (!res || !res.ok) {
          await showSaveError(res && res.error ? res.error : "Unable to revert to disk.");
          return;
        }
        setStatus("Reverted to disk.");
        showToast("Reverted to disk.", 1600);
      }
      else if (actionType === "openPayloadMode") {
        const enabled = Boolean(latestSettingsSnapshot && latestSettingsSnapshot.payloadModeEnabled);
        if (!enabled) {
          showToast("Payload Mode is disabled. Enable in Settings → Options → Tools → Diagnostics.", 4200);
          return;
        }
        payloadModeFeature.wire();
        if (isPayloadMode()) await payloadModeFeature.exit();
        else await payloadModeFeature.enter();
      }
      else if (actionType === "toggleDebugMessages") {
        const enabled = Boolean(action && action.value);
        window.__abcarusDebugMessages = enabled;
        window.__abcarusDebugPlayback = enabled;
        window.__abcarusDebugDrums = enabled;
      }
      else if (actionType === "toggleAutoDump") {
        const enabled = Boolean(action && action.value);
        window.__abcarusAutoDumpOnError = enabled;
      }
      else if (actionType === "printPreview") await runPrintAction("preview");
      else if (actionType === "print") await runPrintAction("print");
      else if (actionType === "printAll") await runPrintAllAction("print");
      else if (actionType === "exportMusicXml") await exportMusicXml();
      else if (actionType === "exportMidi") await exportMidi();
      else if (actionType === "exportMp3") await exportMp3();
      else if (actionType === "exportPdf") await runPrintAction("pdf");
      else if (actionType === "exportPdfAll") await runPrintAllAction("pdf");
      else if (actionType === "close") await requestCloseDocument();
      else if (actionType === "quit") await requestQuitApplication();
      else if (actionType === "libraryList") {
        openLibraryListFromCurrentLibraryIndex();
      }
      else if (actionType === "setList") setListFeature.open();
      else if (actionType === "toggleLibrary") toggleLibrary();
      else if (actionType === "toggleFocusMode") toggleFocusMode();
      else if (actionType === "toggleSplitOrientation") {
        toggleSplitOrientation({ userAction: true });
      }
      else if (actionType === "setSplitOrientation") {
        const value = action && action.value ? String(action.value) : "";
        setSplitOrientation(value, { persist: true, userAction: true });
      }
      else if (actionType === "renumberXInFile") await renumberXInActiveFile();
      else if (actionType === "navTunePrev") await navigateTuneByDelta(-1);
      else if (actionType === "navTuneNext") await navigateTuneByDelta(1);
      else if (actionType === "openRecentTune" && action && action.entry) {
        await openRecentTune(action.entry);
      }
      else if (actionType === "openRecentFile" && action && action.entry) {
        await openRecentFile(action.entry);
      }
      else if (actionType === "openRecentFolder" && action && action.entry) {
        await openRecentFolder(action.entry);
      }
      else if (actionType === "abcHelpers") {
        if (!editorView) return;
        if (isPayloadMode()) {
          showToast("Exit Payload Mode to use ABC Helpers.", 2400);
          return;
        }
        editorView.focus();
        try {
          const ev = new KeyboardEvent("keydown", {
            key: "F2",
            code: "F2",
            ctrlKey: true,
            bubbles: true,
          });
          editorView.dom.dispatchEvent(ev);
        } catch (_) {
          // no-op
        }
      }
      else if (actionType === "find" && editorView) openFindPanel(editorView);
      else if (actionType === "replace" && editorView) openReplacePanel(editorView);
      else if (actionType === "gotoLine" && editorView) gotoLine(editorView);
      else if (actionType === "toggleComment") {
        const view = getFocusedEditorView();
        if (view) toggleLineComments(view);
      }
      else if (actionType === "clearLibraryFilter") clearLibraryFilter();
      else if (actionType === "playStart") await transportStartOver();
      else if (actionType === "playToggle") { await togglePlayPauseEffective(); }
      else if (actionType === "playGotoMeasure") await goToMeasureFromMenu();
      else if (actionType === "toggleNoteTypingPreview") {
        const next = Boolean(action && action.value);
        midiInputFeature.applySettingsPatch({ noteTypingPreviewEnabled: next });
        try { showToast(next ? "Typing note preview enabled." : "Typing note preview disabled.", 1800); } catch {}
      }
      else if (actionType === "resetLayout") resetLayout();
      else if (actionType === "helpGuide") await openExternal("https://abcplus.sourceforge.net/abcplus_en.pdf");
      else if (actionType === "helpUserGuide") await openExternal("https://github.com/topchyan/abcarus/blob/master/docs/USER_GUIDE.md");
      else if (actionType === "helpLink" && action && action.url) await openExternal(action.url);
      else if (actionType === "about") await openAbout();
      else if (actionType === "transformTransposeUp") await applyAbc2abcTransform({ transposeSemitones: 1 });
      else if (actionType === "transformTransposeDown") await applyAbc2abcTransform({ transposeSemitones: -1 });
      else if (actionType === "transformDouble") await applyAbc2abcTransform({ doubleLengths: true });
      else if (actionType === "transformHalf") await applyAbc2abcTransform({ halfLengths: true });
      else if (actionType === "transformMeasures" && action && Number.isFinite(action.value)) {
        await applyAbc2abcTransform({ measuresPerLine: action.value });
      }
      else if (actionType === "transformLinebreakMarkers") {
        await applyAbc2abcTransform({ linebreakMarker: true });
      }
      else if (actionType === "alignBars") alignBarsInEditor();
      else if (actionType === "openIntonationExplorer") {
        const enabled = latestSettingsSnapshot == null
          ? true
          : isMicrotonalNotationSupported();
        if (!enabled) {
          showToast("Microtonal notation support is disabled. Enable Settings → Options → Tools → Microtonal notation.", 4800);
          return;
        }
        intonationExplorerFeature.toggle();
      }
		      else if (actionType === "dumpDebug") debugDumpFeature.dumpToFile().catch(() => {});
		      else if (actionType === "settings" && settingsController) settingsController.openSettings();
		      else if (actionType === "fonts" && settingsController) {
		        if (typeof settingsController.openTab === "function") settingsController.openTab("fonts");
		        else settingsController.openSettings();
		      }
		      else if (actionType === "exportSettings") {
		        if (!window.api || typeof window.api.exportSettings !== "function") {
		          showToast("Export not available.", 2400);
		          return;
		        }
	        const res = await window.api.exportSettings();
	        if (res && res.ok) {
	          const note = res.exportedHeader ? " (incl. user_settings.abc)" : "";
	          showToast(`Settings exported${note} and will be used next time.`, 4200);
	        } else if (res && res.error && res.error !== "Canceled") {
	          showToast(String(res.error), 3200);
	        }
	      }
	      else if (actionType === "importSettings") {
	        if (!window.api || typeof window.api.importSettings !== "function") {
	          showToast("Import not available.", 2400);
	          return;
	        }
	        const res = await window.api.importSettings();
	        if (res && res.ok) {
	          showToast(
	            res.importedHeader
	              ? "Settings imported (incl. user_settings.abc) and will be used next time."
	              : "Settings imported and will be used next time.",
	            4200
	          );
	          refreshHeaderLayers().catch(() => {});
	        } else if (res && res.error && res.error !== "Canceled") {
	          showToast(String(res.error), 3200);
	        }
	      }
	      else if (actionType === "openSettingsFolder") {
	        if (!window.api || typeof window.api.openSettingsFolder !== "function") {
	          showToast("Not available.", 2400);
	          return;
	        }
	        const res = await window.api.openSettingsFolder();
	        if (res && res.ok) showToast("Opened settings folder.", 2000);
	      }
	      else if (actionType === "zoomIn" && settingsController) { if (!shouldIgnoreMenuZoomAction()) settingsController.zoomIn(); }
	      else if (actionType === "zoomOut" && settingsController) { if (!shouldIgnoreMenuZoomAction()) settingsController.zoomOut(); }
	      else if (actionType === "zoomReset" && settingsController) {
	        if (!shouldIgnoreMenuZoomAction()) {
          settingsController.zoomReset();
          requestAnimationFrame(() => centerRenderPaneOnCurrentAnchor());
        }
      }
      else if (actionType === "toggleFileHeader") toggleHeaderCollapsed();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

wireMenuActions();

if (window.api && typeof window.api.onAppRequestQuit === "function") {
  window.api.onAppRequestQuit(() => {
    requestQuitApplication();
  });
}

document.addEventListener("abcarus:reset-library-cache", () => {
  try {
    libraryViewStore.invalidate();
    scheduleRenderLibraryTree();
    if (document.body.classList.contains("library-list-open")) {
      const rows = libraryViewStore.getModalRows();
      document.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
    }
  } catch {}
});

settingsController = initSettings(window.api);
logStartupPerf("initSettings() done");
if (window.api && typeof window.api.getSettings === "function") {
  logStartupPerf("getSettings() start");
  window.api.getSettings().then((settings) => {
		      logStartupPerf("getSettings() done", { hasSettings: Boolean(settings) });
			      if (settings) {
			      const prevSettings = latestSettingsSnapshot;
			      latestSettingsSnapshot = settings;
			      syncPlaybackFxPreset(settings, prevSettings);
			      logStartupPerf("apply settings: begin");
			      setUiFontsFromSettings(settings);
			      setEditorHelpFromSettings(settings);
			      setGlobalHeaderFromSettings(settings);
			      setAbc2svgFontsFromSettings(settings);
	    setSoundfontFromSettings(settings);
	    setDrumVelocityFromSettings(settings);
      setPlaybackFxFromSettings(settings);
      midiInputFeature.applyMidiSettings(settings);
      midiInputFeature.applyNoteTypingPreviewSettings(settings);
	        setLayoutFromSettings(settings);
		      setFollowFromSettings(settings);
		      setLoopFromSettings(settings);
				      setPlaybackAutoScrollFromSettings(settings);
		        setPrintAllFromSettings(settings);
			      applyLibraryPrefsFromSettings(settings);
			      updateGlobalHeaderToggle();
		      updateErrorsFeatureUI();
		      refreshHeaderLayers().catch(() => {});
		      try {
		        if (settings && settings.payloadModeEnabled) payloadModeFeature.wire();
		      } catch {}
		      showDisclaimerIfNeeded(settings);
		      scheduleStartupLayoutReset();
		      logStartupPerf("apply settings: end");
	        markStartupSettingsApplied();
	    }
	    suppressLibraryPrefsWrite = false;
      if (!settings) markStartupSettingsApplied();
	  }).catch(() => {
      suppressLibraryPrefsWrite = false;
      markStartupSettingsApplied();
    });
}

if (window.api && typeof window.api.getFontDirs === "function") {
  window.api.getFontDirs().then((res) => {
    if (res && res.ok) {
      fontDirs = { bundledDir: String(res.bundledDir || ""), userDir: String(res.userDir || "") };
    }
  }).catch(() => {});
}
if (window.api && typeof window.api.onSettingsChanged === "function") {
  window.api.onSettingsChanged((settings) => {
    const prevSettings = latestSettingsSnapshot;
    latestSettingsSnapshot = settings || null;
    syncPlaybackFxPreset(settings, prevSettings);
	    const prevHeader = `${globalHeaderEnabled}|${globalHeaderText}|${abc2svgNotationFontFile}|${abc2svgTextFontFile}`;
	    const prevSoundfont = soundfontName;
      const prevChordproBinPath = prevSettings && prevSettings.chordproBinPath ? String(prevSettings.chordproBinPath) : "";
      const prevChordproRepoPath = prevSettings && prevSettings.chordproRepoPath ? String(prevSettings.chordproRepoPath) : "";
	    setUiFontsFromSettings(settings);
	    setEditorHelpFromSettings(settings);
	    setGlobalHeaderFromSettings(settings);
	    setAbc2svgFontsFromSettings(settings);
		    setSoundfontFromSettings(settings);
		    setDrumVelocityFromSettings(settings);
      setPlaybackFxFromSettings(settings);
      midiInputFeature.applyMidiSettings(settings);
      midiInputFeature.applyNoteTypingPreviewSettings(settings);
      setLayoutFromSettings(settings);
	    setFollowFromSettings(settings);
	    setLoopFromSettings(settings);
	    setPlaybackAutoScrollFromSettings(settings);
	    setPrintAllFromSettings(settings);
		    applyLibraryPrefsFromSettings(settings);
		    updateGlobalHeaderToggle();
	    updateErrorsFeatureUI();
	    refreshHeaderLayers().catch(() => {});
	    try {
	      const payloadEnabled = Boolean(settings && settings.payloadModeEnabled);
	      if (payloadEnabled) payloadModeFeature.wire();
	      if (!payloadEnabled && isPayloadMode()) payloadModeFeature.exit().catch(() => {});
	    } catch {}
	    try {
	      const microtonalEnabled = isMicrotonalNotationSupported(settings);
	      if (!microtonalEnabled && intonationExplorerFeature && intonationExplorerFeature.isVisible()) intonationExplorerFeature.close();
	    } catch {}
	    showDisclaimerIfNeeded(settings);
    if (settings && prevHeader !== `${globalHeaderEnabled}|${globalHeaderText}|${abc2svgNotationFontFile}|${abc2svgTextFontFile}`) {
      scheduleRenderNow();
    }
	    if (settings && prevSoundfont !== soundfontName) {
	      resetSoundfontCache();
	      if (player && typeof player.stop === "function") {
        suppressOnEnd = true;
        player.stop();
      }
      player = null;
      playbackState = null;
      playbackIndexOffset = 0;
	      ensureSoundfontLoaded().catch(() => setSoundfontStatus("Soundfont load failed", 5000));
	    }
      if (chordProFeature.isEnabled()) {
        const nextChordproBinPath = settings && settings.chordproBinPath ? String(settings.chordproBinPath) : "";
        const nextChordproRepoPath = settings && settings.chordproRepoPath ? String(settings.chordproRepoPath) : "";
        if (nextChordproBinPath !== prevChordproBinPath || nextChordproRepoPath !== prevChordproRepoPath) {
          chordProFeature.refreshPdfButtonState({ force: true }).catch(() => {});
        }
      }
	  });
	}
if (settingsController && editorView) {
  editorView.dom.addEventListener("focusin", () => {
    settingsController.setActivePane("editor");
  });
}

if ($renderPane && settingsController) {
  $renderPane.addEventListener("pointerdown", () => {
    settingsController.setActivePane("render");
  });
}

let lastZoomShortcutAtMs = 0;
function markZoomShortcut() {
  lastZoomShortcutAtMs = Date.now();
}
function shouldIgnoreMenuZoomAction() {
  return Date.now() - lastZoomShortcutAtMs < 150;
}

function centerRenderPaneOnCurrentAnchor() {
  if (!$out || !$renderPane || !editorView) return;
  const activeErrorHighlight = errorsHighlightState.getActive();
  const editorOffset = (activeErrorHighlight && Number.isFinite(activeErrorHighlight.from))
    ? activeErrorHighlight.from
    : editorView.state.selection.main.anchor;
  const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
    ? lastRenderPayload.offset
    : 0;
  const renderIdx = mapEditorOffsetToRenderIdx(Number(editorOffset));
  if (!Number.isFinite(renderIdx)) return;
  let els = $out.querySelectorAll("._" + renderIdx + "_");
  if ((!els || !els.length) && Number.isFinite(renderIdx)) {
    const maxBack = 200;
    for (let d = 1; d <= maxBack; d += 1) {
      const probe = renderIdx - d;
      if (probe < 0) break;
      els = $out.querySelectorAll("._" + probe + "_");
      if (els && els.length) break;
    }
  }
  if (!els || !els.length) return;
  const chosen = pickClosestNoteElement(Array.from(els));
  if (!chosen) return;
  const containerRect = $renderPane.getBoundingClientRect();
  const targetRect = chosen.getBoundingClientRect();
  const centerTop = targetRect.top - containerRect.top + $renderPane.scrollTop - ($renderPane.clientHeight / 2) + (targetRect.height / 2);
  const centerLeft = targetRect.left - containerRect.left + $renderPane.scrollLeft - ($renderPane.clientWidth / 2) + (targetRect.width / 2);
  $renderPane.scrollTop = Math.max(0, centerTop);
  $renderPane.scrollLeft = Math.max(0, centerLeft);
}

	// Prevent Chromium page-zoom shortcuts fighting the app's render/editor zoom.
	document.addEventListener("keydown", (e) => {
	  if (!settingsController) return;
	  const mod = e.ctrlKey || e.metaKey;
	  if (!mod || e.altKey) return;
	  const key = String(e.key || "");
	  const target = e.target;
	  const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
	  if (tag === "input" || tag === "textarea") return;

	  const isZoomIn = key === "+" || (key === "=" && e.shiftKey);
	  const isZoomOut = key === "-" || key === "_";
	  const isZoomReset = key === "0";
	  if (!isZoomIn && !isZoomOut && !isZoomReset) return;

	  e.preventDefault();
	  e.stopPropagation();
	  markZoomShortcut();

	  try {
	    // Prefer zooming the pane that has focus (or is under the event target).
	    const t = target || document.activeElement;
	    if ($renderPane && t && $renderPane.contains(t)) settingsController.setActivePane("render");
	    else if (editorView && editorView.dom && t && editorView.dom.contains(t)) settingsController.setActivePane("editor");
	  } catch {}
	  if (isZoomIn) settingsController.zoomIn();
	  else if (isZoomOut) settingsController.zoomOut();
	  else {
	    settingsController.zoomReset();
	    requestAnimationFrame(() => centerRenderPaneOnCurrentAnchor());
	  }
	}, true);

document.addEventListener("wheel", (e) => {
  if (!settingsController) return;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  try {
    // Zoom the pane under the pointer rather than the last "active" pane.
    const t = e.target;
    if ($renderPane && t && $renderPane.contains(t)) settingsController.setActivePane("render");
    else if (editorView && editorView.dom && t && editorView.dom.contains(t)) settingsController.setActivePane("editor");
  } catch {}
  const direction = e.deltaY > 0 ? -1 : 1;
  if (direction > 0) settingsController.zoomIn();
  else settingsController.zoomOut();
}, { passive: false });

document.addEventListener("keydown", (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (String(e.key || "").toLowerCase() !== "h") return;
  e.preventDefault();
  toggleHeaderCollapsed();
});

// Hidden debug shortcut:
// - Cmd/Ctrl+Shift+D dumps a debug JSON snapshot (primary)
// - Cmd/Ctrl+Alt+Shift+D dumps a debug JSON snapshot (fallback for DE conflicts)
// - Cmd/Ctrl+Shift+F9 dumps a debug JSON snapshot (alternate fallback)
document.addEventListener("keydown", (e) => {
  const key = String(e.key || "").toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  const isDumpChord = (mod && e.shiftKey && !e.altKey && key === "d")
    || (mod && e.altKey && e.shiftKey && key === "d")
    || (mod && e.shiftKey && !e.altKey && key === "f9");
  if (!isDumpChord) return;
  const target = e.target;
  const tag = target && target.tagName ? String(target.tagName).toLowerCase() : "";
  if (tag === "input" || tag === "textarea") return;
  e.preventDefault();
  debugDumpFeature.dumpToFile().catch(() => {});
});

async function openTemplatesModal() {
  await templatesFeature.open();
}

initContextMenu();

requestAnimationFrame(() => {
  // Do not reset zoom on startup. Persisted zoom is applied via settings.
  // We only need an initial split size application until settings load.
  try { applyRightSplitSizesFromRatio(); } catch {}
});

loadLastRecentEntry()
  .then((didStart) => {
    // Do not mark Ready here: settings may auto-load a library folder.
    // If settings are unavailable, fall back to Ready only when there was no recent to open.
    if (!didStart && !(window.api && typeof window.api.getSettings === "function")) {
      markStartupUiReady();
    } else {
      renderUnifiedStatus();
    }
  })
  .catch(() => {
    // Keep loading until settings apply decides, unless settings are unavailable.
    if (!(window.api && typeof window.api.getSettings === "function")) markStartupUiReady();
    else renderUnifiedStatus();
  });

if ($out) {
  $out.addEventListener("click", (e) => {
    const target = e.target;
    if (!target || !target.classList) return;
    if (!target.classList.contains("note-hl")) return;
    const start = Number(target.dataset && target.dataset.start);
    const end = Number(target.dataset && target.dataset.end);
    if (Number.isFinite(start)) {
      const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
        ? lastRenderPayload.offset
        : 0;
      const editorStart = Math.max(0, mapRenderIdxToEditorOffset(start));
      const editorEndRaw = Number.isFinite(end) && end > start ? end : start + 1;
      const editorEnd = Math.max(editorStart, mapRenderIdxToEditorOffset(editorEndRaw));
      pendingPlaybackRangeOrigin = "svg";
      setEditorSelectionRange(editorStart, editorEnd);
      setPlaybackRange({
        startOffset: editorStart,
        endOffset: editorEnd,
        origin: "svg",
        loop: playbackRange.loop,
      });
    }
  });
}

if ($disclaimerOk) {
  $disclaimerOk.addEventListener("click", () => {
    dismissDisclaimer();
  });
}

if ($disclaimerModal) {
  $disclaimerModal.addEventListener("keydown", (e) => {
    if (!e) return;
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      dismissDisclaimer();
    }
  });
  enableDraggableModal($disclaimerModal);
}

if ($fileHeaderSave) {
  $fileHeaderSave.addEventListener("click", async () => {
    const entry = getActiveFileEntry();
    if (!entry || !entry.path) {
      setStatus("No active file to update.");
      return;
    }
    try {
      try { await flushWorkingCopyTuneSync(); } catch {}
      const headerRes = await saveFileHeaderText(entry.path, getHeaderEditorValue());
      if (headerRes && headerRes.ok) {
        headerDirty = false;
        updateHeaderStateUI();
        setStatus(headerRes.action === "save_copy_as" ? "Saved copy and switched." : "Header saved.");
      } else if (headerRes && headerRes.action === "discard_reload") {
        headerEditorFilePath = null;
        headerDirty = false;
        updateHeaderStateUI();
        updateFileHeaderPanel();
        setStatus("Reloaded from disk.");
      } else {
        setStatus("Save canceled.");
        updateHeaderStateUI();
      }
    } catch (e) {
      await showSaveError(e && e.message ? e.message : String(e));
    }
  });
}

if ($fileHeaderReload) {
  $fileHeaderReload.addEventListener("click", () => {
    headerEditorFilePath = null;
    headerDirty = false;
    updateFileHeaderPanel();
  });
}

if ($fileHeaderToggle) {
  $fileHeaderToggle.addEventListener("click", () => {
    if (!getActiveFileEntry()) {
      showToast("No library file loaded.", 2400);
      return;
    }
    toggleHeaderCollapsed();
  });
}

// ---------- AUDIO ----------

let player = null;
let playerConfig = null;
var isPlaying = false;
let isPaused = false;
let suppressOnEnd = false;
let desiredPlayerSpeed = 1;
let lastPlaybackIdx = null;
let lastRenderIdx = null;
let lastStartPlaybackIdx = 0;
let resumeStartIdx = null;
let pausedSelectionSignature = null;
let playbackState = null;
let playbackIndexOffset = 0;
let lastDrumPlaybackActive = false;
let waitingForFirstNote = false;
let isPreviewing = false;
let followPlayback = true;
let followHighlightColor = "#1e90ff";
let followMeasureColor = "";
let followHighlightBarOpacity = 0.12;
let followMeasureOpacity = 0.08;
let followPlayheadOpacity = 0.7;
let followPlayheadWidth = 2;
let followPlayheadPad = 8;
let followPlayheadBetweenNotesWeight = 1;
let followPlayheadShift = 0;
let followPlayheadFirstBias = 6;
let playbackAutoScrollMode = "keep";
let playbackAutoScrollHorizontal = true;
let playbackAutoScrollPauseMs = 1800;
let playbackAutoScrollManualUntil = 0;
let playbackAutoScrollIgnoreUntil = 0;
let playbackAutoScrollAnim = null; // {raf,startAt,duration,fromTop,fromLeft,toTop,toLeft}
let playbackAutoScrollProgrammatic = false;
let playbackAutoScrollLastAt = 0;
let playbackAutoScrollDebugLastAt = 0;
let followVoiceId = null;
let followVoiceIndex = null;
let drumVelocityMap = buildDefaultDrumVelocityMap();
let lastPlaybackMeta = null;
let lastDrumInjectInput = null;
let lastDrumInjectResult = null;
let lastPlaybackPayloadCache = null;
let lastSoundfontApplied = null;
let lastPreparedPlaybackKey = null;
let playbackNoteTrace = [];
let playbackParseErrors = [];
let playbackSanitizeWarnings = [];
let lastPlaybackTuneInfo = null;
let lastPlaybackOnIstart = null;
let lastPlaybackHasParts = false;
let pendingPlaybackUiIstart = null;
let pendingPlaybackUiRaf = null;
let lastPlaybackNoteOnEls = [];
let lastPlaybackUiRenderIdx = null;
let lastPlaybackUiEditorIdx = null;
let lastPlaybackUiScrollAt = 0;
let lastDrumSignatureDiff = null;
let lastDrumMismatchErrorKey = null;
let lastDrumMismatchTuneId = null;
let lastDrumMismatchInfo = null;
let lastPlaybackChordOnBarError = false;
let lastMeterMismatchToastKey = null;
let lastPlaybackMeterMismatchWarning = null;
let lastRepeatShortBarToastKey = null;
let lastPlaybackRepeatShortBarWarning = null;
let lastMidiDrumCompatToastKey = null;
let lastPlaybackKeyOrderWarning = null;
let playbackStartToken = 0;
let lastPlaybackGuardMessage = "";
let lastPlaybackAbortMessage = "";
let lastPlaybackException = null; // { phase, message, stack }
let playbackNeedsReprepare = false;

let focusModeEnabled = false;
let focusPrevRenderZoom = null;
let focusPrevLibraryVisible = null;

const PLAYBACK_FX_PRESETS = Object.freeze({
  Off: { reverb: 0, chorus: 0 },
  Room: { reverb: 28, chorus: 12 },
  Hall: { reverb: 48, chorus: 18 },
});

function normalizePlaybackFxPreset(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Custom";
  if (raw === "Custom" || raw === "Off" || raw === "Room" || raw === "Hall") return raw;
  return "Custom";
}

function clampPlaybackFxValue(value, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(127, Math.round(v)));
}

function resolvePlaybackFxSettings(settings) {
  if (!settings || typeof settings !== "object") return settings;
  const preset = normalizePlaybackFxPreset(settings.playbackMidiFxPreset);
  const presetValues = PLAYBACK_FX_PRESETS[preset];
  if (!presetValues) return settings;
  return {
    playbackMidiReverb: clampPlaybackFxValue(presetValues.reverb, 0),
    playbackMidiChorus: clampPlaybackFxValue(presetValues.chorus, 0),
  };
}

function syncPlaybackFxPreset(settings, prevSettings) {
  if (!settings || typeof settings !== "object") return;
  const preset = normalizePlaybackFxPreset(settings.playbackMidiFxPreset);
  const presetValues = PLAYBACK_FX_PRESETS[preset];
  if (!presetValues) return;

  const reverb = clampPlaybackFxValue(settings.playbackMidiReverb, presetValues.reverb);
  const chorus = clampPlaybackFxValue(settings.playbackMidiChorus, presetValues.chorus);
  if (reverb === presetValues.reverb && chorus === presetValues.chorus) return;

  const prevPreset = prevSettings ? normalizePlaybackFxPreset(prevSettings.playbackMidiFxPreset) : preset;
  const presetChanged = preset !== prevPreset;
  if (presetChanged) {
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackMidiReverb: presetValues.reverb, playbackMidiChorus: presetValues.chorus }).catch(() => {});
    }
    return;
  }

  if (window.api && typeof window.api.updateSettings === "function") {
    window.api.updateSettings({ playbackMidiFxPreset: "Custom" }).catch(() => {});
  }
}

function applyPlaybackFxToConfig(conf, settings) {
  if (!conf) return;
  const src = resolvePlaybackFxSettings(settings || latestSettingsSnapshot || {});
  const toLevel = (value) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.max(1, Math.min(127, Math.round(v)));
  };
  conf.reverb = toLevel(src.playbackMidiReverb);
  conf.chorus = toLevel(src.playbackMidiChorus);
}

function setPlaybackFxFromSettings(settings) {
  if (!playerConfig) return;
  applyPlaybackFxToConfig(playerConfig, settings);
}

function setRenderZoomCss(zoom) {
  const v = Number(zoom);
  if (!Number.isFinite(v) || v <= 0) return;
  try { document.documentElement.style.setProperty("--render-zoom", String(v)); } catch {}
}

function readRenderZoomCss() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
    const v = Number(String(raw || "").trim());
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return getRenderZoomFactor();
}

function computeFocusFitZoom() {
  if (!$renderPane || !$out) return null;
  const svgs = Array.from($out.querySelectorAll("svg"));
  if (!svgs.length) return null;
  const currentZoom = getRenderZoomFactor();
  if (!Number.isFinite(currentZoom) || currentZoom <= 0) return null;
  const paneWidth = $renderPane.clientWidth || 0;
  if (paneWidth < 50) return null;
  // Use the widest SVG (not just the first one) to avoid overshooting zoom when the first
  // page/system is unusually narrow.
  let maxIntrinsicWidth = 0;
  const limit = Math.min(8, svgs.length);
  for (let i = 0; i < limit; i += 1) {
    const r = svgs[i] ? svgs[i].getBoundingClientRect() : null;
    if (!(r && r.width > 10)) continue;
    const w = r.width / currentZoom;
    if (Number.isFinite(w) && w > maxIntrinsicWidth) maxIntrinsicWidth = w;
  }
  if (!Number.isFinite(maxIntrinsicWidth) || maxIntrinsicWidth <= 10) return null;
  const target = Math.max(100, paneWidth - 24);
  const next = target / maxIntrinsicWidth;
  return clampNumber(next, 0.5, 8, currentZoom);
}

function updateFocusModeUi() {
  document.body.classList.toggle("focus-mode", focusModeEnabled);
  if ($btnFocusMode) {
    $btnFocusMode.classList.toggle("toggle-active", focusModeEnabled);
    $btnFocusMode.setAttribute("aria-pressed", focusModeEnabled ? "true" : "false");
  }
  updatePracticeUi();
}

function setFocusModeEnabled(nextEnabled) {
  const next = Boolean(nextEnabled);
  if (focusModeEnabled === next) return;
  if (rawMode && next) {
    showToast("Exit Raw mode to use Focus.", 2200);
    return;
  }
  focusModeEnabled = next;
  // Apply the focus-mode class immediately so layout-dependent measurements (fit zoom)
  // are based on the Focus layout, not the pre-toggle layout.
  updateFocusModeUi();
  if (focusModeEnabled) {
    focusPrevRenderZoom = readRenderZoomCss();
    focusPrevLibraryVisible = isLibraryVisible;
    // Start from a neutral zoom so Focus computes fit independently of the previous layout/zoom.
    // (Fit will be applied after layout settles.)
    setRenderZoomCss(1);
    if (isLibraryVisible) {
      setLibraryVisible(false, { persist: false });
      requestAnimationFrame(() => {
        try { resetRightPaneSplit(); } catch {}
      });
    }
    // Wait for layout to settle (library hide + split reset) before computing fit.
    // A single rAF can still measure old widths when the DOM is busy; double rAF avoids that.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!focusModeEnabled) return;
        const fit = computeFocusFitZoom();
        // Focus is a "stage" mode: it chooses the zoom independently to reduce unused margins
        // and keep the score readable during playback (restored on exit).
        if (fit != null) setRenderZoomCss(fit);
        if (window.__abcarusDebugFocus) {
          try {
            const cssZoom = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
            console.log("[abcarus][focus] apply " + JSON.stringify({
              fit,
              cssZoom: String(cssZoom || "").trim(),
            }));
          } catch {}
        }
      });
    });
  } else if (focusPrevRenderZoom != null) {
    setRenderZoomCss(focusPrevRenderZoom);
    focusPrevRenderZoom = null;
    if (focusPrevLibraryVisible) {
      setLibraryVisible(true, { persist: false });
      requestAnimationFrame(() => {
        try { resetRightPaneSplit(); } catch {}
      });
    }
    focusPrevLibraryVisible = null;
  }
  if (focusModeEnabled) {
    maybeResetFocusLoopForTune(activeTuneId, { updateUi: false });
  } else {
    // Leaving Focus should not "stick" to the last Focus loop plan.
    // Recompute transport playback plan from the normal-mode playhead.
    pendingPlaybackRangeOrigin = null;
    pendingPlaybackPlan = null;
    currentPlaybackPlan = null;
    syncPendingPlaybackPlan();
  }
}

function toggleFocusMode() {
  setFocusModeEnabled(!focusModeEnabled);
}

function clearPlaybackNoteOnEls() {
  for (const el of lastPlaybackNoteOnEls) {
    try { el.classList.remove("note-on"); } catch {}
  }
  lastPlaybackNoteOnEls = [];
}

function resetPlaybackUiState() {
  clearPlaybackNoteOnEls();
  clearSvgPlayhead();
  clearSvgFollowBarHighlight();
  clearSvgFollowMeasureHighlight();
  clearSvgPracticeBarHighlight();
  setPracticeBarHighlight(null);
  lastPlaybackUiRenderIdx = null;
  lastPlaybackUiEditorIdx = null;
  pendingPlaybackUiIstart = null;
  if (pendingPlaybackUiRaf != null) {
    try { cancelAnimationFrame(pendingPlaybackUiRaf); } catch {}
    pendingPlaybackUiRaf = null;
  }
  playbackAutoScrollManualUntil = 0;
  cancelPlaybackAutoScroll();
}

function normalizeAutoScrollMode(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "keep";
  if (s.startsWith("off")) return "off";
  if (s.startsWith("page")) return "page";
  if (s.startsWith("center")) return "center";
  return "keep";
}

function debugAutoScroll(tag, detail) {
  if (!window.__abcarusDebugAutoscroll) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - playbackAutoScrollDebugLastAt < 600) return;
  playbackAutoScrollDebugLastAt = now;
  try {
    const debug = (detail && typeof detail === "object") ? { ...detail } : {};
    debug.zoom = Math.round(getRenderZoomFactor() * 100) / 100;
    try {
      debug.cssZoom = String(getComputedStyle(document.documentElement).getPropertyValue("--render-zoom") || "").trim();
    } catch {
      debug.cssZoom = "";
    }
    try {
      debug.outZoom = $out ? String(getComputedStyle($out).zoom || "").trim() : "";
    } catch {
      debug.outZoom = "";
    }
    if ($renderPane) {
      debug.pane = {
        top: Math.round($renderPane.scrollTop),
        left: Math.round($renderPane.scrollLeft),
        scrollH: Math.round($renderPane.scrollHeight),
        scrollW: Math.round($renderPane.scrollWidth),
        clientH: Math.round($renderPane.clientHeight),
        clientW: Math.round($renderPane.clientWidth),
      };
    }
    const msgParts = [`[abcarus][autoscroll] ${tag}`];
    if (debug.mode) msgParts.push(`mode=${debug.mode}`);
    if (Number.isFinite(debug.zoom)) msgParts.push(`z=${debug.zoom}`);
    if (debug.cssZoom) msgParts.push(`css=${debug.cssZoom}`);
    if (debug.outZoom) msgParts.push(`out=${debug.outZoom}`);
    if (Number.isFinite(debug.clampedTop) && Number.isFinite(debug.nextTop)) {
      msgParts.push(`top=${debug.clampedTop}/${Math.round(debug.nextTop)}`);
    }
    if (Number.isFinite(debug.cursorTop) && Number.isFinite(debug.cursorBottom) && Number.isFinite(debug.viewTop) && Number.isFinite(debug.viewBottom)) {
      msgParts.push(`cursorY=${debug.cursorTop}..${debug.cursorBottom}`);
      msgParts.push(`viewY=${debug.viewTop}..${debug.viewBottom}`);
    }
    if (debug.pane && Number.isFinite(debug.pane.scrollH) && Number.isFinite(debug.pane.clientH)) {
      msgParts.push(`scrollY=${debug.pane.top}/${Math.max(0, debug.pane.scrollH - debug.pane.clientH)}`);
    }
    console.log(msgParts.join(" "), debug);
  } catch {}
}

function initPlaybackAutoScrollListeners() {
  if (!$renderPane) return;
  const markManual = () => {
    const ms = clampNumber(playbackAutoScrollPauseMs, 0, 5000, 1800);
    playbackAutoScrollManualUntil = (typeof performance !== "undefined" ? performance.now() : Date.now()) + ms;
  };
  $renderPane.addEventListener("wheel", () => markManual(), { passive: true });
  $renderPane.addEventListener("pointerdown", () => markManual(), { passive: true });
  $renderPane.addEventListener("scroll", () => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now < playbackAutoScrollIgnoreUntil) return;
    if (playbackAutoScrollProgrammatic) return;
    if (playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null) return;
    markManual();
  }, { passive: true });
}

function cancelPlaybackAutoScroll() {
  if (playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null) {
    try { cancelAnimationFrame(playbackAutoScrollAnim.raf); } catch {}
  }
  playbackAutoScrollAnim = null;
  playbackAutoScrollProgrammatic = false;
}

function animateRenderPaneScrollTo(targetTop, targetLeft, durationMs) {
  if (!$renderPane) return;
  const maxTop = Math.max(0, $renderPane.scrollHeight - $renderPane.clientHeight);
  const maxLeft = Math.max(0, $renderPane.scrollWidth - $renderPane.clientWidth);
  const toTop = Math.max(0, Math.min(maxTop, Number(targetTop) || 0));
  const toLeft = Math.max(0, Math.min(maxLeft, Number(targetLeft) || 0));

  const fromTop = $renderPane.scrollTop;
  const fromLeft = $renderPane.scrollLeft;
  const dx = Math.abs(toLeft - fromLeft);
  const dy = Math.abs(toTop - fromTop);
  if (dx < 1 && dy < 1) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const duration = clampNumber(durationMs, 0, 2000, 250);
  cancelPlaybackAutoScroll();
  playbackAutoScrollProgrammatic = true;
  playbackAutoScrollIgnoreUntil = now + Math.min(2500, Math.max(200, duration + 100));

  playbackAutoScrollAnim = {
    raf: null,
    startAt: now,
    duration,
    fromTop,
    fromLeft,
    toTop,
    toLeft,
  };

  const step = (tNow) => {
    if (!$renderPane || !playbackAutoScrollAnim) return;
    const a = playbackAutoScrollAnim;
    const t = a.duration > 0 ? Math.max(0, Math.min(1, (tNow - a.startAt) / a.duration)) : 1;
    const ease = 1 - Math.pow(1 - t, 3);
    const nextTop = a.fromTop + (a.toTop - a.fromTop) * ease;
    const nextLeft = a.fromLeft + (a.toLeft - a.fromLeft) * ease;
    $renderPane.scrollTop = nextTop;
    $renderPane.scrollLeft = nextLeft;
    if (t < 1) {
      a.raf = requestAnimationFrame(step);
    } else {
      playbackAutoScrollAnim = null;
      playbackAutoScrollProgrammatic = false;
    }
  };
  playbackAutoScrollAnim.raf = requestAnimationFrame(step);
}

function getRenderZoomFactor() {
  try {
    // Source of truth: the CSS custom property (set by Settings and Focus mode).
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
    const v = Number(String(raw || "").trim());
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  try {
    // Fallback for environments where CSS custom properties may not be readable (should be rare).
    if ($out) {
      const raw = getComputedStyle($out).zoom;
      const v = Number(String(raw || "").trim());
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch {}
  const fromSettings = latestSettingsSnapshot && Number(latestSettingsSnapshot.renderZoom);
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
    const v = Number(String(raw || "").trim());
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return 1;
}

function maybeAutoScrollRenderToCursor(el) {
  if (!$renderPane) return;
  if (!el) {
    debugAutoScroll("skip:no-el");
    return;
  }
  if (!isPlaybackBusy()) {
    debugAutoScroll("skip:not-busy");
    return;
  }

  const mode = normalizeAutoScrollMode(playbackAutoScrollMode);
  if (mode === "off") {
    debugAutoScroll("skip:mode-off");
    return;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now < playbackAutoScrollManualUntil) {
    debugAutoScroll("skip:manual-pause", {
      mode,
      remainingMs: Math.round(playbackAutoScrollManualUntil - now),
      programmatic: Boolean(playbackAutoScrollProgrammatic),
      animating: Boolean(playbackAutoScrollAnim && playbackAutoScrollAnim.raf != null),
    });
    return;
  }
  if (now - playbackAutoScrollLastAt < 80) {
    debugAutoScroll("skip:throttle", { mode });
    return;
  }
  playbackAutoScrollLastAt = now;

  const targetEl = lastSvgPlayheadEl || el;
  if (!targetEl) {
    debugAutoScroll("skip:no-target-el", { mode });
    return;
  }
  const containerRect = $renderPane.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const viewTop = $renderPane.scrollTop;
  const viewBottom = viewTop + $renderPane.clientHeight;
  const viewLeft = $renderPane.scrollLeft;
  const viewRight = viewLeft + $renderPane.clientWidth;

  const h = $renderPane.clientHeight || 1;
  const w = $renderPane.clientWidth || 1;
  const playheadH = targetRect.height;
  const topMargin = Math.max(40, h * 0.15);
  const bottomMargin = mode === "keep"
    ? Math.max(40, h * 0.15 + playheadH * 2.2)
    : Math.max(40, h * (mode === "page" ? 0.25 : 0.15), playheadH * 0.8);
  const leftMargin = Math.max(40, w * 0.12);
  const rightMargin = Math.max(40, w * 0.12);

  const allowH = Boolean(playbackAutoScrollHorizontal);

  // For "keep" / "center", let the browser compute correct scroll positions under zoom
  // (CSS zoom can desync getBoundingClientRect from scrollTop on some platforms).
  // We do a fast "auto" scrollIntoView to compute targets, then animate ourselves.
  if (mode === "keep" || mode === "center") {
    const padTop = mode === "keep" ? topMargin : 0;
    const padBottom = mode === "keep" ? bottomMargin : 0;
    const padLeft = allowH ? (mode === "keep" ? leftMargin : 0) : 0;
    const padRight = allowH ? (mode === "keep" ? rightMargin : 0) : 0;

    try {
      $renderPane.style.scrollPaddingTop = `${Math.round(padTop)}px`;
      $renderPane.style.scrollPaddingBottom = `${Math.round(padBottom)}px`;
      $renderPane.style.scrollPaddingLeft = `${Math.round(padLeft)}px`;
      $renderPane.style.scrollPaddingRight = `${Math.round(padRight)}px`;
    } catch {}

    const fromTop = viewTop;
    const fromLeft = viewLeft;
    let toTop = viewTop;
    let toLeft = viewLeft;
    try {
      playbackAutoScrollProgrammatic = true;
      playbackAutoScrollIgnoreUntil = now + 250;
      targetEl.scrollIntoView({
        block: mode === "center" ? "center" : "nearest",
        inline: allowH ? (mode === "center" ? "center" : "nearest") : "nearest",
        behavior: "auto",
      });
      toTop = $renderPane.scrollTop;
      toLeft = allowH ? $renderPane.scrollLeft : fromLeft;
    } catch {
      // ignore
    } finally {
      try {
        $renderPane.scrollTop = fromTop;
        $renderPane.scrollLeft = fromLeft;
      } catch {}
      playbackAutoScrollProgrammatic = false;
    }

    const relTop = targetRect.top - containerRect.top;
    const relBottom = relTop + targetRect.height;
    const relLeft = targetRect.left - containerRect.left;
    const relRight = relLeft + targetRect.width;

    // Deterministic follow: avoid smooth animation lag during playback.
    const duration = 0;
    const maxTop = Math.max(0, $renderPane.scrollHeight - $renderPane.clientHeight);
    const maxLeft = Math.max(0, $renderPane.scrollWidth - $renderPane.clientWidth);
    const clampedTop = Math.max(0, Math.min(maxTop, Number(toTop) || 0));
    const clampedLeft = Math.max(0, Math.min(maxLeft, Number(toLeft) || 0));
    const dx = Math.abs(clampedLeft - viewLeft);
    const dy = Math.abs(clampedTop - viewTop);
    debugAutoScroll(dx < 1 && dy < 1 ? "noop" : "scroll", {
      mode,
      viewTop: Math.round(viewTop),
      viewBottom: Math.round(viewBottom),
      viewLeft: Math.round(viewLeft),
      viewRight: Math.round(viewRight),
      cursorTop: Math.round(viewTop + relTop),
      cursorBottom: Math.round(viewTop + relBottom),
      cursorLeft: Math.round(viewLeft + relLeft),
      cursorRight: Math.round(viewLeft + relRight),
      nextTop: Math.round(toTop),
      nextLeft: Math.round(toLeft),
      clampedTop: Math.round(clampedTop),
      clampedLeft: Math.round(clampedLeft),
      maxTop: Math.round(maxTop),
      maxLeft: Math.round(maxLeft),
      topMargin: Math.round(topMargin),
      bottomMargin: Math.round(bottomMargin),
      leftMargin: Math.round(leftMargin),
      rightMargin: Math.round(rightMargin),
    });
    if (dx < 1 && dy < 1) return;
    animateRenderPaneScrollTo(clampedTop, clampedLeft, duration);
    return;
  }

  // Work entirely in scroll container pixel space:
  // - rect deltas are viewport pixels
  // - scrollTop/Left deltas are also viewport pixels
  const relTop = targetRect.top - containerRect.top;
  const relBottom = relTop + targetRect.height;
  const relLeft = targetRect.left - containerRect.left;
  const relRight = relLeft + targetRect.width;

  let nextTop = viewTop;
  let nextLeft = viewLeft;

  if (mode === "center") {
    const desiredTop = h * 0.5 - targetRect.height * 0.5;
    nextTop = viewTop + (relTop - desiredTop);
  } else if (mode === "page") {
    const desiredTop = h * 0.1;
    if (relBottom > h - bottomMargin) {
      nextTop = viewTop + (relTop - desiredTop);
    } else if (relTop < topMargin) {
      nextTop = viewTop + (relTop - desiredTop);
    }
  } else {
    if (relTop < topMargin) {
      nextTop = viewTop + (relTop - topMargin);
    } else if (relBottom > h - bottomMargin) {
      nextTop = viewTop + (relBottom - (h - bottomMargin));
    }
  }

  if (allowH) {
    if (mode === "center") {
      const desiredLeft = w * 0.5 - targetRect.width * 0.5;
      nextLeft = viewLeft + (relLeft - desiredLeft);
    } else {
      if (relLeft < leftMargin) {
        nextLeft = viewLeft + (relLeft - leftMargin);
      } else if (relRight > w - rightMargin) {
        nextLeft = viewLeft + (relRight - (w - rightMargin));
      }
    }
  }

  // Deterministic follow: avoid smooth animation lag during playback.
  const duration = 0;
  const maxTop = Math.max(0, $renderPane.scrollHeight - $renderPane.clientHeight);
  const maxLeft = Math.max(0, $renderPane.scrollWidth - $renderPane.clientWidth);
  const clampedTop = Math.max(0, Math.min(maxTop, Number(nextTop) || 0));
  const clampedLeft = Math.max(0, Math.min(maxLeft, Number(nextLeft) || 0));
  const dx = Math.abs(clampedLeft - viewLeft);
  const dy = Math.abs(clampedTop - viewTop);
  debugAutoScroll(dx < 1 && dy < 1 ? "noop" : "scroll", {
    mode,
    viewTop: Math.round(viewTop),
    viewBottom: Math.round(viewBottom),
    viewLeft: Math.round(viewLeft),
    viewRight: Math.round(viewRight),
    cursorTop: Math.round(viewTop + relTop),
    cursorBottom: Math.round(viewTop + relBottom),
    cursorLeft: Math.round(viewLeft + relLeft),
    cursorRight: Math.round(viewLeft + relRight),
    topMargin: Math.round(topMargin),
    bottomMargin: Math.round(bottomMargin),
    leftMargin: Math.round(leftMargin),
    rightMargin: Math.round(rightMargin),
    nextTop: Math.round(nextTop),
    nextLeft: Math.round(nextLeft),
    clampedTop: Math.round(clampedTop),
    clampedLeft: Math.round(clampedLeft),
    maxTop: Math.round(maxTop),
    maxLeft: Math.round(maxLeft),
    relTop: Math.round(relTop),
    relBottom: Math.round(relBottom),
    relLeft: Math.round(relLeft),
    relRight: Math.round(relRight),
  });
  if (dx < 1 && dy < 1) return;
  animateRenderPaneScrollTo(clampedTop, clampedLeft, duration);
}

function playbackGuardError(message) {
  console.error(`[abcarus][playback-range] ${message}`);
}

function stopPlaybackFromGuard(message) {
  lastPlaybackGuardMessage = String(message || "");
  try { recordDebugLog("warn", [`Playback guard: ${lastPlaybackGuardMessage}`]); } catch {}
  playbackGuardError(message);
  try { scheduleAutoDump("playback-guard", lastPlaybackGuardMessage); } catch {}
  playbackStartToken += 1;
  const wasSelectionOrigin = activePlaybackRange && activePlaybackRange.origin === "selection";
  if (player && (isPlaying || isPaused) && typeof player.stop === "function") {
    suppressOnEnd = true;
    try { player.stop(); } catch {}
  }
  isPlaying = false;
  isPaused = false;
  waitingForFirstNote = false;
  resumeStartIdx = null;
  activePlaybackRange = null;
  activePlaybackEndAbcOffset = null;
  activePlaybackEndSymbol = null;
  activeLoopRange = null;
  playbackStartArmed = false;
  currentPlaybackPlan = null;
  pendingPlaybackPlan = null;
  setStatus("OK");
  updatePlayButton();
  clearNoteSelection();
  resetPlaybackUiState();
  if (wasSelectionOrigin) selectionPlaybackRuntime.restoreSelection(editorView);
  selectionPlaybackRuntime.clearSelectionCapture();
}

function clonePlaybackRange(r) {
  if (!r || typeof r !== "object") {
    return { startOffset: 0, endOffset: null, origin: "cursor", loop: false, suppressRepeats: null };
  }
  return {
    startOffset: Number(r.startOffset) || 0,
    endOffset: (r.endOffset == null) ? null : Number(r.endOffset),
    origin: r.origin || "cursor",
    loop: Boolean(r.loop),
    suppressRepeats: (typeof r.suppressRepeats === "boolean") ? Boolean(r.suppressRepeats) : null,
  };
}

function setPlaybackRange(next) {
  const nextRange = clonePlaybackRange(next);

  if (isPlaying) {
    if (activePlaybackRange && activePlaybackRange.loop && nextRange.startOffset !== activePlaybackRange.startOffset) {
      stopPlaybackFromGuard("Looping PlaybackRange.startOffset mutated during playback.");
      return;
    }
    playbackGuardError("PlaybackRange updated while playing; change deferred until stop.");
    return;
  }

  playbackRange = nextRange;
}

function updatePlaybackRangeFromSelection(selection, origin) {
  if (!selection || !editorView) return;
  if (isPlaying) return;
  // While an error anchor is active, keep the error-derived PlaybackRange stable and loopable.
  // The user can move the cursor to fix the error without losing the loop range.
  const activeErrorHighlight = errorsHighlightState.getActive();
  if (activeErrorHighlight && playbackRange && playbackRange.origin === "error" && playbackRange.loop) return;
  const max = editorView.state.doc.length;
  const main = selection.main || null;
  if (!main) return;

  const anchor = Math.max(0, Math.min(Number(main.anchor) || 0, max));
  const head = Math.max(0, Math.min(Number(main.head) || 0, max));
  const start = Math.min(anchor, head);
  const end = Math.max(anchor, head);
  const isRange = end > start;

  setPlaybackRange({
    startOffset: start,
    endOffset: isRange ? end : null,
    origin: origin || (isRange ? "selection" : "cursor"),
    loop: Boolean(activeErrorHighlight && playbackRange.loop),
  });
}

function appendPlaybackTrace(evt) {
  if (!evt) return;
  playbackNoteTrace.push(evt);
  const max = 2000;
  if (playbackNoteTrace.length > max) {
    playbackNoteTrace = playbackNoteTrace.slice(playbackNoteTrace.length - max);
  }
}

function getPlaybackSourceKey() {
  if (chordProFeature.isEnabled() && chordProFeature.isFullView()) return "chordpro-full";
  if (chordProFeature.isEnabled() && !chordProFeature.hasBlocks()) return "chordpro-empty";
  const tuneText = getEditorValue();
  if (isPayloadMode()) {
    if (payloadModeFeature.isPlaybackView()) {
      const offset = 0;
      const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
      const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
      // Playback view shows the final text; don't re-sanitize or inject.
      return `payloadFinal|||${String(tuneText || "")}|||${offset}|||${repeatsFlag}`;
    }
    const offset = 0;
    const preparedText = normalizeBlankLinesForPlayback(
      normalizeDollarLineBreaksForPlayback(String(tuneText || ""))
    );
    const sanitized = sanitizeAbcForPlayback(preparedText);
    const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
    const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
    // Key includes the sanitized payload text and offset. No header merge or injected directives in payload mode.
    return `payload|||${sanitized.text}|||${offset}|||${repeatsFlag}`;
  }
  const entry = chordProFeature.isEnabled() ? null : getActiveFileEntry();
  const prefixPayload = buildHeaderPrefix(entry ? getHeaderEditorValue() : "", false, tuneText);
  const baseText = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
  const injected = injectGchordOn(baseText, prefixPayload.offset || 0);
  const gchordText = injected && injected.changed ? injected.text : baseText;
  const drumPreview = injectDrumPlayback(gchordText);
  const preparedText = normalizeBlankLinesForPlayback(
    normalizeDollarLineBreaksForPlayback(drumPreview && drumPreview.changed ? drumPreview.text : gchordText)
  );
  const sanitized = sanitizeAbcForPlayback(preparedText);
  const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
  const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
  // Key includes the post-gchord text and the effective expansion mode to avoid reusing a mismatched playbackState.
  return `${sanitized.text}|||${prefixPayload.offset || 0}|||${repeatsFlag}`;
}

function updatePlayButton() {
  if ($btnPlay) {
    $btnPlay.classList.toggle("active", Boolean(isPlaying));
    $btnPlay.disabled = false;
  }
  if ($btnPause) {
    $btnPause.classList.toggle("active", Boolean(isPaused));
    $btnPause.disabled = !(isPlaying || isPaused);
  }
  if ($btnStop) {
    $btnStop.disabled = !(isPlaying || isPaused || waitingForFirstNote);
  }
  if ($btnPlayPause) {
    $btnPlayPause.classList.toggle("active", Boolean(isPlaying || isPaused));
    $btnPlayPause.disabled = false;
    $btnPlayPause.classList.toggle("is-playing", Boolean(isPlaying));
    if (isPlaying) setButtonText($btnPlayPause, "Pause");
    else if (isPaused) setButtonText($btnPlayPause, "Resume");
    else setButtonText($btnPlayPause, "Play");
  }
  updatePlaybackInteractionLock();
  updatePracticeUi();
  updateAbUi();
}

function isPlaybackBusy() {
  return Boolean(isPlaying || isPaused || waitingForFirstNote);
}

function updatePlaybackInteractionLock() {
  const busy = isPlaybackBusy();
  const disable = (el, allowWhileBusy = false) => {
    if (!el) return;
    el.disabled = busy && !allowWhileBusy;
  };

  // Allowlist during playback: transport controls + view-only controls (zoom is via menu).
  disable($btnPlay, true);
  disable($btnPause, true);
  disable($btnPlayPause, true);
  disable($btnStop, true);
  disable($btnResetLayout, true);
  disable($btnFocusMode, true);

  // Block file/library/tool actions while playing/paused/loading to prevent state races.
  disable($btnToggleLibrary);
  disable($btnLibraryRefresh);
  disable($btnLibraryClearFilter);
  disable($groupBy);
  disable($sortBy);
  disable($sortTunesBy);
  disable($librarySearch);
  disable($fileTuneSelect);

  disable($btnFileNew);
  disable($btnFileOpen);
  disable($btnFileSave);
  disable($btnFileClose);
  disable($btnToggleRaw);

  disable($btnToggleErrors);
  disable($btnToggleFollow);
  disable($btnToggleGlobals);
  disable($fileHeaderToggle);
  disable($fileHeaderSave);
  disable($fileHeaderReload);

  disable($practiceTempo, true);
  disable($practiceLoopEnabled);
  disable($practiceLoopFrom);
  disable($practiceLoopTo);
  disable($selectionSuppressEnabled);
  disable($selectionGchordsEnabled);
  disable($selectionDrumsEnabled);
  disable($selectionMutedVoices);

  disable($btnFonts);

  disable($xIssuesAutoFix);
  disable($xIssuesJump);
  disable($xIssuesCopy);
  disable($xIssuesClose, true);

  updateAbUi();

  if (chordProFeature.isEnabled() && chordProFeature.isFullView()) {
    if ($btnPlay) $btnPlay.disabled = true;
    if ($btnPause) $btnPause.disabled = true;
    if ($btnPlayPause) $btnPlayPause.disabled = true;
    if ($btnStop) $btnStop.disabled = true;
    if ($btnToggleFollow) $btnToggleFollow.disabled = true;
    if ($btnToggleErrors) $btnToggleErrors.disabled = true;
  }
}

function buildTransportPlaybackPlan() {
  const tempoMultiplier = focusModeEnabled
    ? (Number.isFinite(Number(practiceTempoMultiplier)) ? Number(practiceTempoMultiplier) : 1)
    : 1;
  if (focusModeEnabled) {
    const focusResult = computeFocusPlaybackPlanFromCurrentState();
    if (!focusResult || !focusResult.ok || !focusResult.plan) {
      return {
        mode: "focus",
        invalid: true,
        invalidReason: focusResult && focusResult.reason ? String(focusResult.reason) : "Cannot resolve Focus playback scope.",
        rangeStart: Math.max(0, Number(transportPlayheadOffset) || 0),
        rangeEnd: null,
        loopEnabled: false,
        tempoMultiplier,
        focusPlan: null,
      };
    }
    return {
      mode: "focus",
      invalid: false,
      invalidReason: "",
      rangeStart: focusResult.plan.startOffset,
      rangeEnd: focusResult.plan.endOffset,
      loopEnabled: Boolean(focusResult.plan.loop),
      tempoMultiplier,
      focusPlan: focusResult.plan,
    };
  }
  return {
    mode: "transport",
    invalid: false,
    invalidReason: "",
    // Normal mode: start from the beginning of the bar under cursor.
    rangeStart: getEditorMeasureStartOffset(),
    rangeEnd: null,
    loopEnabled: false,
    tempoMultiplier,
  };
}

function getEditorPlayStartOffset() {
  if (!editorView) return 0;
  const sel = editorView.state.selection && editorView.state.selection.main ? editorView.state.selection.main : null;
  if (!sel) return 0;
  const max = editorView.state.doc.length;
  const anchor = Math.max(0, Math.min(Number(sel.anchor) || 0, max));
  const head = Math.max(0, Math.min(Number(sel.head) || 0, max));
  return Math.min(anchor, head);
}

function getEditorMeasureStartOffset() {
  if (!editorView) return 0;
  const text = getEditorValue();
  const max = editorView.state.doc.length;
  if (!text || max <= 0) return 0;
  const cursor = Math.max(0, Math.min(getEditorPlayStartOffset(), max));
  const len = text.length;

  // Deterministic textual rule:
  // - current measure starts right after the nearest barline to the left of cursor
  // - if cursor is exactly on a barline, this barline is the current measure boundary
  // - for measure 1 (no previous barline), start at first detected measure start in body
  // Do not cross section boundaries (e.g. [P:E]) when searching for the current bar start.
  const leftText = text.slice(0, cursor + 1);
  const partMatches = [...leftText.matchAll(/(?:^|\n)\s*\[P:[^\]\n]*\]\s*(?:\n|$)/g)];
  const sectionStart = partMatches.length
    ? Math.min(cursor, partMatches[partMatches.length - 1].index + partMatches[partMatches.length - 1][0].length)
    : 0;

  let bar = -1;
  if (cursor < len && text[cursor] === "|") {
    bar = cursor;
  } else {
    bar = text.lastIndexOf("|", Math.max(0, cursor - 1));
  }
  if (bar < sectionStart) bar = -1;

  let start = 0;
  if (bar >= 0) {
    start = bar + 1;
  } else {
    const first = findMeasureStartOffsetByNumber(text.slice(sectionStart), 1);
    if (Number.isFinite(first)) {
      start = sectionStart + Number(first);
    } else {
      start = sectionStart;
    }
  }

  // Skip only separators between barline and content.
  while (start < len && /[\s|:\]]/.test(text[start] || "")) start += 1;
  return Math.max(0, Math.min(start, max));
}

function getEditorSelectionSignature() {
  if (!editorView) return "";
  const sel = editorView.state.selection && editorView.state.selection.main ? editorView.state.selection.main : null;
  if (!sel) return "";
  const max = editorView.state.doc.length;
  const anchor = Math.max(0, Math.min(Number(sel.anchor) || 0, max));
  const head = Math.max(0, Math.min(Number(sel.head) || 0, max));
  return `${anchor}:${head}`;
}

function shouldResumeFromPause() {
  if (!isPaused) return false;
  if (focusModeEnabled) return true;
  if (!pausedSelectionSignature) return true;
  return getEditorSelectionSignature() === pausedSelectionSignature;
}

function resolveFocusResumeStartOffset(plan, fallbackStartOffset, candidateResumeOffset) {
  const start = Math.max(0, Number(fallbackStartOffset) || 0);
  const end = Number(plan && plan.rangeEnd);
  const resume = Number(candidateResumeOffset);
  if (!Number.isFinite(resume) || resume < start) return start;
  if (Number.isFinite(end) && resume >= end) return start;
  return resume;
}

function syncPendingPlaybackPlan() {
  pendingPlaybackPlan = buildTransportPlaybackPlan();
}

function applyPlaybackPlanSpeed(plan) {
  const next = Number(plan && plan.tempoMultiplier);
  desiredPlayerSpeed = (Number.isFinite(next) && next > 0) ? next : 1;
  if (player && typeof player.set_speed === "function") {
    try { player.set_speed(desiredPlayerSpeed); } catch {}
  }
}

async function togglePlayPauseEffective() {
  // In Focus mode, route through transport controls so Play and Start Over
  // use one deterministic playback pipeline.
  if (focusModeEnabled) {
    if (isPlaying) {
      pausePlayback();
      return;
    }
    await transportPlay();
    return;
  }

  if (isPlaying) {
    pausePlayback();
    return;
  }

  if (isPaused) {
    normalizeFocusLoopBoundsForPlayback();
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    applyPlaybackPlanSpeed(plan);
    const resumeOffset = playbackRange ? Math.max(0, Number(playbackRange.startOffset) || 0) : 0;
    let startOffset = focusModeEnabled
      ? (shouldResumeFromPause() ? resumeOffset : getEditorPlayStartOffset())
      : getEditorMeasureStartOffset();
    if (focusModeEnabled) {
      startOffset = resolveFocusResumeStartOffset(plan, plan.rangeStart, startOffset);
    }
    await startPlaybackFromRange({
      startOffset,
      endOffset: plan.rangeEnd,
      origin: focusModeEnabled ? "focus" : "transport",
      loop: plan.loopEnabled,
    });
    return;
  }

  if (await playSelectionOnce()) return;

  const plan = pendingPlaybackPlan || buildTransportPlaybackPlan();
  if (plan && plan.invalid) {
    pendingPlaybackPlan = null;
    showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
    return;
  }
  pendingPlaybackPlan = null;
  currentPlaybackPlan = plan;
  applyPlaybackPlanSpeed(plan);
  await startPlaybackFromRange({
    startOffset: plan.rangeStart,
    endOffset: plan.rangeEnd,
    origin: focusModeEnabled ? "focus" : "transport",
    loop: plan.loopEnabled,
  });
}

async function transportStartOver() {
  // "Start Over" restarts the current playback scope from its beginning.
  if (isPlaying || isPaused || waitingForFirstNote || playbackStartArmed) {
    stopPlaybackTransport();
  }
  if (focusModeEnabled) {
    normalizeFocusLoopBoundsForPlayback();
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    applyPlaybackPlanSpeed(plan);
    await startPlaybackFromRange({
      startOffset: plan.rangeStart,
      endOffset: plan.rangeEnd,
      origin: "focus",
      loop: plan.loopEnabled,
    });
    return;
  }
  if (editorView) {
    editorView.dispatch({ selection: { anchor: 0, head: 0 }, scrollIntoView: true });
  }
  await startPlaybackAtIndex(0);
}

async function transportTogglePlayPause() {
  if (isPlaying) {
    pausePlayback();
    return;
  }
  if (isPaused) {
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    const resumeOffset = playbackRange ? Math.max(0, Number(playbackRange.startOffset) || 0) : 0;
    let startOffset = focusModeEnabled
      ? (shouldResumeFromPause() ? resumeOffset : getEditorPlayStartOffset())
      : getEditorMeasureStartOffset();
    if (focusModeEnabled) {
      startOffset = resolveFocusResumeStartOffset(plan, plan.rangeStart, startOffset);
    }
    await startPlaybackFromRange({
      startOffset,
      endOffset: plan.rangeEnd,
      origin: focusModeEnabled ? "focus" : "transport",
      loop: plan.loopEnabled,
    });
    return;
  }
  const startOffset = getEditorMeasureStartOffset();
  await startPlaybackFromRange({ startOffset, endOffset: null, origin: "transport", loop: false });
}

async function transportPlay() {
  if (isPlaying) return;
  if (focusModeEnabled) normalizeFocusLoopBoundsForPlayback();
  if (isPaused) {
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    const resumeOffset = playbackRange ? Math.max(0, Number(playbackRange.startOffset) || 0) : 0;
    let startOffset = focusModeEnabled
      ? (shouldResumeFromPause() ? resumeOffset : getEditorPlayStartOffset())
      : getEditorMeasureStartOffset();
    if (focusModeEnabled) {
      startOffset = resolveFocusResumeStartOffset(plan, plan.rangeStart, startOffset);
    }
    await startPlaybackFromRange({
      startOffset,
      endOffset: plan.rangeEnd,
      origin: focusModeEnabled ? "focus" : "transport",
      loop: plan.loopEnabled,
    });
    return;
  }
  if (focusModeEnabled) {
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    applyPlaybackPlanSpeed(plan);
    await startPlaybackFromRange({
      startOffset: plan.rangeStart,
      endOffset: plan.rangeEnd,
      origin: "focus",
      loop: plan.loopEnabled,
    });
    return;
  }
  if (await playSelectionOnce()) return;
  const startOffset = getEditorMeasureStartOffset();
  await startPlaybackFromRange({ startOffset, endOffset: null, origin: "transport", loop: false });
}

async function transportPause() {
  if (isPlaying) {
    pausePlayback();
    return;
  }
  if (isPaused) {
    normalizeFocusLoopBoundsForPlayback();
    const plan = buildTransportPlaybackPlan();
    if (plan && plan.invalid) {
      showToast(plan.invalidReason || "Cannot start Focus playback.", 3200);
      return;
    }
    const resumeOffset = playbackRange ? Math.max(0, Number(playbackRange.startOffset) || 0) : 0;
    let startOffset = focusModeEnabled
      ? (shouldResumeFromPause() ? resumeOffset : getEditorPlayStartOffset())
      : getEditorMeasureStartOffset();
    if (focusModeEnabled) {
      startOffset = resolveFocusResumeStartOffset(plan, plan.rangeStart, startOffset);
    }
    await startPlaybackFromRange({
      startOffset,
      endOffset: plan.rangeEnd,
      origin: focusModeEnabled ? "focus" : "transport",
      loop: plan.loopEnabled,
    });
  }
}

function resetPlaybackState() {
  playbackStartToken += 1;
  stopPlaybackForRestart();
  suppressOnEnd = false;
  isPlaying = false;
  isPaused = false;
  waitingForFirstNote = false;
  isPreviewing = false;
  playbackNeedsReprepare = true;
  lastPlaybackIdx = null;
  lastRenderIdx = null;
  lastStartPlaybackIdx = 0;
  resumeStartIdx = null;
  pausedSelectionSignature = null;
  playbackState = null;
  playbackIndexOffset = 0;
  lastPlaybackException = null;
  activePlaybackRange = null;
  activePlaybackEndAbcOffset = null;
  activePlaybackEndSymbol = null;
  activeLoopRange = null;
  playbackStartArmed = false;
  currentPlaybackPlan = null;
  pendingPlaybackPlan = null;
  clearNoteSelection();
  resetPlaybackUiState();
  if (selectionPlaybackRuntime.shouldRestoreSelection()) selectionPlaybackRuntime.restoreSelection(editorView);
  selectionPlaybackRuntime.clearSelectionCapture();
  updatePlayButton();
  setSoundfontCaption();
}

function highlightSourceAt(idx, on) {
  if (!isPlaying) return;
  if (!Number.isFinite(idx)) return;
  if (!editorView) return;
  const max = editorView.state.doc.length;
  const safeIdx = Math.max(0, Math.min(idx, max));
  const end = Math.min(safeIdx + 1, max);

  if (on) {
    lastRenderIdx = safeIdx;
    editorView.dispatch({ selection: { anchor: safeIdx, head: end } });
    const lineBlock = editorView.lineBlockAt(safeIdx);
    const lineTop = lineBlock.top;
    const viewTop = editorView.scrollDOM.scrollTop;
    const viewBottom = viewTop + editorView.scrollDOM.clientHeight;
    const margin = Math.max(lineBlock.height * 4, 64);
    if (lineTop < viewTop + margin) {
      editorView.scrollDOM.scrollTop = Math.max(0, lineTop - margin);
    } else if (lineTop > viewBottom - margin) {
      editorView.scrollDOM.scrollTop = Math.max(
        0,
        lineTop - editorView.scrollDOM.clientHeight + margin
      );
    }
  } else if (lastRenderIdx === idx) {
    const safeOff = Math.max(0, Math.min(idx, max));
    editorView.dispatch({ selection: { anchor: safeOff, head: safeOff } });
  }
}

function maybeScrollEditorToOffset(editorOffset) {
  if (!editorView) return;
  const max = editorView.state.doc.length;
  const idx = Math.max(0, Math.min(Number(editorOffset) || 0, max));
  const lineBlock = editorView.lineBlockAt(idx);
  const lineTop = lineBlock.top;
  const viewTop = editorView.scrollDOM.scrollTop;
  const viewBottom = viewTop + editorView.scrollDOM.clientHeight;
  const margin = Math.max(lineBlock.height * 4, 64);
  if (lineTop < viewTop + margin) {
    editorView.scrollDOM.scrollTop = Math.max(0, lineTop - margin);
  } else if (lineTop > viewBottom - margin) {
    editorView.scrollDOM.scrollTop = Math.max(
      0,
      lineTop - editorView.scrollDOM.clientHeight + margin
    );
  }
}

function schedulePlaybackUiUpdate(istart) {
  if (!Number.isFinite(istart)) return;
  pendingPlaybackUiIstart = istart;
  if (pendingPlaybackUiRaf != null) return;
  pendingPlaybackUiRaf = requestAnimationFrame(() => {
    pendingPlaybackUiRaf = null;
	    const i = pendingPlaybackUiIstart;
	    pendingPlaybackUiIstart = null;
	    if (!isPlaying || isPreviewing) return;
	    const effectiveFollow = Boolean(followPlayback || focusModeEnabled);
	    if (!effectiveFollow) return;
	    if (!$out) return;
	    if (!Number.isFinite(i)) return;

    let targetIstart = i;
    // When playback events come from a different voice (common in multi-voice scores),
    // Follow should still track the configured "primary" voice rather than freezing.
    if ((followVoiceId != null || followVoiceIndex != null) && playbackState && playbackState.voiceTimeline) {
      const wantId = followVoiceId != null ? String(followVoiceId) : null;
      const wantIndex = followVoiceIndex != null ? String(followVoiceIndex) : null;
      const byId = playbackState.voiceTimeline && playbackState.voiceTimeline.byId ? playbackState.voiceTimeline.byId : null;
      const byIndex = playbackState.voiceTimeline && playbackState.voiceTimeline.byIndex ? playbackState.voiceTimeline.byIndex : null;
      const tl = (wantId && byId && byId[wantId]) ? byId[wantId]
        : (wantIndex && byIndex && byIndex[wantIndex]) ? byIndex[wantIndex]
        : null;

      const sym = findSymbolAtOrBefore(i);
      const currentTime = sym && Number.isFinite(sym.time) ? sym.time : null;
      if (tl && currentTime != null) {
        const times = Array.isArray(tl.times) ? tl.times : null;
        const istarts = Array.isArray(tl.istarts) ? tl.istarts : null;
        if (times && istarts && times.length && times.length === istarts.length) {
          const beforePos = upperBoundTime(times, currentTime) - 1;
          const beforeIdx = Math.max(0, Math.min(istarts.length - 1, beforePos));
          const afterIdx = Math.max(0, Math.min(istarts.length - 1, beforeIdx + 1));
          const beforeTime = Number.isFinite(times[beforeIdx]) ? times[beforeIdx] : null;
          const afterTime = Number.isFinite(times[afterIdx]) ? times[afterIdx] : null;
          let pick = beforeIdx;
          if (beforeTime == null && afterTime != null) {
            pick = afterIdx;
          } else if (beforeTime != null && afterTime != null && afterIdx !== beforeIdx) {
            const dBefore = Math.abs(currentTime - beforeTime);
            const dAfter = Math.abs(afterTime - currentTime);
            // Tie -> prefer forward note so visual follow does not stay one note behind.
            if (dAfter <= dBefore) pick = afterIdx;
          }
          const mapped = istarts[pick];
          if (Number.isFinite(mapped)) targetIstart = mapped;
        }
      }
    }
    targetIstart = snapIstartToPlayable(targetIstart);

    const editorIdx = Math.max(0, targetIstart - playbackIndexOffset);
    const editorLen = editorView ? editorView.state.doc.length : 0;
    const fromInjected = editorLen && editorIdx >= editorLen;
    if (fromInjected) return;

    const renderOffset = (lastRenderPayload && Number.isFinite(lastRenderPayload.offset))
      ? lastRenderPayload.offset
      : 0;
    const renderIdx = mapEditorOffsetToRenderIdx(editorIdx);

	    if (lastPlaybackUiEditorIdx === editorIdx && lastPlaybackUiRenderIdx === renderIdx) return;
	    lastPlaybackUiEditorIdx = editorIdx;
	    lastPlaybackUiRenderIdx = renderIdx;

	    // Follow mode: emphasize bar + playhead line over per-note blinking.
	    clearPlaybackNoteOnEls();

    // New approach: highlight the current *visual* staff segment (5 lines) instead of bar separators.
    // This avoids ambiguity when the left barline of the current measure is on the previous system line.
    clearSvgFollowBarHighlight();

    const noteEls = findNearestNoteHighlightElements(renderIdx, 240);
    const chosen = noteEls.length ? pickClosestNoteElement(noteEls) : null;
    if (chosen) {
      const chosenRenderIdx = extractRenderIdxFromElementClass(chosen);
      const chosenEditorIdx = Number.isFinite(chosenRenderIdx)
        ? Math.max(0, mapRenderIdxToEditorOffset(chosenRenderIdx))
        : editorIdx;
      const nearestBar = findNearestBarElForNote(chosen);
      setSvgPlayheadFromElements(chosen, nearestBar);
      highlightSvgFollowMeasureForNote(chosen, nearestBar);
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
	      if (now - lastPlaybackUiScrollAt > 90) {
          if (!suppressFollowScrollUntilMs || now >= suppressFollowScrollUntilMs) {
	          maybeScrollRenderToNote(chosen);
	          lastPlaybackUiScrollAt = now;
          }
	      }
	      highlightSourceAt(chosenEditorIdx, true);
	      return;
	    }

    clearSvgPlayhead();
    clearSvgFollowMeasureHighlight();
    highlightSourceAt(editorIdx, true);
  });
}

function maybeScrollRenderToNote(el) {
  if (!$renderPane || !el) return;
  if (isPlaybackBusy()) {
    maybeAutoScrollRenderToCursor(el);
    return;
  }
  const containerRect = $renderPane.getBoundingClientRect();
  const targetRect = el.getBoundingClientRect();
  const viewTop = $renderPane.scrollTop;
  const viewBottom = viewTop + $renderPane.clientHeight;
  const viewLeft = $renderPane.scrollLeft;
  const viewRight = viewLeft + $renderPane.clientWidth;
  const relTop = targetRect.top - containerRect.top;
  const relBottom = relTop + targetRect.height;
  const relLeft = targetRect.left - containerRect.left;
  const relRight = relLeft + targetRect.width;
  const linePad = Math.max(80, targetRect.height * 8);
  const colPad = Math.max(80, targetRect.width * 8);
  let nextTop = viewTop;
  let nextLeft = viewLeft;
  if (relTop < linePad) {
    nextTop = viewTop + (relTop - linePad);
  } else if (relBottom > $renderPane.clientHeight - linePad) {
    nextTop = viewTop + (relBottom - ($renderPane.clientHeight - linePad));
  }
  if (relLeft < colPad) {
    nextLeft = viewLeft + (relLeft - colPad);
  } else if (relRight > $renderPane.clientWidth - colPad) {
    nextLeft = viewLeft + (relRight - ($renderPane.clientWidth - colPad));
  }
  const maxTop = Math.max(0, $renderPane.scrollHeight - $renderPane.clientHeight);
  const maxLeft = Math.max(0, $renderPane.scrollWidth - $renderPane.clientWidth);
  $renderPane.scrollTop = Math.max(0, Math.min(maxTop, nextTop));
  $renderPane.scrollLeft = Math.max(0, Math.min(maxLeft, nextLeft));
}

async function ensureSoundfontLoaded() {
  // already loaded
  const desired = soundfontName || "TimGM6mb.sf2";
  if (
    soundfontReadyName === desired
    && (soundfontSource !== "abc2svg.sf2" || (window.abc2svg && window.abc2svg.sf2))
  ) return;
  if (soundfontLoadPromise && soundfontLoadTarget === desired) return soundfontLoadPromise;

  if (!window.abc2svg) window.abc2svg = {};

  const withTimeout = (promise, ms, label) => {
    const timeoutMs = Number(ms) > 0 ? Number(ms) : 0;
    if (!timeoutMs) return promise;
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`${label || "Operation"} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      Promise.resolve(promise).then((value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }, (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  const loadSoundfont = async (name) => {
    const isPath = name.startsWith("/") || /^[a-zA-Z]:\\/.test(name) || name.startsWith("file://");
    const sf2Url = isPath
      ? toFileUrl(name)
      : new URL(`../../third_party/sf2/${name}`, window.location.href).href;
    if (isPath || STREAMING_SF2.has(name)) {
      window.abc2svg.sf2 = null;
      soundfontSource = sf2Url;
      soundfontReadyName = name;
      return;
    }
    if (!window.api || typeof window.api.readFileBase64 !== "function") {
      throw new Error("preload API missing: window.api.readFileBase64");
    }
    let b64 = "";
    try {
      // Reading and base64-encoding SF2 can be slow on some platforms; avoid hanging forever.
      b64 = await withTimeout(window.api.readFileBase64(sf2Url), 15000, "Soundfont load");
    } catch (e) {
      // Fallback: let the player load SF2 from a local file URL instead of embedding base64.
      window.abc2svg.sf2 = null;
      soundfontSource = sf2Url;
      soundfontReadyName = name;
      return;
    }
    if (!b64 || !b64.length) throw new Error("SF2 base64 is empty");
    window.abc2svg.sf2 = b64; // raw base64
    soundfontSource = "abc2svg.sf2";
    soundfontReadyName = name;
  };

  soundfontLoadTarget = desired;
  setSoundfontCaption("Loading...");
  updateSoundfontLoadingStatus(desired);
  soundfontLoadPromise = (async () => {
    let ok = false;
    try {
      await loadSoundfont(desired);
      ok = true;
    } catch (e) {
      if (desired === "TimGM6mb.sf2") throw e;
      await loadSoundfont("TimGM6mb.sf2");
      ok = true;
    } finally {
      soundfontLoadPromise = null;
      soundfontLoadTarget = null;
      if (ok) setSoundfontStatus("", 0);
      if (!waitingForFirstNote) setSoundfontCaption();
      if (ok && !isPlaying && !isPaused && !waitingForFirstNote) setStatus("OK");
    }
  })();
  return soundfontLoadPromise;
}

async function ensureSoundfontReady() {
  await ensureSoundfontLoaded();
  const desired = soundfontSource || "abc2svg.sf2";
  const p = ensurePlayer();
  if (typeof p.set_sfu === "function" && desired !== lastSoundfontApplied) {
    p.set_sfu(desired);
    lastSoundfontApplied = desired;
  }
}

function ensurePlayer() {
  if (player) return player;

  if (typeof window.AbcPlay !== "function") {
    throw new Error("AbcPlay not found (snd-1.js not loaded?)");
  }

  const conf = {
    onend: () => {
      if (suppressOnEnd) return;
      if (isPreviewing) {
        isPreviewing = false;
        return;
      }
      const wasSelectionOrigin = activePlaybackRange && activePlaybackRange.origin === "selection";
      const shouldLoop = Boolean(activePlaybackRange && activePlaybackRange.loop);
      const loopRange = shouldLoop ? (activeLoopRange || activePlaybackRange) : null;
      isPlaying = false;
      isPaused = false;
      waitingForFirstNote = false;
      setStatus("OK");
      updatePlayButton();
      clearNoteSelection();
      clearPlaybackNoteOnEls();
      clearSvgPlayhead();
      clearSvgFollowBarHighlight();
      clearSvgFollowMeasureHighlight();
      if (!shouldLoop) {
        resumeStartIdx = null;
        activePlaybackRange = null;
        activePlaybackEndAbcOffset = null;
        activePlaybackEndSymbol = null;
        activeLoopRange = null;
        playbackStartArmed = false;
        currentPlaybackPlan = null;
        // Transport: end-of-tune behaves like Stop (playhead=0).
      }
      if (!shouldLoop) resetPlaybackUiState();
      if (shouldLoop && followPlayback && lastRenderIdx != null && editorView) {
        // When looping, keep the visual follow-cursor without mutating PlaybackRange (loop invariance).
        suppressPlaybackRangeSelectionSync = true;
        try {
          editorView.dispatch({ selection: { anchor: lastRenderIdx, head: lastRenderIdx } });
        } finally {
          suppressPlaybackRangeSelectionSync = false;
        }
      }
      if (shouldLoop) {
        queueMicrotask(() => {
          if (!loopRange || !activePlaybackRange || !activePlaybackRange.loop) return;
          if (pendingPlaybackPlan) {
            const plan = pendingPlaybackPlan;
	            pendingPlaybackPlan = null;
	            currentPlaybackPlan = plan;
	            applyPlaybackPlanSpeed(plan);
	            startPlaybackFromRange({
	              startOffset: plan.rangeStart,
	              endOffset: plan.rangeEnd,
	              origin: focusModeEnabled ? "focus" : "transport",
	              loop: plan.loopEnabled,
	            }).catch(() => {});
	            updatePracticeUi();
	            return;
          }
          startPlaybackFromRange(loopRange).catch(() => {});
        });
      }
      if (!shouldLoop && wasSelectionOrigin) {
        selectionPlaybackRuntime.restoreSelection(editorView);
        selectionPlaybackRuntime.clearSelectionCapture();
      }
    },
    onnote: (i, on) => {
      lastPlaybackIdx = i;
      if (on && waitingForFirstNote) {
        waitingForFirstNote = false;
        setStatus("Playing…");
        setSoundfontCaption();
      }
      if (isPreviewing) return;
      if (on) {
        if (Number.isFinite(lastPlaybackOnIstart) && Number.isFinite(i) && i < lastPlaybackOnIstart && window.__abcarusDebugPlayback) {
          console.log("[abcarus] playback jump (repeat?)", { from: lastPlaybackOnIstart, to: i });
        }
        if (window.__abcarusDebugParts === true && Number.isFinite(i)) {
          try {
            const sym = findSymbolAtOrBefore(i);
            const letter = (sym && sym.part && sym.part.text) ? (String(sym.part.text || "")[0] || "?") : null;
            if (letter) console.log("[abcarus] part start", { part: letter, istart: i });
            if (Number.isFinite(lastPlaybackOnIstart) && i < lastPlaybackOnIstart) {
              let s = sym;
              let guard = 0;
              let inferred = null;
              while (s && guard < 200000) {
                if (s.part && s.part.text) { inferred = String(s.part.text || "")[0] || "?"; break; }
                s = s.ts_prev;
                guard += 1;
              }
              console.log("[abcarus] part jump", { from: lastPlaybackOnIstart, to: i, inferredPart: inferred });
            }
          } catch {}
        }
        lastPlaybackOnIstart = i;
      }
	      // End-of-range handling is done by abc2svg's snd engine via `s_end` (see `activePlaybackEndSymbol`).
      const editorIdx = Math.max(0, i - playbackIndexOffset);
      const editorLen = editorView ? editorView.state.doc.length : 0;
      const fromInjected = editorLen && editorIdx >= editorLen;
      if (on && !fromInjected) {
        // Playback per-note trace/diagnostics is opt-in to keep hot paths lean.
        // Enable via DevTools: `window.__abcarusPlaybackTrace = true` (no reload required).
        const traceEnabled = window.__abcarusPlaybackTrace === true;
        // Loop invariance guard: only enforce when PlaybackRange is expected to match the active loop.
        // In Focus, playback can resume mid-loop, so origins may differ and the guard should not fire.
        if (
          activePlaybackRange
          && activePlaybackRange.loop
          && activePlaybackRange.origin === playbackRange.origin
          && playbackRange.startOffset !== activePlaybackRange.startOffset
        ) {
          // Possibly correctness-critical: this guards against state races that can break subsequent playback.
          stopPlaybackFromGuard("Loop invariance violated: PlaybackRange.startOffset mutated.");
          return;
        }
	        // No extra end-of-range guard here: we rely on `s_end` to stop deterministically (and to allow looping).
        if (traceEnabled) {
          const timestamp = typeof performance !== "undefined" ? performance.now() : Date.now();
          const seq = (playbackTraceSeq += 1);

          // Trace-only diagnostics: keep opt-in unless proven correctness-critical.
          if (lastTraceRunId !== playbackRunId) {
            stopPlaybackFromGuard("Trace run id mismatch.");
            return;
          }
          if (lastTracePlaybackIdx != null && seq < lastTracePlaybackIdx) {
            stopPlaybackFromGuard("Trace playbackIdx is not monotonic.");
            return;
          }
          if (lastTraceTimestamp != null && timestamp < lastTraceTimestamp) {
            stopPlaybackFromGuard("Trace timestamp is decreasing.");
            return;
          }

          lastTracePlaybackIdx = seq;
          lastTraceTimestamp = timestamp;
          const currentEditorOffset = toEditorOffset(i);
          const rangeStartEditorOffset = activePlaybackRange ? activePlaybackRange.startOffset : playbackRange.startOffset;
          appendPlaybackTrace({
            rangeStartOffset: rangeStartEditorOffset,
            currentAbcOffset: Number.isFinite(currentEditorOffset) ? currentEditorOffset : editorIdx,
            rangeStartEditorOffset,
            currentEditorOffset: Number.isFinite(currentEditorOffset) ? currentEditorOffset : editorIdx,
            currentIstart: i,
            origin: activePlaybackRange ? activePlaybackRange.origin : playbackRange.origin,
            playbackIdx: seq,
            editorIdx: Number.isFinite(currentEditorOffset) ? currentEditorOffset : editorIdx,
            timestamp,
            atMs: timestamp,
          });
        }
      }
      // Important: never let injected voices (e.g. DRUM appended to payload) steal the pending UI update,
      // otherwise follow-highlight becomes "blinking"/pale because the RAF processes only the injected istart and returns.
      if (on && !fromInjected) schedulePlaybackUiUpdate(i);
    },
    errmsg: (m, line, col) => {
      const loc = Number.isFinite(line) && Number.isFinite(col)
        ? { line: line + 1, col: col + 1 }
        : null;
      logErr(m, loc);
    },
    err: (m) => logErr(m),
  };
  applyPlaybackFxToConfig(conf, latestSettingsSnapshot);
  playerConfig = conf;
  player = AbcPlay(conf);

  // Expose for debugging in the console:
  window.p = player;

	  // Guard against NaN speed from localStorage (and allow Focus to override speed deterministically):
  if (typeof player.set_speed === "function") {
    const next = Number(desiredPlayerSpeed);
    player.set_speed(Number.isFinite(next) && next > 0 ? next : 1);
  }

  // Key: tell snd-1.js to use SF2 from window.abc2svg.sf2
  if (typeof player.set_sfu === "function") player.set_sfu(soundfontSource || "abc2svg.sf2");
  try { sessionStorage.setItem("audio", "sf2"); } catch {}

  return player;
}

function buildPlaybackState(firstSymbol) {
  const symbols = [];
  const measures = [];
  const barIstarts = [];
  const voiceEventsById = new Map(); // voiceId -> [{time, istart}]
  const voiceEventsByIndex = new Map(); // voiceIndex -> [{time, istart}]
  const voiceStats = new Map(); // voice key -> { id, index, order, playable, pitched }
  const pushUnique = (arr, symbol) => {
    if (!symbol || !Number.isFinite(symbol.istart)) return;
    if (arr.length && arr[arr.length - 1].istart === symbol.istart) return;
    arr.push({ istart: symbol.istart, symbol });
  };
  const isPlayableSymbol = (symbol) => !!(symbol && !symbol.noplay && Number.isFinite(symbol.dur) && symbol.dur > 0);
  const isBarLikeSymbol = (symbol) => !!(symbol && (symbol.bar_type || symbol.type === 14));

  let s = firstSymbol;
  let guard = 0;
  let preferredVoiceId = null;
  let preferredVoiceIndex = null;
  let lockedPrimaryVoice = false;
  let voiceOrderSeq = 0;
  const editorLen = editorView ? editorView.state.doc.length : 0;
  const editorMaxIstart = (Number.isFinite(playbackIndexOffset) ? playbackIndexOffset : 0) + (Number.isFinite(editorLen) ? editorLen : 0);
  const isInjectedSymbol = (symbol) => {
    if (!symbol || !Number.isFinite(symbol.istart)) return false;
    if (!editorLen) return false;
    return symbol.istart >= editorMaxIstart;
  };
  const considerVoice = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    const id = symbol.p_v.id ? String(symbol.p_v.id) : null;
    if (id && id.toUpperCase() === "DRUM") return;
    const v = Number.isFinite(symbol.p_v.v) ? symbol.p_v.v : null;
    // Convention: if V:1 exists, Follow should use it as the primary voice.
    // Some abc2svg timelines assign voice indices that do not correspond to V: numbering.
    if (!lockedPrimaryVoice && id === "1") {
      preferredVoiceId = id;
      preferredVoiceIndex = v;
      lockedPrimaryVoice = true;
      return;
    }
    if (lockedPrimaryVoice) return;
    if (preferredVoiceIndex == null) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
      return;
    }
    if (v != null && preferredVoiceIndex != null && v < preferredVoiceIndex) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
      return;
    }
    if (preferredVoiceIndex == null && v != null) {
      preferredVoiceIndex = v;
      preferredVoiceId = id;
    }
  };

  const getVoiceStatsKey = (id, index) => {
    if (id) return `id:${id}`;
    if (index != null) return `idx:${index}`;
    return null;
  };

  const recordVoiceStats = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    if (!isPlayableSymbol(symbol)) return;
    const id = symbol.p_v.id ? String(symbol.p_v.id) : null;
    if (id && id.toUpperCase() === "DRUM") return;
    const index = Number.isFinite(symbol.p_v.v) ? symbol.p_v.v : null;
    const key = getVoiceStatsKey(id, index);
    if (!key) return;
    let stats = voiceStats.get(key);
    if (!stats) {
      stats = { id, index, order: voiceOrderSeq, playable: 0, pitched: 0 };
      voiceOrderSeq += 1;
      voiceStats.set(key, stats);
    }
    stats.playable += 1;
    // abc2svg marks normal pitched notes as type 8. In many lead sheets an
    // accompaniment voice made of `x` heads is playable too, but it is a poor
    // default target for Follow when a real melody voice is present.
    if (symbol.type === 8) stats.pitched += 1;
  };

  const pushVoiceEvent = (symbol) => {
    if (!symbol || !symbol.p_v) return;
    if (!isPlayableSymbol(symbol)) return;
    if (!Number.isFinite(symbol.time) || !Number.isFinite(symbol.istart)) return;
    const pv = symbol.p_v;
    const id = pv.id != null ? String(pv.id) : null;
    const v = Number.isFinite(pv.v) ? String(pv.v) : null;
    const evt = { time: symbol.time, istart: symbol.istart };
    const push = (map, key) => {
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(evt);
    };
    // Keep both maps available; Follow will prefer id but can fall back to index.
    // IMPORTANT: keep these separate to avoid key collisions (e.g. voiceId "1" vs voiceIndex "1").
    if (id && id.toUpperCase() !== "DRUM") push(voiceEventsById, id);
    if (v != null) push(voiceEventsByIndex, v);
  };

  if (s && !isInjectedSymbol(s)) pushUnique(symbols, s);
  if (s && !isInjectedSymbol(s)) pushUnique(measures, s);

  while (s && guard < 200000) {
    if (!isInjectedSymbol(s)) {
      pushUnique(symbols, s);
      if (isBarLikeSymbol(s) && s.ts_next) {
        // In some abc2svg timelines (multi-voice + injected DRUM), a barline's ts_next may point into
        // the injected tail. For bar-snapping/highlighting we want the next *editor-visible* symbol.
        let next = s.ts_next;
        let hop = 0;
        while (next && isInjectedSymbol(next) && hop < 64) {
          next = next.ts_next;
          hop += 1;
        }
        if (next && !isInjectedSymbol(next)) {
          pushUnique(measures, next);
        }
        barIstarts.push(s.istart);
      }
      if (isPlayableSymbol(s)) {
        considerVoice(s);
        recordVoiceStats(s);
        pushVoiceEvent(s);
      }
    }
    s = s.ts_next;
    guard += 1;
  }

  // Sort by istart (text position) so binary searches behave deterministically even with multi-voice timelines.
  // Note: injected/appended voices (e.g. DRUM) are filtered out above, so these maps reflect editor-visible ABC.
  symbols.sort((a, b) => a.istart - b.istart);
  measures.sort((a, b) => a.istart - b.istart);

  const uniqSorted = (arr) => {
    const out = [];
    let last = null;
    for (const v of arr.slice().sort((a, b) => a - b)) {
      if (!Number.isFinite(v)) continue;
      if (last == null || v !== last) out.push(v);
      last = v;
    }
    return out;
  };

  // IMPORTANT:
  // Keep `*_Istarts` aligned 1:1 with their corresponding `symbols/measures` arrays.
  // Some timelines contain multiple symbols with the same `istart` (multi-voice / decorations / non-playable markers).
  // If we de-duplicate istarts here, binary-search indices no longer match array indices and Follow/voice selection breaks.
  const symbolIstarts = symbols.map((item) => item.istart);
  const measureIstarts = measures.map((item) => item.istart);
  const playableIstarts = uniqSorted(
    symbols
      .filter((item) => isPlayableSymbol(item && item.symbol))
      .map((item) => item.istart)
  );
  const timeline = symbols.map((item) => {
    const sym = item.symbol;
    return {
      istart: item.istart,
      time: Number.isFinite(sym && sym.time) ? sym.time : null,
      dur: Number.isFinite(sym && sym.dur) ? sym.dur : null,
      type: Number.isFinite(sym && sym.type) ? sym.type : null,
    };
  });

  const buildTimelineObject = (eventsMap) => {
    const out = {};
    for (const [key, list] of eventsMap.entries()) {
      if (!key || !Array.isArray(list) || !list.length) continue;
      const sorted = list.slice().sort((a, b) => (a.time - b.time) || (a.istart - b.istart));
      const times = [];
      const istarts = [];
      let lastTime = null;
      let lastIstart = null;
      for (const e of sorted) {
        if (!e || !Number.isFinite(e.time) || !Number.isFinite(e.istart)) continue;
        // Keep duplicates (chords), but drop exact duplicates to reduce noise.
        if (lastTime === e.time && lastIstart === e.istart) continue;
        times.push(e.time);
        istarts.push(e.istart);
        lastTime = e.time;
        lastIstart = e.istart;
      }
      if (times.length) out[key] = { times, istarts };
    }
    return out;
  };

  const voiceTimeline = {
    byId: buildTimelineObject(voiceEventsById),
    byIndex: buildTimelineObject(voiceEventsByIndex),
  };

  const preferredKey = getVoiceStatsKey(preferredVoiceId, preferredVoiceIndex);
  const preferredStats = preferredKey ? voiceStats.get(preferredKey) : null;
  if (!preferredStats || !preferredStats.pitched) {
    let bestPitched = null;
    for (const stats of voiceStats.values()) {
      if (!stats || !stats.pitched) continue;
      if (
        !bestPitched
        || stats.pitched > bestPitched.pitched
        || (stats.pitched === bestPitched.pitched && stats.order < bestPitched.order)
      ) {
        bestPitched = stats;
      }
    }
    if (bestPitched) {
      preferredVoiceId = bestPitched.id;
      preferredVoiceIndex = bestPitched.index;
    }
  }

  let startSymbol = firstSymbol;
  if (!startSymbol || !Number.isFinite(startSymbol.istart)) {
    startSymbol = symbols.length ? symbols[0].symbol : firstSymbol;
  }
  if (!isPlayableSymbol(startSymbol)) {
    const playable = symbols.find((item) => isPlayableSymbol(item.symbol));
    if (playable) startSymbol = playable.symbol;
  }
  return {
    rootSymbol: firstSymbol || null,
    startSymbol,
    preferredVoiceId,
    preferredVoiceIndex,
    symbols,
    measures,
    symbolIstarts,
    measureIstarts,
    playableIstarts,
    barIstarts: uniqSorted(barIstarts),
    timeline,
    voiceTimeline,
    voiceStats: Array.from(voiceStats.values()).map((stats) => ({ ...stats })),
  };
}

function setFollowVoiceFromPlayback() {
  followVoiceId = null;
  followVoiceIndex = null;
  if (!playbackState) return;
  // Prefer a stable "primary" voice (first staff) to avoid highlight jumping on multi-staff scores.
  if (playbackState.preferredVoiceId) followVoiceId = playbackState.preferredVoiceId;
  if (Number.isFinite(playbackState.preferredVoiceIndex)) followVoiceIndex = playbackState.preferredVoiceIndex;
  if (followVoiceId || followVoiceIndex != null) return;
  if (!playbackState.startSymbol) return;
  const voice = playbackState.startSymbol.p_v;
  if (!voice) return;
  if (voice.id) followVoiceId = voice.id;
  if (Number.isFinite(voice.v)) followVoiceIndex = voice.v;
}

function lowerBoundIstart(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBoundIstart(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function snapIstartToPlayable(istart) {
  if (!Number.isFinite(istart)) return istart;
  if (!playbackState || !Array.isArray(playbackState.playableIstarts) || !playbackState.playableIstarts.length) {
    return istart;
  }
  const list = playbackState.playableIstarts;
  const pos = lowerBoundIstart(list, istart);
  const right = pos < list.length ? list[pos] : null;
  const left = pos > 0 ? list[pos - 1] : null;
  const rightDist = Number.isFinite(right) ? Math.abs(right - istart) : Infinity;
  const leftDist = Number.isFinite(left) ? Math.abs(istart - left) : Infinity;
  // Prefer the forward note on ties so Follow doesn't lag behind.
  const winner = rightDist <= leftDist ? right : left;
  if (!Number.isFinite(winner)) return istart;
  // Guardrail: snap only if close; large jumps usually mean unrelated timeline noise.
  if (Math.abs(winner - istart) > 32) return istart;
  return winner;
}

function upperBoundTime(list, value) {
  if (!Array.isArray(list) || !list.length) return 0;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findSymbolAtOrBefore(idx) {
  if (!playbackState || !playbackState.symbols.length) return null;
  const list = playbackState.symbolIstarts || [];
  if (!list.length) return null;
  const pos = upperBoundIstart(list, idx) - 1;
  const best = Math.max(0, Math.min(playbackState.symbols.length - 1, pos));
  const item = playbackState.symbols[best];
  return item ? item.symbol : null;
}

function findSymbolAtOrAfter(idx) {
  if (!playbackState || !playbackState.symbols.length) return null;
  const list = playbackState.symbolIstarts || [];
  if (!list.length) return null;
  const pos = lowerBoundIstart(list, idx);
  const best = Math.max(0, Math.min(playbackState.symbols.length - 1, pos));
  const item = playbackState.symbols[best];
  return item ? item.symbol : null;
}

function findMeasureIndex(idx) {
  if (!playbackState || !playbackState.measures.length) return 0;
  const list = playbackState.measureIstarts || [];
  if (!list.length) return 0;
  const pos = upperBoundIstart(list, idx) - 1;
  return Math.max(0, Math.min(playbackState.measures.length - 1, pos));
}

function stopPlaybackForRestart() {
  if (player && typeof player.stop === "function") {
    suppressOnEnd = true;
    try { player.stop(); } catch {}
  }
  clearNoteSelection();
  resetPlaybackUiState();
}

function stopPlaybackTransport() {
  playbackStartToken += 1;

  // If already idle and a selection is active, treat Stop as "clear selection / ready from start".
  if (!isPlaying && !isPaused && !waitingForFirstNote && editorView) {
    const sel = editorView.state.selection.main;
    if (sel && sel.anchor !== sel.head) {
      const len = editorView.state.doc.length;
      const pos = Math.max(0, Math.min(len, Math.min(sel.anchor, sel.head)));
      editorView.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: false });
      clearNoteSelection();
    }
  }

  const wasSelectionOrigin = activePlaybackRange && activePlaybackRange.origin === "selection";
  if (player && (isPlaying || isPaused || waitingForFirstNote) && typeof player.stop === "function") {
    suppressOnEnd = true;
    try { player.stop(); } catch {}
  }
  // abc2svg playback mutates internal tune/parts structures; force a clean re-prepare after Stop.
  playbackNeedsReprepare = true;
  isPlaying = false;
  isPaused = false;
  waitingForFirstNote = false;
  let nextTransportStart = 0;
  if (focusModeEnabled) {
    const focusResult = computeFocusPlaybackPlanFromCurrentState();
    if (focusResult && focusResult.ok && focusResult.plan && focusResult.plan.mode === "segment") {
      nextTransportStart = Math.max(0, Number(focusResult.plan.startOffset) || 0);
    }
  }
  transportPlayheadOffset = nextTransportStart;
  transportJumpHighlightActive = false;
  suppressTransportJumpClearOnce = false;
  setPracticeBarHighlight(null);
  clearSvgPracticeBarHighlight();
  resumeStartIdx = null;
  pausedSelectionSignature = null;
  activePlaybackRange = null;
  activePlaybackEndAbcOffset = null;
  activePlaybackEndSymbol = null;
  playbackStartArmed = false;
  currentPlaybackPlan = null;
  setStatus("OK");
  updatePlayButton();
  clearNoteSelection();
  resetPlaybackUiState();
  setSoundfontCaption();

  // Transport: explicit Stop resets internal playhead to 0.
  if (wasSelectionOrigin) selectionPlaybackRuntime.restoreSelection(editorView);
  selectionPlaybackRuntime.clearSelectionCapture();

  // When stopping normal playback, collapse any transient 1-char selection created by Follow.
  // Otherwise the next "Play" can be misinterpreted as "play selection once".
  if (!wasSelectionOrigin && editorView) {
    const sel = editorView.state.selection.main;
    if (sel && sel.anchor !== sel.head) {
      const len = editorView.state.doc.length;
      const pos = Math.max(0, Math.min(len, Math.min(sel.anchor, sel.head)));
      editorView.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: false });
    }
  }

}

function toDerivedOffset(editorOffset) {
  const raw = Number(editorOffset);
  if (!Number.isFinite(raw)) return null;
  return raw + (playbackIndexOffset || 0);
}

function toEditorOffset(derivedOffset) {
  const raw = Number(derivedOffset);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, raw - (playbackIndexOffset || 0));
}

function setGlobalHeaderFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  const next = String(settings.globalHeaderText || "");
  globalHeaderText = next;
  globalHeaderEnabled = settings.globalHeaderEnabled !== false;
}

function sanitizeFontAssetName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(bundled|user):(.*)$/);
  if (m) {
    const origin = m[1];
    let fileName = String(m[2] || "").trim();
    // Recover from previously persisted double-prefixed values, e.g. "bundled:bundled:Leland.otf".
    const nested = fileName.match(/^(bundled|user):(.*)$/);
    if (nested) fileName = String(nested[2] || "").trim();
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return "";
    if (/[\x00-\x1f]/.test(fileName)) return "";
    if (!/^[^/\\]+\.(otf|ttf|woff2?)$/i.test(fileName)) return "";
    return `${origin}:${fileName}`;
  }
  // Backward-compat: accept plain filenames and treat them as bundled.
  if (/^[^/\\]+\.(otf|ttf|woff2?)$/i.test(raw)) return `bundled:${raw}`;
  return "";
}

function setAbc2svgFontsFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  abc2svgNotationFontFile = sanitizeFontAssetName(settings.abc2svgNotationFontFile);
  abc2svgTextFontFile = sanitizeFontAssetName(settings.abc2svgTextFontFile);
}

function filePathToFileUrl(filePath) {
  const raw = String(filePath || "");
  if (!raw) return "";
  const normalized = raw.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  // Best-effort: keep it simple; spaces are the common case.
  return prefix + encodeURI(normalized);
}

function buildAbc2svgFontHeaderLayer() {
  const lines = [];
  const comment = "% ABCarus: font overrides (auto)";
  const encodeBundledFileName = (name) => encodeURIComponent(String(name || "")).replace(/%2F/gi, "");

  if (abc2svgNotationFontFile) {
    const m = abc2svgNotationFontFile.match(/^(bundled|user):(.*)$/);
    if (m) {
      const origin = m[1];
      const fileName = m[2];
      const url = origin === "bundled"
        ? `../../assets/fonts/notation/${encodeBundledFileName(fileName)}`
        : (fontDirs && fontDirs.userDir
          ? filePathToFileUrl(window.api && window.api.pathJoin ? window.api.pathJoin(fontDirs.userDir, fileName) : `${fontDirs.userDir}/${fileName}`)
          : "");
      // Use explicit size for broad abc2svg compatibility.
      if (url) lines.push(`%%musicfont url("${url}") 24`);
    }
  }

  if (abc2svgTextFontFile) {
    const m = abc2svgTextFontFile.match(/^(bundled|user):(.*)$/);
    let url = "";
    if (m) {
      const origin = m[1];
      const fileName = m[2];
      url = origin === "bundled"
        ? `../../assets/fonts/notation/${encodeBundledFileName(fileName)}`
        : (fontDirs && fontDirs.userDir
          ? filePathToFileUrl(window.api && window.api.pathJoin ? window.api.pathJoin(fontDirs.userDir, fileName) : `${fontDirs.userDir}/${fileName}`)
          : "");
    }
    if (url) {
      const directives = [
        "annotationfont",
        "footerfont",
        "headerfont",
        "historyfont",
        "infofont",
        "titlefont",
        "subtitlefont",
        "composerfont",
        "partsfont",
        "textfont",
        "gchordfont",
        "tempofont",
        "tupletfont",
        "voicefont",
        "vocalfont",
        "wordsfont",
        "measurefont",
        "repeatfont",
      ];
      for (const d of directives) {
        lines.push(`%%${d} url("${url}") *`);
      }
    }
  }

  if (!lines.length) return "";
  return `${comment}\n${lines.join("\n")}`;
}

function updateGlobalHeaderToggle() {
  if (!$btnToggleGlobals) return;
  $btnToggleGlobals.classList.toggle("toggle-active", globalHeaderEnabled);
  setButtonText($btnToggleGlobals, "Globals");
  $btnToggleGlobals.setAttribute("aria-pressed", globalHeaderEnabled ? "true" : "false");
}

function updateFollowToggle() {
  if (!$btnToggleFollow) return;
  $btnToggleFollow.classList.toggle("toggle-active", followPlayback);
  setButtonText($btnToggleFollow, "Follow");
  $btnToggleFollow.setAttribute("aria-pressed", followPlayback ? "true" : "false");
  if (!followPlayback) {
    clearSvgPlayhead();
    clearSvgFollowBarHighlight();
    clearSvgFollowMeasureHighlight();
  }
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function applyFollowHighlightCssVars() {
  const root = document.documentElement;
  if (!root || !root.style) return;
  root.style.setProperty("--abcarus-follow-color", followHighlightColor);
  root.style.setProperty("--abcarus-follow-bar-opacity", String(followHighlightBarOpacity));
  root.style.setProperty("--abcarus-follow-measure-opacity", String(followMeasureOpacity));
  root.style.setProperty("--abcarus-follow-playhead-opacity", String(followPlayheadOpacity));
  if (followMeasureColor) {
    root.style.setProperty("--abcarus-follow-measure-color", followMeasureColor);
  } else {
    root.style.removeProperty("--abcarus-follow-measure-color");
  }
}

function setFollowHighlightFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  followHighlightColor = normalizeHexColor(settings.followHighlightColor, followHighlightColor);
  const measureColorRaw = String(settings.followMeasureColor || "").trim();
  if (!measureColorRaw) {
    followMeasureColor = "";
  } else {
    followMeasureColor = normalizeHexColor(measureColorRaw, followMeasureColor || followHighlightColor);
  }
  followHighlightBarOpacity = clampNumber(settings.followHighlightBarOpacity, 0, 1, followHighlightBarOpacity);
  followMeasureOpacity = clampNumber(settings.followMeasureOpacity, 0, 1, followMeasureOpacity);
  followPlayheadOpacity = clampNumber(settings.followPlayheadOpacity, 0, 1, followPlayheadOpacity);
  followPlayheadWidth = clampNumber(settings.followPlayheadWidth, 1, 6, followPlayheadWidth);
  followPlayheadPad = clampNumber(settings.followPlayheadPad, 0, 24, followPlayheadPad);
  followPlayheadBetweenNotesWeight = clampNumber(settings.followPlayheadBetweenNotesWeight, 0, 1, followPlayheadBetweenNotesWeight);
  followPlayheadShift = clampNumber(settings.followPlayheadShift, -20, 20, followPlayheadShift);
  followPlayheadFirstBias = clampNumber(settings.followPlayheadFirstBias, 0, 20, followPlayheadFirstBias);
  applyFollowHighlightCssVars();
}

function clampInt(value, min, max, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  const n = Math.floor(v);
  return Math.max(min, Math.min(max, n));
}

function buildFocusBarIndexMap(measureIndex, editorDocLength) {
  if (!measureIndex || !Array.isArray(measureIndex.istarts) || !measureIndex.istarts.length) return [];
  const payload = {
    offset: Number(measureIndex.offset) || 0,
    compatMap: getRenderCompatMap(),
  };
  const max = Math.max(0, Number.isFinite(Number(editorDocLength)) ? Number(editorDocLength) : 0);
  const starts = measureIndex.istarts.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v));
  if (!starts.length) return [];
  const bars = [];
  for (let i = 0; i < starts.length; i += 1) {
    const startRenderOffset = starts[i];
    const nextStart = (i + 1 < starts.length) ? starts[i + 1] : null;
    const startOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(startRenderOffset, payload))));
    const endOffset = Number.isFinite(nextStart)
      ? Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(nextStart, payload))))
      : max;
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) continue;
    bars.push({
      barNumber: bars.length + 1,
      startRenderOffset,
      endRenderOffset: Number.isFinite(nextStart) ? nextStart : null,
      startOffset,
      endOffset,
    });
  }
  return bars;
}

function buildFocusBarIndexMapFromSvg(editorDocLength) {
  if (!$out) return [];
  const payload = lastRenderPayload || { offset: 0, compatMap: null };
  const renderOffset = Number.isFinite(payload && payload.offset) ? Number(payload.offset) : 0;
  const max = Math.max(0, Number.isFinite(Number(editorDocLength)) ? Number(editorDocLength) : 0);
  const barEls = Array.from($out.querySelectorAll(".bar-hl"));
  if (!barEls.length) return [];
  const raw = [];
  for (const el of barEls) {
    const s = Number(el.dataset && el.dataset.start);
    const e = Number(el.dataset && el.dataset.end);
    if (!Number.isFinite(s)) continue;
    raw.push({
      startRenderOffset: s,
      endRenderOffset: (Number.isFinite(e) && e > s) ? e : null,
    });
  }
  if (!raw.length) return [];
  raw.sort((a, b) => {
    if (a.startRenderOffset !== b.startRenderOffset) return a.startRenderOffset - b.startRenderOffset;
    const ae = Number.isFinite(a.endRenderOffset) ? a.endRenderOffset : Number.POSITIVE_INFINITY;
    const be = Number.isFinite(b.endRenderOffset) ? b.endRenderOffset : Number.POSITIVE_INFINITY;
    return ae - be;
  });
  const deduped = [];
  const seen = new Set();
  for (const item of raw) {
    const key = `${item.startRenderOffset}:${Number.isFinite(item.endRenderOffset) ? item.endRenderOffset : "null"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  const bars = [];
  for (let i = 0; i < deduped.length; i += 1) {
    const item = deduped[i];
    const next = (i + 1 < deduped.length) ? deduped[i + 1] : null;
    let endRenderOffset = Number.isFinite(item.endRenderOffset) ? Number(item.endRenderOffset) : null;
    const nextStart = next && Number.isFinite(next.startRenderOffset) ? Number(next.startRenderOffset) : null;
    if (Number.isFinite(nextStart) && (!Number.isFinite(endRenderOffset) || endRenderOffset > nextStart)) {
      endRenderOffset = nextStart;
    }
    if (!Number.isFinite(endRenderOffset)) endRenderOffset = mapEditorOffsetToRenderIdx(max, payload);
    const startOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(item.startRenderOffset, payload))));
    const endOffset = Math.max(0, Math.min(max, Math.floor(mapRenderIdxToEditorOffset(endRenderOffset, payload))));
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) continue;
    bars.push({
      barNumber: bars.length + 1,
      startRenderOffset: item.startRenderOffset,
      endRenderOffset,
      startOffset,
      endOffset,
    });
  }
  return bars;
}

function getVisibleFocusRenderRange() {
  if (!focusModeEnabled || !$out || !$renderPane) return null;
  const bars = Array.from($out.querySelectorAll(".bar-hl"));
  if (!bars.length) return null;
  const paneRect = $renderPane.getBoundingClientRect();
  if (!(paneRect && paneRect.width > 1 && paneRect.height > 1)) return null;
  let startRenderOffset = Number.POSITIVE_INFINITY;
  let endRenderOffset = Number.NEGATIVE_INFINITY;
  let hits = 0;
  for (const el of bars) {
    const rect = el.getBoundingClientRect();
    if (!rect || rect.bottom <= paneRect.top || rect.top >= paneRect.bottom || rect.right <= paneRect.left || rect.left >= paneRect.right) {
      continue;
    }
    const s = Number(el.dataset && el.dataset.start);
    const e = Number(el.dataset && el.dataset.end);
    if (!Number.isFinite(s)) continue;
    const stop = (Number.isFinite(e) && e > s) ? e : (s + 1);
    startRenderOffset = Math.min(startRenderOffset, s);
    endRenderOffset = Math.max(endRenderOffset, stop);
    hits += 1;
  }
  if (!hits || !Number.isFinite(startRenderOffset) || !Number.isFinite(endRenderOffset) || endRenderOffset <= startRenderOffset) return null;
  return { startRenderOffset, endRenderOffset };
}

function resolveVisibleFocusBarRange(barMap, visibleRenderRange) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  if (!visibleRenderRange) return null;
  const startRender = Number(visibleRenderRange.startRenderOffset);
  const endRender = Number(visibleRenderRange.endRenderOffset);
  if (!Number.isFinite(startRender) || !Number.isFinite(endRender) || endRender <= startRender) return null;
  let startBarIndex = null;
  let endBarIndex = null;
  for (let i = 0; i < barMap.length; i += 1) {
    const bar = barMap[i];
    const barStart = Number(bar.startRenderOffset);
    const barEnd = Number.isFinite(Number(bar.endRenderOffset)) ? Number(bar.endRenderOffset) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(barStart)) continue;
    if (barStart < endRender && barEnd > startRender) {
      if (startBarIndex == null) startBarIndex = i;
      endBarIndex = i;
    }
  }
  if (startBarIndex == null || endBarIndex == null) return null;
  return { startBarIndex, endBarIndex };
}

function normalizeFocusBarStarts(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const out = [];
  let last = null;
  for (const value of list.slice().sort((a, b) => Number(a) - Number(b))) {
    const v = Number(value);
    if (!Number.isFinite(v)) continue;
    if (last == null || v !== last) out.push(v);
    last = v;
  }
  return out;
}

function getFocusFirstMeasureStartRender(byNumber) {
  if (!byNumber || typeof byNumber.get !== "function") return null;
  const first = normalizeFocusBarStarts(byNumber.get(1));
  if (!first.length) return null;
  return Number(first[0]);
}

function getFocusMeasureStartCandidates(byNumber, measureNumber) {
  if (!byNumber || typeof byNumber.get !== "function") return [];
  const n = Number(measureNumber);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return [];
  const firstMeasureStart = getFocusFirstMeasureStartRender(byNumber);
  if (!Number.isFinite(firstMeasureStart)) return [];
  if (n === 1) return [firstMeasureStart];

  // Preferred: direct bar number mapping (works for repeated/volta numbers like 15/16/17).
  const direct = normalizeFocusBarStarts(byNumber.get(n)).filter((v) => Number(v) > firstMeasureStart);
  if (direct.length) return direct;

  // Fallback: some sources expose next-measure starts as previous bar numbers.
  return normalizeFocusBarStarts(byNumber.get(n - 1)).filter((v) => Number(v) > firstMeasureStart);
}

function findFocusBarIndexAtOrAfterStart(barMap, renderStart) {
  if (!Array.isArray(barMap) || !barMap.length) return -1;
  const target = Number(renderStart);
  if (!Number.isFinite(target)) return -1;
  // Prefer the bar that actually contains target (important when barMap[0] starts before
  // the first playable note but still spans bar 1).
  for (let i = 0; i < barMap.length; i += 1) {
    const start = Number(barMap[i] && barMap[i].startRenderOffset);
    const rawEnd = Number(barMap[i] && barMap[i].endRenderOffset);
    const end = Number.isFinite(rawEnd) ? rawEnd : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(start)) continue;
    if (target >= start && target < end) return i;
  }
  for (let i = 0; i < barMap.length; i += 1) {
    const start = Number(barMap[i] && barMap[i].startRenderOffset);
    if (!Number.isFinite(start)) continue;
    if (start >= target) return i;
  }
  return barMap.length - 1;
}

function resolveFocusSegmentBarsByNumber(barMap, byNumber, from, to) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  if (!byNumber || typeof byNumber.get !== "function") return null;
  const fromStarts = getFocusMeasureStartCandidates(byNumber, from);
  const toStarts = getFocusMeasureStartCandidates(byNumber, to);
  if (!fromStarts.length || !toStarts.length) return null;

  const startRender = fromStarts[0];
  let toStartRender = null;
  for (let i = toStarts.length - 1; i >= 0; i -= 1) {
    const candidate = Number(toStarts[i]);
    if (!Number.isFinite(candidate)) continue;
    if (candidate >= startRender) {
      toStartRender = candidate;
      break;
    }
  }
  if (!Number.isFinite(toStartRender)) return null;

  // Inclusive end: boundary is start of the next measure after selected To.
  const nextStarts = getFocusMeasureStartCandidates(byNumber, to + 1);
  let endBoundaryRender = null;
  for (let i = 0; i < nextStarts.length; i += 1) {
    const candidate = Number(nextStarts[i]);
    if (!Number.isFinite(candidate)) continue;
    if (candidate > toStartRender) {
      endBoundaryRender = candidate;
      break;
    }
  }
  if (!Number.isFinite(endBoundaryRender)) {
    for (let i = 0; i < barMap.length; i += 1) {
      const candidate = Number(barMap[i] && barMap[i].startRenderOffset);
      if (!Number.isFinite(candidate)) continue;
      if (candidate > toStartRender) {
        endBoundaryRender = candidate;
        break;
      }
    }
  }

  const startBarIndex = findFocusBarIndexAtOrAfterStart(barMap, startRender);
  const endBarIndex = findFocusBarIndexAtOrAfterStart(barMap, toStartRender);
  if (startBarIndex < 0 || endBarIndex < 0 || endBarIndex < startBarIndex) return null;
  return {
    startBarIndex,
    endBarIndex,
    startRenderOffset: startRender,
    toStartRenderOffset: toStartRender,
    endBoundaryRenderOffset: Number.isFinite(endBoundaryRender) ? endBoundaryRender : null,
  };
}

function getFocusBarMapRenderOffset(barMap) {
  if (!Array.isArray(barMap) || !barMap.length) return null;
  for (const bar of barMap) {
    const renderStart = Number(bar && bar.startRenderOffset);
    const editorStart = Number(bar && bar.startOffset);
    if (!Number.isFinite(renderStart) || !Number.isFinite(editorStart)) continue;
    return renderStart - editorStart;
  }
  return null;
}

function getFocusPlaybackState() {
  const selectionSettings = getSelectionPlaybackSettings();
  return {
    fromMeasure: Number(playbackLoopFromMeasure),
    toMeasure: Number(playbackLoopToMeasure),
    loop: Boolean(playbackLoopEnabled),
    suppressRepeats: Boolean(selectionSettings.suppressRepeats),
    mutedVoices: Array.isArray(selectionSettings.mutedVoices) ? selectionSettings.mutedVoices.slice() : [],
    muteGchords: Boolean(selectionSettings.muteGchords),
    allowMidiDrums: Boolean(selectionSettings.allowMidiDrums),
  };
}

function buildFocusPlaybackPlan({ parsedTune, focusState, visibleRange }) {
  const bars = parsedTune && Array.isArray(parsedTune.barMap) ? parsedTune.barMap : [];
  const tuneText = String(parsedTune && parsedTune.text ? parsedTune.text : "");
  const byNumber = (parsedTune && parsedTune.byNumber && typeof parsedTune.byNumber.get === "function")
    ? parsedTune.byNumber
    : null;
  const state = focusState || {};
  const from = Number(state.fromMeasure);
  const to = Number(state.toMeasure);
  const hasFrom = Number.isFinite(from) && from >= 1;
  const hasTo = Number.isFinite(to) && to >= 1;
  if (!bars.length) {
    if (hasFrom || hasTo) {
      return { ok: false, reason: "Cannot resolve bar boundaries for multi-voice selection." };
    }
    const fullStart = Math.max(0, Number(parsedTune && parsedTune.firstMeasureOffset) || 0);
    const fullEnd = Math.max(fullStart + 1, tuneText.length);
    return {
      ok: true,
      plan: {
        mode: "visible",
        startBarIndex: 0,
        endBarIndex: 0,
        startOffset: fullStart,
        endOffset: fullEnd,
        suppressRepeats: Boolean(state.suppressRepeats),
        mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
        loop: Boolean(state.loop),
      },
    };
  }
  let mode = "visible";
  let startBarIndex = null;
  let endBarIndex = null;
  let byNumberRange = null;

  const noSegmentLimits = !hasFrom && !hasTo;
  if (noSegmentLimits) {
    const firstMeasureOffset = Number(parsedTune && parsedTune.firstMeasureOffset);
    const firstBarStart = Number(bars[0] && bars[0].startOffset);
    let fullStart = Number.isFinite(firstMeasureOffset) ? firstMeasureOffset : firstBarStart;
    if (!Number.isFinite(fullStart)) fullStart = 0;
    fullStart = Math.max(0, Math.min(tuneText.length, fullStart));
    const fullEnd = Math.max(fullStart + 1, tuneText.length);
    return {
      ok: true,
      plan: {
        mode: "visible",
        startBarIndex: 0,
        endBarIndex: bars.length - 1,
        startOffset: fullStart,
        endOffset: fullEnd,
        suppressRepeats: Boolean(state.suppressRepeats),
        mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
        loop: Boolean(state.loop),
      },
    };
  }

  if (hasFrom && hasTo) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
      return { ok: false, reason: "Invalid Focus range: set integer From/To with From <= To." };
    }
    byNumberRange = resolveFocusSegmentBarsByNumber(bars, byNumber, from, to);
    if (byNumberRange) {
      const resolvedSpan = (Number(byNumberRange.endBarIndex) - Number(byNumberRange.startBarIndex)) + 1;
      const expectedSpan = (to - from) + 1;
      const spanSuspicious = (
        !Number.isFinite(resolvedSpan)
        || resolvedSpan <= 0
        || resolvedSpan > (expectedSpan + 8)
        || (from <= 4 && resolvedSpan > (expectedSpan + 2))
      );
      if (spanSuspicious) byNumberRange = null;
    }
    if (byNumberRange) {
      mode = "segment";
      startBarIndex = byNumberRange.startBarIndex;
      endBarIndex = byNumberRange.endBarIndex;
    } else {
      if (from > bars.length || to > bars.length) {
        return { ok: false, reason: "Requested bar range is outside the focused tune." };
      }
      mode = "segment";
      startBarIndex = from - 1;
      endBarIndex = to - 1;
    }
  } else {
    const visibleBars = resolveVisibleFocusBarRange(bars, visibleRange);
    if (!visibleBars) {
      // Fail-safe: if visible bar overlays are not currently measurable, keep Focus playable
      // by using the full tune scope instead of rejecting Play.
      startBarIndex = 0;
      endBarIndex = bars.length - 1;
    } else {
      startBarIndex = visibleBars.startBarIndex;
      endBarIndex = visibleBars.endBarIndex;
    }
  }

  const startBar = bars[startBarIndex];
  const endBar = bars[endBarIndex];
  if (!startBar || !endBar) {
    return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  }
  let startOffset = Number(startBar.startOffset);
  let endOffset = Number(endBar.endOffset);
  if (mode === "visible") {
    const nextBar = bars[endBarIndex + 1] || null;
    const nextStart = Number(nextBar && nextBar.startOffset);
    if (Number.isFinite(nextStart) && nextStart > startOffset) {
      endOffset = nextStart;
    }
  }
  if (mode === "segment" && byNumberRange) {
    const renderOffset = getFocusBarMapRenderOffset(bars);
    const max = Math.max(0, tuneText.length);
    if (Number.isFinite(renderOffset) && Number.isFinite(Number(byNumberRange.startRenderOffset))) {
      const exactStart = Math.floor(Number(byNumberRange.startRenderOffset) - Number(renderOffset));
      startOffset = Math.max(0, Math.min(max, exactStart));
    }
    let boundaryRender = null;
    if (Number.isFinite(Number(byNumberRange.endBoundaryRenderOffset))) {
      boundaryRender = Number(byNumberRange.endBoundaryRenderOffset);
    } else if (Number.isFinite(Number(endBar.endRenderOffset))) {
      boundaryRender = Number(endBar.endRenderOffset);
    } else if (Number.isFinite(renderOffset) && Number.isFinite(Number(endBar.endOffset))) {
      boundaryRender = Number(renderOffset) + Number(endBar.endOffset);
    }
    if (Number.isFinite(renderOffset) && Number.isFinite(boundaryRender)) {
      const exactEnd = Math.floor(boundaryRender - Number(renderOffset));
      endOffset = Math.max(0, Math.min(max, exactEnd));
    } else if (Number.isFinite(boundaryRender)) {
      const boundaryIdx = findFocusBarIndexAtOrAfterStart(bars, boundaryRender);
      if (boundaryIdx >= 0) {
        const boundaryBar = bars[boundaryIdx];
        if (boundaryBar && Number.isFinite(Number(boundaryBar.startOffset))) {
          endOffset = Number(boundaryBar.startOffset);
        }
      }
    } else if (Number.isFinite(Number(endBar.endOffset))) {
      endOffset = Number(endBar.endOffset);
    }
  }
  if (mode === "segment") {
    const textStartOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, from);
    const textEndOffsetExclusive = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, to + 1);
    if (from === 1 && Number.isFinite(Number(textStartOffset)) && Number(textStartOffset) >= 0) {
      startOffset = Number(textStartOffset);
    }
    if (!byNumberRange
      && Number.isFinite(Number(textEndOffsetExclusive))
      && Number(textEndOffsetExclusive) > startOffset) {
      endOffset = Number(textEndOffsetExclusive);
    }
  }
  // Boundary hardening: Focus must include the selected end bar fully even when barMap carries
  // a short/degenerate endOffset (observed on some layouts around repeats/voltas/anacrusis).
  const endBarStart = Number(endBar.startOffset);
  const nextBar = bars[endBarIndex + 1] || null;
  const nextBarStart = Number(nextBar && nextBar.startOffset);
  if (Number.isFinite(nextBarStart) && nextBarStart > endBarStart && (!Number.isFinite(endOffset) || endOffset < nextBarStart)) {
    endOffset = nextBarStart;
  }
  if (Number.isFinite(endBarStart) && (!Number.isFinite(endOffset) || endOffset <= endBarStart)) {
    const tuneLen = Math.max(0, tuneText.length);
    endOffset = Math.max(endBarStart + 1, tuneLen);
  }
  // abc2svg measure timelines can omit the very first bar boundary in some multi-voice/volta layouts.
  // Keep From=1 anchored to the real first measure start detected from source text.
  const firstMeasureOffset = Number(parsedTune && parsedTune.firstMeasureOffset);
  const mustAnchorToFirstMeasure = (mode === "segment" && Number(state.fromMeasure) === 1);
  if (mustAnchorToFirstMeasure
    && Number.isFinite(firstMeasureOffset)
    && firstMeasureOffset >= 0
    && firstMeasureOffset < startOffset) {
    startOffset = firstMeasureOffset;
  }
  if (
    mode === "segment"
    && byNumberRange
    && Number.isFinite(Number(startBar.startOffset))
    && Number.isFinite(Number(endBar.endOffset))
    && (!Number.isFinite(endOffset) || endOffset <= startOffset)
  ) {
    startOffset = Number(startBar.startOffset);
    endOffset = Number(endBar.endOffset);
  }
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset) || endOffset <= startOffset) {
    return { ok: false, reason: "Cannot resolve Focus playback boundaries." };
  }
  if (mode === "visible" && !Boolean(state.suppressRepeats)) {
    const extendedEnd = extendVisibleRangeToRepeatClose(tuneText, startOffset, endOffset);
    if (Number.isFinite(extendedEnd) && extendedEnd > endOffset) endOffset = extendedEnd;
  }
  if (mode === "segment" && !Boolean(state.suppressRepeats) && focusRangeCrossesRepeats(tuneText, startOffset, endOffset)) {
    return { ok: false, reason: "Selection crosses repeats; enable 'Suppress repeats' or adjust range." };
  }

  return {
    ok: true,
    plan: {
      mode,
      startBarIndex,
      endBarIndex,
      startOffset,
      endOffset,
      suppressRepeats: Boolean(state.suppressRepeats),
      mutedVoices: Array.isArray(state.mutedVoices) ? state.mutedVoices.slice() : [],
      loop: Boolean(state.loop),
    },
  };
}

function computeFocusPlaybackPlanFromCurrentState() {
  if (!editorView) return { ok: false, reason: "Cannot resolve visible scope in Focus mode." };
  const tuneText = getEditorValue();
  const measureIndex = getRenderMeasureIndex();
  const barMap = buildFocusBarIndexMap(measureIndex, editorView.state.doc.length);
  const firstMeasureOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, 1);
  const focusState = getFocusPlaybackState();
  return buildFocusPlaybackPlan({
    parsedTune: {
      text: tuneText,
      barMap,
      byNumber: measureIndex && measureIndex.byNumber ? measureIndex.byNumber : null,
      firstMeasureOffset: Number.isFinite(firstMeasureOffset) ? Number(firstMeasureOffset) : null,
    },
    focusState,
    visibleRange: getVisibleFocusRenderRange(),
  });
}

function pickStartFromListAtOrAfter(list, minRenderIdx) {
  if (!Array.isArray(list) || !list.length) return null;
  const min = Number(minRenderIdx);
  if (!Number.isFinite(min)) return list[0];
  for (const v of list) {
    if (Number.isFinite(v) && v >= min) return v;
  }
  return list[list.length - 1];
}

function findBoundaryAfter(sorted, target) {
  if (!Array.isArray(sorted) || !sorted.length) return null;
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid];
    if (v > t) {
      best = v;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return best;
}

function resolveMeasureStartRenderIdx(measureIndex, n, { minBound, minStartRenderIdx } = {}) {
  if (!measureIndex) return null;
  const num = clampInt(n, 0, 100000, 0);
  if (num <= 0) return null;
  const anchor = Number.isFinite(Number(measureIndex.anchor)) ? Number(measureIndex.anchor) : 0;
  const istarts = Array.isArray(measureIndex.istarts) ? measureIndex.istarts : null;
  const bound = Number.isFinite(Number(minBound)) ? Number(minBound) : null;

  // Preferred: abc2svg bar_num mapping (can contain multiple occurrences due to repeats/voltas).
  const list = (measureIndex.byNumber && typeof measureIndex.byNumber.get === "function")
    ? measureIndex.byNumber.get(num)
    : null;
  if (Array.isArray(list) && list.length) {
    const boundPick = (bound != null) ? pickStartFromListAtOrAfter(list, bound) : list[0];
    const minPick = Number.isFinite(Number(minStartRenderIdx)) ? pickStartFromListAtOrAfter(list, Number(minStartRenderIdx)) : boundPick;
    return Number.isFinite(Number(minPick)) ? Number(minPick) : Number(boundPick);
  }

  // Fallback: list-of-measures index (used by older/edge cases).
  if (istarts && istarts.length) {
    const slot = (num - 1) + anchor;
    const v = istarts[Math.max(0, Math.min(istarts.length - 1, slot))];
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function resolveMeasureStartRenderIdxSequential(measureIndex, n, { minBound, minStartRenderIdx } = {}) {
  if (!measureIndex) return null;
  const num = clampInt(n, 0, 100000, 0);
  if (num <= 0) return null;
  const istarts = Array.isArray(measureIndex.istarts) ? measureIndex.istarts : null;
  if (!istarts || !istarts.length) return null;
  const anchor = Number.isFinite(Number(measureIndex.anchor)) ? Number(measureIndex.anchor) : 0;
  const slot = (num - 1) + anchor;
  let v = istarts[Math.max(0, Math.min(istarts.length - 1, slot))];
  if (!Number.isFinite(v)) return null;
  const bound = Number(minBound);
  if (Number.isFinite(bound) && v < bound) {
    const atOrAfterBound = findBoundaryAtOrAfter(istarts, bound);
    if (Number.isFinite(atOrAfterBound)) v = atOrAfterBound;
  }
  const minStart = Number(minStartRenderIdx);
  if (Number.isFinite(minStart) && v < minStart) {
    const atOrAfterMin = findBoundaryAtOrAfter(istarts, minStart);
    if (Number.isFinite(atOrAfterMin)) v = atOrAfterMin;
  }
  return v;
}

function computeFocusLoopPlaybackRange() {
  if (!focusModeEnabled || !editorView || rawMode) return null;
  const focusResult = computeFocusPlaybackPlanFromCurrentState();
  if (!focusResult || !focusResult.ok || !focusResult.plan) return null;
  return {
    startOffset: Number(focusResult.plan.startOffset) || 0,
    endOffset: Number.isFinite(Number(focusResult.plan.endOffset)) ? Number(focusResult.plan.endOffset) : null,
    origin: "focus",
    loop: Boolean(focusResult.plan.loop),
  };
}

function updatePracticeUi() {
  if ($practiceTempoWrap) $practiceTempoWrap.hidden = !focusModeEnabled;
  if ($practiceFocusRangeGroup) $practiceFocusRangeGroup.hidden = !focusModeEnabled;
  if ($practiceFocusOptionsGroup) $practiceFocusOptionsGroup.hidden = !focusModeEnabled;
  if ($practiceFocusVoicesGroup) $practiceFocusVoicesGroup.hidden = !focusModeEnabled;
  if ($practiceSelectionGroup) $practiceSelectionGroup.hidden = Boolean(focusModeEnabled);
  if ($practiceTempo && focusModeEnabled && document.activeElement !== $practiceTempo) {
    const value = String(practiceTempoMultiplier);
    if ($practiceTempo.value !== value) $practiceTempo.value = value;
  }

  if ($practiceLoopWrap) $practiceLoopWrap.hidden = !focusModeEnabled;
  if ($practiceLoopEnabled && document.activeElement !== $practiceLoopEnabled) {
    $practiceLoopEnabled.checked = Boolean(playbackLoopEnabled);
  }
  if ($practiceLoopFrom && document.activeElement !== $practiceLoopFrom) {
    $practiceLoopFrom.value = String(clampInt(playbackLoopFromMeasure, 0, 100000, 0) || 0);
  }
  if ($practiceLoopTo && document.activeElement !== $practiceLoopTo) {
    $practiceLoopTo.value = String(clampInt(playbackLoopToMeasure, 0, 100000, 0) || 0);
  }

  if ($selectionSuppressWrap) $selectionSuppressWrap.hidden = !focusModeEnabled;
  if ($selectionSuppressEnabled && document.activeElement !== $selectionSuppressEnabled) {
    const enabled = Boolean(!latestSettingsSnapshot || latestSettingsSnapshot.playbackSelectionSuppressRepeats !== false);
    $selectionSuppressEnabled.checked = enabled;
  }
  if ($selectionGchordsWrap) $selectionGchordsWrap.hidden = !focusModeEnabled;
  if ($selectionGchordsEnabled && document.activeElement !== $selectionGchordsEnabled) {
    const enabled = Boolean(!latestSettingsSnapshot || latestSettingsSnapshot.playbackSelectionMuteGchords !== true);
    $selectionGchordsEnabled.checked = enabled;
  }
  if ($selectionDrumsWrap) $selectionDrumsWrap.hidden = !focusModeEnabled;
  if ($selectionDrumsEnabled && document.activeElement !== $selectionDrumsEnabled) {
    const enabled = Boolean(latestSettingsSnapshot && latestSettingsSnapshot.playbackSelectionAllowMidiDrums);
    $selectionDrumsEnabled.checked = enabled;
  }
  if ($selectionMutedWrap) $selectionMutedWrap.hidden = !focusModeEnabled;
  if ($selectionMutedVoices && document.activeElement !== $selectionMutedVoices) {
    const raw = latestSettingsSnapshot && latestSettingsSnapshot.playbackSelectionMutedVoices != null
      ? String(latestSettingsSnapshot.playbackSelectionMutedVoices)
      : "";
    if ($selectionMutedVoices.value !== raw) $selectionMutedVoices.value = raw;
  }

  // Avoid presenting two different loop concepts at the same time.
  // In Focus mode we show bar-loop controls; outside Focus we show selection-loop toggle.
  if ($selectionLoopWrap) $selectionLoopWrap.hidden = Boolean(focusModeEnabled);
  if ($selectionLoopEnabled && document.activeElement !== $selectionLoopEnabled) {
    const enabled = Boolean(latestSettingsSnapshot && latestSettingsSnapshot.playbackSelectionLoopEnabled);
    $selectionLoopEnabled.checked = enabled;
  }

  // Keep the pending plan in sync when Focus is on and playback is idle.
  if (focusModeEnabled && !isPlaybackBusy()) {
    syncPendingPlaybackPlan();
  }
}

function normalizeLoopBounds(fromMeasure, toMeasure) {
  const from = clampInt(fromMeasure, 0, 100000, 0);
  const to = clampInt(toMeasure, 0, 100000, 0);
  return { from, to };
}

function normalizeFocusLoopBoundsForPlayback() {
  if (!focusModeEnabled) return false;
  const from = clampInt(playbackLoopFromMeasure, 0, 100000, 0);
  const to = clampInt(playbackLoopToMeasure, 0, 100000, 0);
  if (!(from > 0 && to > 0 && from > to)) return false;
  playbackLoopFromMeasure = to;
  playbackLoopToMeasure = from;
  updatePracticeUi();
  syncPendingPlaybackPlan();
  const patch = {
    playbackLoopFromMeasure: playbackLoopFromMeasure,
    playbackLoopToMeasure: playbackLoopToMeasure,
  };
  if (activeTuneId) {
    playbackLoopTuneId = String(activeTuneId);
    patch.playbackLoopTuneId = playbackLoopTuneId;
  }
  persistLoopSettingsPatch(patch).catch(() => {});
  return true;
}

function maybeResetFocusLoopForTune(tuneId, { updateUi = true } = {}) {
  if (!focusModeEnabled) return;
  const id = tuneId != null ? String(tuneId) : "";
  if (!id) return;
  const savedId = playbackLoopTuneId != null ? String(playbackLoopTuneId) : "";
  if (savedId && savedId === id) return;

  const normalized = normalizeLoopBounds(FOCUS_LOOP_DEFAULT_FROM, FOCUS_LOOP_DEFAULT_TO);
  playbackLoopFromMeasure = normalized.from;
  playbackLoopToMeasure = normalized.to;
  syncPendingPlaybackPlan();
  if (updateUi) updatePracticeUi();
}

function setLoopFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  playbackLoopEnabled = Boolean(settings.playbackLoopEnabled);
  playbackLoopFromMeasure = clampInt(settings.playbackLoopFromMeasure, 0, 100000, 0);
  playbackLoopToMeasure = clampInt(settings.playbackLoopToMeasure, 0, 100000, 0);
  playbackLoopTuneId = (typeof settings.playbackLoopTuneId === "string") ? settings.playbackLoopTuneId : null;
  updatePracticeUi();
}

function setFollowFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  setFollowHighlightFromSettings(settings);
  if (settings.followPlayback === undefined) return;
  followPlayback = settings.followPlayback !== false;
  updateFollowToggle();
}

function setLayoutFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  layoutController.setFromSettings(settings);
}

function setSplitOrientation(nextOrientation, { persist = true, userAction = false } = {}) {
  const next = (nextOrientation === "horizontal") ? "horizontal" : "vertical";
  if (userAction && !isNormalModeForSplitToggle()) {
    showToast("Exit Focus/Raw mode to change split orientation.", 2400);
    return false;
  }
  const currentOrientation = layoutController.getRightSplitOrientation();
  if (currentOrientation === next) return true;
  // Persist the current zoom under the current split orientation before switching.
  try {
    const currentZoom = readRenderZoomCss();
    if (Number.isFinite(currentZoom) && currentZoom > 0) {
      const key = (currentOrientation === "horizontal") ? "layoutRenderZoomHorizontal" : "layoutRenderZoomVertical";
      const prev = latestSettingsSnapshot && latestSettingsSnapshot[key] != null ? Number(latestSettingsSnapshot[key]) : null;
      if (!Number.isFinite(prev) || Math.abs(prev - currentZoom) > 0.0001) {
        scheduleSaveLayoutPrefs({ [key]: currentZoom });
      }
    }
  } catch {}
  applyRightSplitOrientation(next);
  applyRightSplitSizesFromRatio();
  // Avoid follow-scroll fighting layout reflow right after a toggle.
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  suppressFollowScrollUntilMs = now + 250;
  // Restore the preferred zoom for the target split orientation (persisted across restarts).
  try {
    const targetKey = (next === "horizontal") ? "layoutRenderZoomHorizontal" : "layoutRenderZoomVertical";
    const desired = latestSettingsSnapshot && latestSettingsSnapshot[targetKey] != null ? Number(latestSettingsSnapshot[targetKey]) : null;
    if (Number.isFinite(desired) && desired > 0) {
      setRenderZoomCss(desired);
      if (window.api && typeof window.api.updateSettings === "function") {
        const current = latestSettingsSnapshot && latestSettingsSnapshot.renderZoom != null ? Number(latestSettingsSnapshot.renderZoom) : null;
        if (!Number.isFinite(current) || Math.abs(current - desired) > 0.0001) {
          window.api.updateSettings({ renderZoom: desired }).catch(() => {});
        }
      }
    }
  } catch {}
  if (persist) scheduleSaveLayoutPrefs({ layoutSplitOrientation: next });
  showToast(next === "horizontal" ? "Split: Horizontal" : "Split: Vertical", 1500);
  return true;
}

function toggleSplitOrientation({ userAction = false } = {}) {
  const next = layoutController.getRightSplitOrientation() === "horizontal" ? "vertical" : "horizontal";
  return setSplitOrientation(next, { persist: true, userAction });
}

function setPlaybackAutoScrollFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  playbackAutoScrollMode = normalizeAutoScrollMode(settings.playbackAutoScrollMode);
  playbackAutoScrollHorizontal = settings.playbackAutoScrollHorizontal !== false;
  playbackAutoScrollPauseMs = clampNumber(settings.playbackAutoScrollPauseMs, 0, 5000, playbackAutoScrollPauseMs);
  if (normalizeAutoScrollMode(playbackAutoScrollMode) === "off") {
    cancelPlaybackAutoScroll();
  }
}

function setSoundfontFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  const next = String(settings.soundfontName || "");
  soundfontName = next || "TimGM6mb.sf2";
}

function setDrumVelocityFromSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  const next = settings.drumVelocityMap;
  const base = buildDefaultDrumVelocityMap();
  if (next && typeof next === "object") {
    for (const [key, value] of Object.entries(next)) {
      const pitch = Number(key);
      if (!Number.isFinite(pitch)) continue;
      base[pitch] = clampVelocity(value);
    }
  }
  drumVelocityMap = base;
}

function resetSoundfontCache() {
  if (window.abc2svg) window.abc2svg.sf2 = null;
  if (window.abcsf2 && Array.isArray(window.abcsf2)) window.abcsf2.length = 0;
  soundfontSource = "abc2svg.sf2";
  soundfontReadyName = null;
  soundfontLoadPromise = null;
  soundfontLoadTarget = null;
}

function normalizeHeaderLayer(text) {
  if (text == null) return "";
  if (typeof text !== "string") {
    console.error("[abcarus] header layer is not a string; dropped:", Object.prototype.toString.call(text));
    return "";
  }
  const raw = text;
  if (!raw.trim()) return "";
  return raw.replace(/[\r\n]+$/, "");
}

const SINGLETON_HEADER_FIELDS = new Set([
  "K",
  "M",
  "L",
  "Q",
  "R",
  "C",
  "T",
  "S",
  "O",
  "G",
]);

const SINGLETON_HEADER_DIRECTIVES = new Set([
  "musicfont",
  "oneperpage",
  "pagewidth",
  "pageheight",
  "staffwidth",
  "scale",
  "annotationfont",
  "footerfont",
  "headerfont",
  "historyfont",
  "infofont",
  "titlefont",
  "subtitlefont",
  "composerfont",
  "partsfont",
  "textfont",
  "gchordfont",
  "tempofont",
  "tupletfont",
  "voicefont",
  "vocalfont",
  "wordsfont",
  "measurefont",
  "repeatfont",
  "measurenb",
  "landscape",
  "papersize",
  "leftmargin",
  "rightmargin",
  "topmargin",
  "botmargin",
  "staffsep",
  "systemsep",
  "stretchlast",
  "stretchstaff",
]);

function getHeaderLineKey(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("%")) {
    if (!trimmed.startsWith("%%")) return null;
    const match = trimmed.match(/^%%\s*([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const name = match[1].toLowerCase();
    if (!SINGLETON_HEADER_DIRECTIVES.has(name)) return null;
    return `%%${name}`;
  }
  const fieldMatch = trimmed.match(/^([A-Za-z]):/);
  if (!fieldMatch) return null;
  const field = fieldMatch[1].toUpperCase();
  if (!SINGLETON_HEADER_FIELDS.has(field)) return null;
  return field;
}

function getHeaderSectionLines(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let sawHeader = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isBlank = trimmed === "";
    const isHeader = /^[A-Za-z]:/.test(line) || /^%/.test(line);
    if (isHeader) sawHeader = true;
    if (sawHeader && isBlank) break;
    if (!isHeader && !isBlank) break;
    out.push(line);
  }
  return out;
}

function collectHeaderKeys(text) {
  const keys = new Set();
  const lines = getHeaderSectionLines(text);
  for (const line of lines) {
    const key = getHeaderLineKey(line);
    if (key) keys.add(key);
  }
  return keys;
}

function dedupeHeaderLayers(layers, blockedKeys) {
  const seen = new Set(blockedKeys || []);
  const kept = layers.map(() => []);
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];
    const lines = String(layer || "").split(/\r\n|\n|\r/);
    for (const line of lines) {
      const key = getHeaderLineKey(line);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      kept[i].push(line);
    }
  }
  return kept.map((lines) => lines.join("\n")).filter((text) => text.trim());
}

async function loadHeaderLayer(path) {
  if (!path) return "";
  try {
    const res = await readFile(path);
    if (!res || !res.ok) return "";
    return normalizeHeaderLayer(res.data);
  } catch {
    return "";
  }
}

async function refreshHeaderLayers() {
  const prev = `${globalHeaderGlobalText}|${globalHeaderLocalText}|${globalHeaderUserText}`;
  let globalPath = "";
  let userPath = "";
  if (window.api && typeof window.api.getSettingsPaths === "function") {
    try {
      const res = await window.api.getSettingsPaths();
      globalPath = res && res.globalPath ? res.globalPath : "";
      userPath = res && res.userPath ? res.userPath : "";
    } catch {}
  }
  let localPath = "";
  if (activeFilePath && window.api && typeof window.api.pathDirname === "function") {
    const dir = window.api.pathDirname(activeFilePath);
    if (window.api.pathJoin) {
      localPath = window.api.pathJoin(dir, "local_settings.abc");
    } else if (dir) {
      localPath = dir.endsWith("/") || dir.endsWith("\\") ? `${dir}local_settings.abc` : `${dir}/local_settings.abc`;
    }
  }
  const [globalText, localText, userText] = await Promise.all([
    loadHeaderLayer(globalPath),
    loadHeaderLayer(localPath),
    loadHeaderLayer(userPath),
  ]);
  globalHeaderGlobalText = globalText;
  globalHeaderLocalText = localText;
  globalHeaderUserText = userText;
  const next = `${globalHeaderGlobalText}|${globalHeaderLocalText}|${globalHeaderUserText}`;
  if (next !== prev) scheduleRenderNow();
}

function buildHeaderPrefix(entryHeader, includeCheckbars, tuneText) {
  const parts = [];
  const tuneHeaderKeys = tuneText ? collectHeaderKeys(tuneText) : new Set();
  const layers = [];
  const fontLayerRaw = buildAbc2svgFontHeaderLayer();
  if (globalHeaderEnabled) {
    const globalHeaderRaw = normalizeHeaderLayer(globalHeaderGlobalText);
    if (globalHeaderRaw) layers.push(globalHeaderRaw);
    const localHeaderRaw = normalizeHeaderLayer(globalHeaderLocalText);
    if (localHeaderRaw) layers.push(localHeaderRaw);
    const userHeaderRaw = normalizeHeaderLayer(globalHeaderUserText);
    if (userHeaderRaw) layers.push(userHeaderRaw);
    const legacyHeaderRaw = normalizeHeaderLayer(globalHeaderText);
    if (legacyHeaderRaw) layers.push(legacyHeaderRaw);
  }
  if (fontLayerRaw) layers.push(fontLayerRaw);
  const fileHeaderRaw = String(entryHeader || "");
  if (fileHeaderRaw.trim()) layers.push(fileHeaderRaw.replace(/[\r\n]+$/, ""));
  const deduped = dedupeHeaderLayers(layers, tuneHeaderKeys);
  let header = deduped.join("\n");
  if (includeCheckbars && isMeasureCheckEnabled()) {
    header = injectCheckbarsDirective(header);
  }
  if (!header.trim()) return { text: "", offset: 0 };
  const prefix = /[\r\n]$/.test(header) ? header : `${header}\n`;
  return { text: prefix, offset: prefix.length };
}

function dedupeHeaderLayersWithMeta(layers, blockedKeys) {
  const seen = new Set(blockedKeys || []);
  const kept = layers.map(() => []);
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];
    const text = layer && layer.text ? String(layer.text) : "";
    const lines = text.split(/\r\n|\n|\r/);
    for (const line of lines) {
      const key = getHeaderLineKey(line);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      kept[i].push(line);
    }
  }
  const out = [];
  for (let i = 0; i < layers.length; i += 1) {
    const meta = layers[i] || {};
    const text = kept[i].join("\n");
    if (!text.trim()) continue;
    out.push({ ...meta, text });
  }
  return out;
}

function buildHeaderPrefixWithLayerSpans(entryHeader, includeCheckbars, tuneText) {
  const tuneHeaderKeys = tuneText ? collectHeaderKeys(tuneText) : new Set();
  const layers = [];
  const fontLayerRaw = buildAbc2svgFontHeaderLayer();
  if (globalHeaderEnabled) {
    const globalHeaderRaw = normalizeHeaderLayer(globalHeaderGlobalText);
    if (globalHeaderRaw) layers.push({ kind: "abcarus", text: globalHeaderRaw });
    const localHeaderRaw = normalizeHeaderLayer(globalHeaderLocalText);
    if (localHeaderRaw) layers.push({ kind: "abcarus", text: localHeaderRaw });
    const userHeaderRaw = normalizeHeaderLayer(globalHeaderUserText);
    if (userHeaderRaw) layers.push({ kind: "abcarus", text: userHeaderRaw });
    const legacyHeaderRaw = normalizeHeaderLayer(globalHeaderText);
    if (legacyHeaderRaw) layers.push({ kind: "abcarus", text: legacyHeaderRaw });
  }
  if (fontLayerRaw) layers.push({ kind: "abcarus", text: fontLayerRaw });
  const fileHeaderRaw = String(entryHeader || "");
  if (fileHeaderRaw.trim()) layers.push({ kind: "fileHeader", text: fileHeaderRaw.replace(/[\r\n]+$/, "") });

  let deduped = dedupeHeaderLayersWithMeta(layers, tuneHeaderKeys);

  // Keep measure checkbars consistent with normal render, but treat it as an ABCarus addition.
  if (includeCheckbars && isMeasureCheckEnabled()) {
    const has = deduped.some((l) => /%%\s*checkbars\b/i.test(String(l && l.text ? l.text : "")));
    if (!has) {
      deduped = [{ kind: "abcarus", text: "%%checkbars 1" }, ...deduped];
    }
  }

  // Normalize: no trailing newlines per layer; join with single newlines and end with one newline.
  const normalized = deduped.map((l) => ({ ...l, text: String(l.text || "").replace(/[\r\n]+$/, "") }))
    .filter((l) => String(l.text || "").trim());
  const joined = normalized.map((l) => l.text).join("\n");
  if (!joined.trim()) return { text: "", offset: 0, spans: [] };

  const spans = [];
  let lineNo = 1;
  for (let i = 0; i < normalized.length; i += 1) {
    const layer = normalized[i];
    const cls = layer.kind === "fileHeader" ? "cm-payload-layer-fileheader" : "cm-payload-layer-abcarus";
    const lineCount = String(layer.text || "").split(/\r\n|\n|\r/).length;
    spans.push({ fromLine: lineNo, toLine: lineNo + Math.max(0, lineCount - 1), className: cls });
    lineNo += lineCount;
  }

  const prefix = /[\r\n]$/.test(joined) ? joined : `${joined}\n`;
  return { text: prefix, offset: prefix.length, spans };
}

function sanitizeFileHeaderForInteractiveRender(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) return "";
  const lines = raw.split("\n");
  const out = [];
  let inTextBlock = false;
  let inSvgBlock = false;

  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (/^%%\s*beginsvg\b/i.test(trimmed)) {
      inSvgBlock = true;
      out.push(line);
      continue;
    }
    if (inSvgBlock) {
      out.push(line);
      if (/^%%\s*endsvg\b/i.test(trimmed)) inSvgBlock = false;
      continue;
    }
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (inTextBlock) {
      if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
      continue;
    }
    if (!trimmed) {
      out.push("");
      continue;
    }
    // Keep only ABC-like header lines. Drop free-form prose to avoid repeating it before every tune.
    if (/^%%/.test(trimmed)) {
      const directive = trimmed
        .replace(/^%%\s*/, "")
        .split(/\s+/, 1)[0]
        .toLowerCase();
      // Book/layout/text directives from file headers should not be repeated per-tune in the interactive view.
      const skip = new Set([
        "begintext",
        "endtext",
        "text",
        "center",
        "vskip",
        "textfont",
        "titleformat",
        "subtitleformat",
        "header",
        "footer",
        "newpage",
        "multicol",
        "eps",
        "leftmargin",
        "rightmargin",
      ]);
      if (!skip.has(directive)) out.push(line);
      continue;
    }
    if (/^%/.test(trimmed) || /^[A-Za-z]:/.test(trimmed)) {
      out.push(line);
      continue;
    }
  }
  return out.join("\n").replace(/\s+$/, "");
}

function sanitizeFileHeaderForPerTuneRender(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) return "";
  const lines = raw.split("\n");
  const out = [];
  let inTextBlock = false;
  let inSvgBlock = false;

  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (/^%%\s*beginsvg\b/i.test(trimmed)) {
      inSvgBlock = true;
      out.push(line);
      continue;
    }
    if (inSvgBlock) {
      out.push(line);
      if (/^%%\s*endsvg\b/i.test(trimmed)) inSvgBlock = false;
      continue;
    }
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (inTextBlock) {
      if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
      continue;
    }
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (/^%%/.test(trimmed)) {
      const directive = trimmed
        .replace(/^%%\s*/, "")
        .split(/\s+/, 1)[0]
        .toLowerCase();
      // Keep print/layout directives, but drop book-style prose that shouldn't be repeated per tune.
      const skip = new Set([
        "begintext",
        "endtext",
        "text",
        "center",
        "vskip",
        "textfont",
        "titleformat",
        "subtitleformat",
        // File-level %%newpage would force a page break before every tune in Print All / Set List.
        "newpage",
      ]);
      if (!skip.has(directive)) out.push(line);
      continue;
    }
    if (/^%/.test(trimmed) || /^[A-Za-z]:/.test(trimmed)) {
      out.push(line);
      continue;
    }
  }
  return out.join("\n").replace(/\s+$/, "");
}

function parseFraction(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw === "C") return { num: 4, den: 4 };
  if (raw === "C|") return { num: 2, den: 2 };
  const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return { num, den };
}

function normalizeFraction(frac) {
  if (!frac) return null;
  let num = frac.num;
  let den = frac.den;
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const sign = den < 0 ? -1 : 1;
  num *= sign;
  den *= sign;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

function fractionDiv(a, b) {
  return normalizeFraction({ num: a.num * b.den, den: a.den * b.num });
}

function fractionMul(a, b) {
  return normalizeFraction({ num: a.num * b.num, den: a.den * b.den });
}

function fractionMulInt(a, k) {
  return normalizeFraction({ num: a.num * k, den: a.den });
}

function fractionToNumber(a) {
  return a.num / a.den;
}

function formatDuration(mult) {
  const frac = normalizeFraction(mult);
  if (!frac) return "";
  if (frac.num === frac.den) return "";
  if (frac.den === 1) return String(frac.num);
  if (frac.num === 1) return `/${frac.den}`;
  return `${frac.num}/${frac.den}`;
}

function matchBarToken(line, idx) {
  const src = String(line || "");
  const start = Number(idx) || 0;
  if (start < 0 || start >= src.length) return null;
  const ch = src[start];
  if (!ch) return null;
  // Barline tokens in ABC are composed of |, :, [, ], and the special dotted barline .|
  // Important: '[' is also used for chord notes (e.g. [CEG]), so only treat it as a barline
  // when it's clearly a barline/volta marker (e.g. [|, [], [1, [2).
  if (ch === ".") {
    if (start + 1 >= src.length || src[start + 1] !== "|") return null;
  } else if (ch === "[") {
    const next = start + 1 < src.length ? src[start + 1] : "";
    if (!(next === "|" || next === "]" || /[0-9]/.test(next))) return null;
  } else if (ch === ":") {
    const next = start + 1 < src.length ? src[start + 1] : "";
    // Prevent false positives on inline fields like "V:1" inside "[V:1 ...]".
    if (/[0-9]/.test(next)) return null;
  } else if (ch !== "|" && ch !== ":") {
    return null;
  }
  let end = start;
  while (end < src.length) {
    const c = src[end];
    if (c === ".") {
      if (end + 1 < src.length && src[end + 1] === "|") {
        end += 1;
        continue;
      }
      break;
    }
    if (!/[|[\]:]/.test(c)) break;
    end += 1;
  }
  while (end < src.length && /[0-9]/.test(src[end])) end += 1;
  if (end <= start) return null;
  return { token: src.slice(start, end), len: end - start };
}

function slicePatternTokens(tokens, startUnit, length) {
  const out = [];
  let cursor = 0;
  for (const token of tokens) {
    const tokenStart = cursor;
    const tokenEnd = cursor + token.len;
    if (tokenEnd <= startUnit) {
      cursor = tokenEnd;
      continue;
    }
    if (tokenStart >= startUnit + length) break;
    const sliceStart = Math.max(tokenStart, startUnit);
    const sliceEnd = Math.min(tokenEnd, startUnit + length);
    const sliceLen = sliceEnd - sliceStart;
    if (sliceLen > 0) {
      let type = token.type;
      let hitIndex = token.hitIndex;
      if (token.type === "d" && sliceStart > tokenStart) {
        type = "z";
        hitIndex = null;
      }
      out.push({ type, len: sliceLen, hitIndex });
    }
    cursor = tokenEnd;
  }
  return out;
}

function buildPitchMap(pitches) {
  const unique = [];
  const seen = new Set();
  for (const pitch of pitches) {
    if (!Number.isFinite(pitch)) continue;
    if (seen.has(pitch)) continue;
    seen.add(pitch);
    unique.push(pitch);
  }
  // For percussion (%%MIDI drummap), the ABC "note" token is only a stable key.
  // The actual sound comes from the MIDI pitch mapping, so we prefer visually clear tokens
  // that sit in the middle of the staff (c/d/...) over ledger-line-heavy low tokens (C,/D,).
  const palette = [
    "c", "d", "e", "f", "g", "a", "b",
    "C", "D", "E", "F", "G", "A", "B",
    "c'", "d'", "e'", "f'", "g'", "a'", "b'",
    "C,", "D,", "E,", "F,", "G,", "A,", "B,",
  ];
  const map = new Map();
  let idx = 0;
  for (const pitch of unique) {
    const note = palette[idx % palette.length];
    map.set(pitch, note);
    idx += 1;
  }
  return map;
}

function extractDrumPlaybackBars(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  let meter = { num: 4, den: 4 };
  let unit = { num: 1, den: 8 };
  let drumOn = false;
  let drumBars = 1;
  let currentPattern = null;
  let inBody = false;
  let currentVoice = null;
  let primaryVoice = null;
  let firstVoice = null;
  let pendingStartToken = null;
  let hasContent = false;
  let barSourceText = "";
  let leadingToken = null;
  let inTextBlock = false;
  const bars = [];
  const patterns = [];
  let pendingDirectives = [];
  const lineIndents = new Map();
  const recordFieldDirective = (field, value, { inline = false } = {}) => {
    const f = String(field || "").trim().toUpperCase();
    const v = String(value || "").trim();
    if (!f || !v) return;
    if (f !== "M" && f !== "L" && f !== "Q") return;
    const text = inline ? `[${f}:${v}]` : `${f}:${v}`;
    pendingDirectives.push(text);
  };
  function applyMidiDirective(directiveLine) {
    const line = String(directiveLine || "").trim();
    if (!line) return;
    if (/^%%MIDI\s+drumon\b/i.test(line)) {
      drumOn = true;
      return;
    }
    if (/^%%MIDI\s+drumoff\b/i.test(line)) {
      drumOn = false;
      return;
    }
    const drumBarsMatch = line.match(/^%%MIDI\s+drumbars\s+(\d+)/i);
    if (drumBarsMatch) {
      const nextBars = Number(drumBarsMatch[1]);
      if (Number.isFinite(nextBars) && nextBars > 0) drumBars = nextBars;
      return;
    }
    const drumMatch = line.match(/^%%MIDI\s+drum\s+(.+)$/i);
    if (drumMatch) {
      const rest = drumMatch[1].trim();
      // Compatibility feature (ABCarus): allow continuation for long directives via `+:`.
      // Example:
      //   %%MIDI drum d3 d d z d
      //   %%MIDI drum +: 36 37 37 37
      //   %%MIDI drum +: 100 120 120 120
      // abc2svg does not define this behavior, but users often write long drum directives this way.
      if (/^\+:/i.test(rest)) {
        if (!currentPattern || !currentPattern.hitCount) return;
        const nums = rest.replace(/^\+:\s*/i, "").split(/\s+/).map((n) => Number(n)).filter((n) => Number.isFinite(n));
        if (!nums.length) return;
        const needed = Number(currentPattern.hitCount) || 0;
        let i = 0;
        while (i < nums.length && currentPattern.pitches.length < needed) currentPattern.pitches.push(nums[i++]);
        while (i < nums.length && currentPattern.velocities.length < needed) currentPattern.velocities.push(nums[i++]);
        return;
      }

      const tokens = rest.split(/\s+/).filter(Boolean);
      // Pattern is the concatenation of non-numeric tokens at the start.
      // This makes `%%MIDI drum d3 d d z d` work as if it was `d3ddzd`.
      const isInt = (t) => /^-?\d+$/.test(String(t || "").trim());
      let firstNum = -1;
      for (let i = 0; i < tokens.length; i += 1) {
        if (isInt(tokens[i])) { firstNum = i; break; }
      }
      const patternTokens = (firstNum === -1 ? tokens : tokens.slice(0, firstNum)).filter((t) => t !== "+:");
      const patternText = patternTokens.join("");
      const pattern = parseDrumPattern(patternText);
      if (!pattern) return;

      const nums = (firstNum === -1 ? [] : tokens.slice(firstNum))
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));
      const pitchCount = pattern.hitCount || 0;
      const pitches = nums.slice(0, pitchCount);
      const velocities = nums.slice(pitchCount, pitchCount * 2);
      currentPattern = {
        id: patterns.length + 1,
        raw: patternText,
        tokens: pattern.tokens,
        totalUnits: pattern.totalUnits,
        hitCount: pattern.hitCount,
        pitches,
        velocities,
      };
      patterns.push(currentPattern);
    }
  }
  const applyInlineField = (field, value) => {
    const f = String(field || "").trim().toUpperCase();
    const v = String(value || "").trim();
    if (!f) return;
    if (f === "V") {
      const voice = v.split(/\s+/)[0];
      if (voice) {
        currentVoice = voice;
        if (!firstVoice) firstVoice = voice;
        if (inBody && !primaryVoice) primaryVoice = voice;
      }
      return;
    }
    if (f === "K") {
      inBody = true;
      if (!primaryVoice && firstVoice) primaryVoice = firstVoice;
      return;
    }
    if (f === "M") {
      const parsed = parseFraction(v);
      if (parsed) meter = parsed;
      recordFieldDirective("M", v, { inline: true });
      return;
    }
    if (f === "L") {
      const parsed = parseFraction(v);
      if (parsed) unit = parsed;
      recordFieldDirective("L", v, { inline: true });
      return;
    }
    if (f === "Q") {
      recordFieldDirective("Q", v, { inline: true });
      return;
    }
    if (f === "I") {
      // Support inline MIDI directives like [I:MIDI drum ...]
      const cleaned = v.replace(/^\s*MIDI\s+/i, "");
      if (cleaned !== v) {
        const midiLine = `%%MIDI ${cleaned}`;
        applyMidiDirective(midiLine);
      }
    }
  };
  const applyInlineFieldsFromLine = (line) => {
    const s = String(line || "");
    const re = /\[\s*([A-Za-z]+)\s*:\s*([^\]]*)\]/g;
    let match = null;
    while ((match = re.exec(s)) !== null) {
      applyInlineField(match[1], match[2]);
    }
  };
  const parseFieldValue = (line, field) => {
    const re = new RegExp(`\\b${field}:\\s*([^\\]\\s]+)`);
    const match = line.match(re);
    return match ? match[1] : null;
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    // Compatibility feature (ABCarus): allow `+:` continuation lines for long directives.
    // If users choose to omit repeating the directive prefix (e.g. `+: 36 37 ...` after `%%MIDI drum ...`),
    // treat it as continuing the last `%%MIDI drum` line for drum extraction.
    if (/^\+:/i.test(trimmed)) {
      applyMidiDirective(`%%MIDI drum ${trimmed}`);
      continue;
    }
    // Inline field directives like "[P:...]" or "[M:...]" are not musical bars, but some of them
    // affect playback state (meter/unit/voice/body start), so we handle those and skip scanning.
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      // Handle multi-inline-field lines like: [M:7/8][Q:1/4=220]
      const remainder = trimmed.replace(/\[\s*[A-Za-z]+\s*:\s*[^\]]*\]/g, "").trim();
      if (remainder === "") {
        applyInlineFieldsFromLine(trimmed);
        continue;
      }
    }
    if (trimmed.startsWith("V:")) {
      const v = trimmed.slice(2).trim().split(/\s+/)[0];
      if (v) {
        currentVoice = v;
        if (!firstVoice) firstVoice = v;
        if (inBody && !primaryVoice) primaryVoice = v;
      }
      // Voice declaration lines are not musical content. Do not scan them for barlines or note letters,
      // otherwise tokens like "treble" can be mis-read as notes and shift the repeat/bar skeleton.
      continue;
    }
    if (!inBody) {
      const kValue = parseFieldValue(trimmed, "K");
      if (kValue != null) {
        inBody = true;
        if (!primaryVoice && firstVoice) primaryVoice = firstVoice;
      }
    }
    const meterValue = parseFieldValue(trimmed, "M");
    if (meterValue) {
      const parsed = parseFraction(meterValue);
      if (parsed) meter = parsed;
      if (inBody && /^\s*M:/.test(trimmed)) recordFieldDirective("M", meterValue, { inline: false });
    }
    const unitValue = parseFieldValue(trimmed, "L");
    if (unitValue) {
      const parsed = parseFraction(unitValue);
      if (parsed) unit = parsed;
      if (inBody && /^\s*L:/.test(trimmed)) recordFieldDirective("L", unitValue, { inline: false });
    }
    const tempoValue = parseFieldValue(trimmed, "Q");
    if (tempoValue) {
      if (inBody && /^\s*Q:/.test(trimmed)) recordFieldDirective("Q", tempoValue, { inline: false });
    }
    if (/^%%MIDI\b/i.test(trimmed)) {
      applyMidiDirective(trimmed);
      continue;
    }
    if (/^I:\s*MIDI\b/i.test(trimmed)) {
      const midiLine = trimmed.replace(/^I:\s*/i, "%%");
      applyMidiDirective(midiLine);
      continue;
    }
    if (!inBody) continue;
    if (/^%/.test(trimmed)) continue;
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (/^%%\s*endtext\b/i.test(trimmed)) {
      inTextBlock = false;
      continue;
    }
    if (inTextBlock) continue;
    if (/^%%/.test(trimmed)) continue;
    if (/^[Ww]:/.test(trimmed)) continue;
    if (/^[A-Za-z]:/.test(trimmed) && !/^V:/.test(trimmed)) continue;
    if (!primaryVoice && currentVoice) primaryVoice = currentVoice;
    if (primaryVoice && currentVoice && currentVoice !== primaryVoice) continue;
    if (!lineIndents.has(lineIndex)) {
      const indent = String(rawLine || "").match(/^[\t ]*/)?.[0] ?? "";
      lineIndents.set(lineIndex, indent);
    }
    let line = rawLine;
    if (!trimmed.startsWith("%%")) {
      const idx = line.indexOf("%");
      if (idx >= 0) line = line.slice(0, idx);
    }
    let inQuote = false;
    for (let i = 0; i < line.length; ) {
      const ch = line[i];
      if (!inQuote && ch === "[") {
        const slice = line.slice(i);
        if (/^\[\s*[A-Za-z]+:/.test(slice)) {
          const close = line.indexOf("]", i + 1);
          if (close >= 0) {
            const inner = line.slice(i + 1, close);
            const match = inner.match(/^\s*([A-Za-z]+)\s*:\s*(.*)\s*$/);
            if (match) applyInlineField(match[1], match[2]);
            i = close + 1;
            continue;
          }
        }
      }
      if (ch === "\"") {
        inQuote = !inQuote;
        i += 1;
        continue;
      }
      if (!inQuote) {
        const token = matchBarToken(line, i);
        if (token) {
          if (hasContent) {
            bars.push({
              meter,
              unit,
              drumOn,
              drumBars,
              pattern: currentPattern,
              directives: pendingDirectives,
              startToken: pendingStartToken,
              endToken: token.token,
              sourceText: barSourceText.trim(),
              srcLineIndex: lineIndex,
            });
            pendingDirectives = [];
            pendingStartToken = null;
            hasContent = false;
            barSourceText = "";
          } else {
            pendingStartToken = token.token;
            if (!leadingToken && bars.length === 0) {
              leadingToken = token.token;
            }
            barSourceText = "";
          }
          i += token.len;
          continue;
        }
        if (/[A-Ga-gz]/.test(ch)) hasContent = true;
        barSourceText += ch;
      }
      i += 1;
    }
  }
  return { bars, patterns, leadingToken, lineIndents, trailingDirectives: pendingDirectives };
}

function buildDrumVoiceText(info) {
  if (!info || !info.bars || !info.bars.length) return "";
  const bars = info.bars;
  const usedPitches = [];
  let hasActivePattern = false;
  for (const bar of bars) {
    if (!bar.drumOn || !bar.pattern || !bar.pattern.pitches) continue;
    hasActivePattern = true;
    for (const pitch of bar.pattern.pitches) usedPitches.push(pitch);
  }
  if (!usedPitches.length) {
    if (!hasActivePattern) return "";
    usedPitches.push(35);
  }
  const pitchMap = buildPitchMap(usedPitches);
  const drummapLines = [];
  for (const [pitch, note] of pitchMap.entries()) {
    drummapLines.push(`%%MIDI drummap ${note} ${pitch}`);
  }

  const out = [];
  out.push("V:DRUM clef=perc name=\"Drums\"");
  out.push("%%MIDI channel 10");
  out.push(...drummapLines);

  let patternKey = null;
  let patternBarIndex = 0;
  let wasOn = false;
  let resetPatternNext = false;
  let lineBuffer = "";
  let currentLineIndex = null;

  const flushLine = () => {
    if (lineBuffer) out.push(lineBuffer);
    lineBuffer = "";
    currentLineIndex = null;
  };
  const toDurationFraction = (units) => {
    const u = Number(units);
    if (!Number.isFinite(u) || u <= 0) return null;
    const dens = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
    for (const den of dens) {
      const num = Math.round(u * den);
      if (num <= 0) continue;
      if (Math.abs((num / den) - u) <= 1e-6) return { num, den };
    }
    return { num: Math.max(1, Math.round(u * 64)), den: 64 };
  };

  for (let barIndex = 0; barIndex < bars.length; barIndex += 1) {
    const bar = bars[barIndex];
    const directives = Array.isArray(bar.directives) ? bar.directives : [];
    if (directives.length) {
      if (lineBuffer) {
        flushLine();
      }
      for (const directive of directives) {
        if (directive) out.push(String(directive));
      }
    }
    const meter = normalizeFraction(bar.meter) || { num: 4, den: 4 };
    const unit = normalizeFraction(bar.unit) || { num: 1, den: 8 };
    const barUnits = fractionDiv(meter, unit);
    let barText = "";

    const startToken = bar.startToken || "";
    const endToken = bar.endToken || "";
    let resetPatternHere = resetPatternNext;
    resetPatternNext = false;
    // Reset at repeat/volta boundaries so each segment starts from bar 1 of the drum pattern.
    if (startToken && (/\|:/.test(startToken) || /\[\d/.test(startToken) || /\|\|/.test(startToken))) {
      resetPatternHere = true;
    }
    if (endToken && (/:\|/.test(endToken) || /\|\|/.test(endToken) || /\|\]/.test(endToken))) {
      resetPatternNext = true;
    }

    const meterValue = Number(meter.num) / Number(meter.den);
    const defaultLen = Number(unit.num) / Number(unit.den);
    const isAnacrusisBar = (
      barIndex === 0
      && Number.isFinite(meterValue)
      && Number.isFinite(defaultLen)
      && isLikelyAnacrusis(String(bar.sourceText || ""), defaultLen, meterValue)
    );
    if (isAnacrusisBar) {
      const actualLen = getBarLength(String(bar.sourceText || ""), defaultLen, meterValue);
      const units = Number.isFinite(actualLen) && defaultLen > 0 ? (actualLen / defaultLen) : null;
      const frac = toDurationFraction(units);
      barText = frac ? `z${formatDuration(frac)}` : `z${formatDuration(barUnits)}`;
      patternKey = null;
      patternBarIndex = 0;
      wasOn = false;
    } else if (!bar.drumOn || !bar.pattern) {
      barText = `z${formatDuration(barUnits)}`;
      patternKey = null;
      patternBarIndex = 0;
      wasOn = false;
    } else {
      const pattern = bar.pattern;
      const key = `${pattern.id}:${bar.drumBars}`;
      if (!wasOn || key !== patternKey || resetPatternHere) patternBarIndex = 0;
      patternKey = key;
      wasOn = true;

      let drumBars = Number(bar.drumBars) || 1;
      let startUnit = 0;
      let length = pattern.totalUnits;
      if (drumBars > 1 && pattern.totalUnits % drumBars === 0) {
        length = pattern.totalUnits / drumBars;
        startUnit = length * (patternBarIndex % drumBars);
      } else {
        drumBars = 1;
        startUnit = 0;
        length = pattern.totalUnits;
      }
      const slice = slicePatternTokens(pattern.tokens, startUnit, length);
      const unitDur = fractionDiv(barUnits, { num: length, den: 1 });
      const parts = [];
      for (const token of slice) {
        const dur = fractionMulInt(unitDur, token.len);
        const durText = formatDuration(dur);
        if (token.type === "z") {
          parts.push(`z${durText}`);
          continue;
        }
        const pitchList = pattern.pitches || [];
        const pitch = pitchList.length
          ? pitchList[token.hitIndex % pitchList.length]
          : 35;
        const note = pitchMap.get(pitch) || "C";
        parts.push(`${note}${durText}`);
      }
      barText = parts.join("");
      patternBarIndex += 1;
    }

    // Strict bar-skeleton mapping:
    // each emitted drum bar must keep exactly the same start/end bar tokens as the source bar.
    // No inferred separators, no line-boundary injected bar tokens.
    const startTokenOut = String(bar.startToken || "");
    const endTokenOut = String(bar.endToken || "|");
    const emittedBar = `${startTokenOut}${barText}${endTokenOut}`;

    if (!lineBuffer) {
      const lineKey = Number.isFinite(bar.srcLineIndex) ? bar.srcLineIndex : null;
      currentLineIndex = lineKey;
      // Keep drum payload compact/readable for diagnostics: no inherited visual indentation.
      lineBuffer = "";
    }
    lineBuffer += emittedBar;

    // If the tune ends explicitly with `|]`, stop emitting further drum bars.
    if (bar.endToken && /\|\]/.test(bar.endToken)) {
      break;
    }

    const nextBar = bars[barIndex + 1] || null;
    const nextLineKey = nextBar && Number.isFinite(nextBar.srcLineIndex) ? nextBar.srcLineIndex : null;
    if (currentLineIndex != null && nextLineKey != null && nextLineKey !== currentLineIndex) {
      // Preserve source wrapping only; do not invent additional bar separators on line breaks.
      flushLine();
    }
  }
  if (lineBuffer) flushLine();
  const trailing = Array.isArray(info.trailingDirectives) ? info.trailingDirectives : [];
  for (const directive of trailing) {
    if (directive) out.push(String(directive));
  }
  return out.join("\n");
}

function normalizeLeadingInlineDirectivesForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  const tokenRe = /^\[\s*([A-Za-z]+)\s*:\s*([^\]]*)\]\s*/;

  for (const rawLine of lines) {
    const indent = String(rawLine || "").match(/^[\t ]*/)?.[0] ?? "";
    let rest = String(rawLine || "").slice(indent.length);
    if (!rest.startsWith("[")) {
      out.push(rawLine);
      continue;
    }

    const directives = [];
    const keptTokens = [];
    let consumedAny = false;

    while (rest.startsWith("[")) {
      const match = rest.match(tokenRe);
      if (!match) break;
      consumedAny = true;
      const rawToken = match[0];
      const field = String(match[1] || "").trim().toUpperCase();
      const value = String(match[2] || "").trim();
      rest = rest.slice(rawToken.length);

      let converted = null;
      if ((field === "M" || field === "L" || field === "Q") && value) {
        converted = `${field}:${value}`;
      } else if (field === "I" && /^MIDI\s+/i.test(value)) {
        const cleaned = value.replace(/^MIDI\s+/i, "").trim();
        if (cleaned) converted = `%%MIDI ${cleaned}`;
      }

      if (converted) {
        directives.push(`${indent}${converted}`);
      } else {
        keptTokens.push(rawToken.trim());
      }
    }

    if (!consumedAny || !directives.length) {
      out.push(rawLine);
      continue;
    }

    out.push(...directives);
    const keptPrefix = keptTokens.length ? `${keptTokens.join(" ")} ` : "";
    const remainder = `${indent}${keptPrefix}${rest}`.replace(/[ \t]+$/g, "");
    if (remainder.trim()) out.push(remainder);
  }

  return out.join("\n");
}

function injectDrumPlayback(text) {
  if (text === lastDrumInjectInput && lastDrumInjectResult) {
    return lastDrumInjectResult;
  }
  lastDrumPlaybackActive = false;
  lastDrumSignatureDiff = null;
  const activeTuneId = activeTuneMeta && activeTuneMeta.id ? String(activeTuneMeta.id) : null;
  if (lastDrumMismatchTuneId && lastDrumMismatchTuneId !== activeTuneId) {
    clearDrumMismatchError();
  }
  const normalizedText = normalizeLeadingInlineDirectivesForPlayback(text);
  if (window.__abcarusDisableDrumInjection === true) {
    lastDrumMismatchInfo = null;
    clearDrumMismatchError();
    const res = { text: normalizedText, changed: false, insertAtLine: null, lineCount: 0 };
    lastDrumInjectInput = text;
    lastDrumInjectResult = res;
    return res;
  }
  if (/^\s*V:\s*DRUM\b/im.test(normalizedText || "")) {
    lastDrumMismatchInfo = null;
    clearDrumMismatchError();
    const res = { text: normalizedText, changed: false, insertAtLine: null, lineCount: 0 };
    lastDrumInjectInput = text;
    lastDrumInjectResult = res;
    return res;
  }
  const info = extractDrumPlaybackBars(normalizedText);
  const expectedSig = computeExpectedBarSignatureFromInfo(info);
  const drumVoice = buildDrumVoiceText(info);
  if (!drumVoice) {
    lastDrumMismatchInfo = null;
    clearDrumMismatchError();
    const res = { text: normalizedText, changed: false, insertAtLine: null, lineCount: 0 };
    lastDrumInjectInput = text;
    lastDrumInjectResult = res;
    return res;
  }
  const actualSig = extractBarSignatureFromText(drumVoice);
  const sigDiff = diffSignatures(expectedSig, actualSig);
  if (!sigDiff.ok) {
    // Safety guard: if our generated drums don't match the barline skeleton, do not inject drums.
    lastDrumPlaybackActive = false;
    lastDrumSignatureDiff = sigDiff;
    const mismatchBar = Number.isFinite(sigDiff.index) ? sigDiff.index + 1 : null;
    const barInfo = (Number.isFinite(sigDiff.index) && info && Array.isArray(info.bars))
      ? info.bars[sigDiff.index] : null;
    const lineIdx = barInfo && Number.isFinite(barInfo.srcLineIndex) ? barInfo.srcLineIndex : null;
    lastDrumMismatchInfo = {
      mismatchBar,
      lineIndex: Number.isFinite(lineIdx) ? lineIdx : null,
      expectedToken: sigDiff.expectedToken || null,
      actualToken: sigDiff.actualToken || null,
    };
    lastDrumMismatchTuneId = activeTuneId;
    ensureDrumMismatchErrorVisible();
    const res = { text: normalizedText, changed: false, insertAtLine: null, lineCount: 0, signatureDiff: sigDiff };
    lastDrumInjectInput = text;
    lastDrumInjectResult = res;
    return res;
  }
  lastDrumMismatchInfo = null;
  clearDrumMismatchError();
  lastDrumPlaybackActive = true;
  if (window.__abcarusDebugDrums) {
    console.log("[abcarus] drum voice:\n" + drumVoice);
  }
  const lines = String(normalizedText || "").split(/\r\n|\n|\r/);
  // Once we inject an explicit DRUM voice, we no longer want abc2svg playback to interpret
  // the original `%%MIDI drum ...` directives (they can be long, have custom continuations, or
  // be parsed differently across versions). Keep the text length stable for Follow mapping.
  let inDrumDirectiveRun = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || "";
    const trimmed = raw.trim();
    if (/^\s*%%MIDI\s+drum\b/i.test(raw)) {
      inDrumDirectiveRun = true;
      const len = raw.length;
      lines[i] = len <= 0 ? "%" : (`%${" ".repeat(Math.max(0, len - 1))}`);
      continue;
    }
    if (inDrumDirectiveRun && /^\+:\s*/i.test(trimmed)) {
      const len = raw.length;
      lines[i] = len <= 0 ? "%" : (`%${" ".repeat(Math.max(0, len - 1))}`);
      continue;
    }
    inDrumDirectiveRun = false;
  }
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/^%/.test(trimmed)) continue;
    if (/^%%score\b/i.test(trimmed)) {
      if (!/\bDRUM\b/.test(lines[i])) lines[i] = `${lines[i]} DRUM`;
      break;
    }
    if (/^%%staves\b/i.test(trimmed)) {
      if (!/\bDRUM\b/.test(lines[i])) lines[i] = `${lines[i]} DRUM`;
      break;
    }
  }
  // DRUM injection must depend only on MIDI drum directives and musical bar skeleton.
  // Do not couple insertion point to visual/layout directives such as %%sep.
  const insertAt = lines.length;
  for (let i = insertAt - 1; i >= 0; i -= 1) {
    if (lines[i].trim() === "") {
      lines[i] = "%";
    } else {
      break;
    }
  }
  const drumLines = drumVoice.split("\n");
  lines.splice(insertAt, 0, ...drumLines);
  const merged = lines.join("\n");
  const suffix = merged.endsWith("\n") ? "" : "\n";
  const res = {
    text: `${merged}${suffix}`,
    changed: true,
    insertAtLine: insertAt + 1,
    lineCount: drumLines.length,
  };
  lastDrumInjectInput = text;
  lastDrumInjectResult = res;
  return res;
}

function injectGchordOn(text, insertAt) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  let hasGchordPattern = false;
  let hasGchordToggle = false;
  let inTextBlock = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^%%\s*begintext\b/i.test(trimmed)) {
      inTextBlock = true;
      continue;
    }
    if (/^%%\s*endtext\b/i.test(trimmed)) {
      inTextBlock = false;
      continue;
    }
    if (inTextBlock) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    if (/^%%MIDI\s+gchord(on|off)\b/i.test(trimmed)) {
      hasGchordToggle = true;
      continue;
    }
    if (/^%%MIDI\s+gchord\b/i.test(trimmed)) {
      hasGchordPattern = true;
    }
  }

  if (!hasGchordPattern || hasGchordToggle) {
    return { text, changed: false, offsetDelta: 0 };
  }

  const safeInsertAt = Number.isFinite(insertAt) ? insertAt : 0;
  let insertText = "%%MIDI gchordon\n";
  if (safeInsertAt > 0 && text[safeInsertAt - 1] !== "\n") {
    insertText = `\n${insertText}`;
  }
  const merged = `${text.slice(0, safeInsertAt)}${insertText}${text.slice(safeInsertAt)}`;
  return { text: merged, changed: true, offsetDelta: insertText.length };
}

function normalizeDollarLineBreaksForPlayback(text) {
  const src = String(text || "");
  if (!src.includes("$")) return src;
  // Playback-only cleanup:
  // - Drop "$ %..." tails (common bar/line markers used for layout, irrelevant for playback/drums).
  // - Replace other '$' occurrences with whitespace (some playback parsers treat '$' as a literal token and break repeats).
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    // Don't modify linebreak directives themselves; some files use `I:linebreak $`.
    if (!inTextBlock && (/^\s*I:\s*linebreak\b/i.test(rawLine) || /^\s*%%\s*linebreak\b/i.test(rawLine))) {
      out.push(rawLine);
      continue;
    }
    if (inTextBlock || !rawLine.includes("$")) {
      out.push(rawLine);
      continue;
    }
    let lineOut = "";
    let inQuote = false;
    for (let i = 0; i < rawLine.length; i += 1) {
      const ch = rawLine[i];
      if (ch === "\"") {
        inQuote = !inQuote;
        lineOut += ch;
        continue;
      }
      if (!inQuote && ch === "$") {
        lineOut += " ";
        continue;
      }
      lineOut += ch;
    }
    out.push(lineOut);
  }
  return out.join("\n");
}

function normalizeBlankLinesForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  if (lines.length <= 2) return String(text || "");
  const out = [];
  let inTextBlock = false;
  let inBody = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (!inBody && (/^\s*K:/.test(line) || /^\s*\[\s*K:/.test(trimmed))) inBody = true;
    if (!inBody || inTextBlock) {
      out.push(line);
      continue;
    }
    if (trimmed !== "") {
      out.push(line);
      continue;
    }
    // Inside tune body, blank lines can be parsed as tune separators and stop playback.
    // Keep output stable by replacing them with comment placeholders.
    out.push("%");
  }
  return out.join("\n");
}

function sanitizeAbcForPlayback(text) {
  const src = String(text || "");
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  const warnings = [];
  let inTextBlock = false;
  let inBody = false;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (!inBody && (/^\s*K:/.test(rawLine) || /^\s*\[\s*K:/.test(trimmed))) inBody = true;

    if (inTextBlock || !inBody) {
      // Still remove line-continuation backslashes outside text blocks even before body;
      // they are never meaningful for playback parsing.
      const cleaned = rawLine.replace(/[ \t]*\\\s*$/, (m) => {
        warnings.push({ kind: "line-continuation", line: lineIndex + 1 });
        return " ".repeat(String(m || "").length);
      });
      out.push(cleaned);
      continue;
    }

    // Split comments (keep them intact; only sanitize music part).
    let musicPart = rawLine;
    let commentPart = "";
    if (!trimmed.startsWith("%%")) {
      const commentIdx = rawLine.indexOf("%");
      if (commentIdx >= 0) {
        musicPart = rawLine.slice(0, commentIdx);
        commentPart = rawLine.slice(commentIdx);
      }
    }

    // 1) Remove trailing line-continuation backslash: `...\` -> `...`
    musicPart = musicPart.replace(/[ \t]*\\\s*$/, (m) => {
      warnings.push({ kind: "line-continuation", line: lineIndex + 1 });
      return " ".repeat(String(m || "").length);
    });

    // 2) Make multi-repeat tokens more stable: `|:::` -> `|::`, `:::` -> `::`, `:::|` -> `::|`
    // Keep `::` unchanged (common boundary repeat); only collapse 3+ down to the double-repeat form.
    const beforeRepeats = musicPart;
    musicPart = musicPart
      .replace(/\|:{3,}/g, (m) => `|::${" ".repeat(Math.max(0, String(m || "").length - 3))}`)
      .replace(/:{3,}\|/g, (m) => `::|${" ".repeat(Math.max(0, String(m || "").length - 3))}`)
      .replace(/:{3,}/g, (m) => `::${" ".repeat(Math.max(0, String(m || "").length - 2))}`);
    if (musicPart !== beforeRepeats) warnings.push({ kind: "multi-repeat-simplified", line: lineIndex + 1 });

    // 3) Replace spacer rests `y` with normal rests `z` (playback-only stability).
    // Target `y` tokens with optional durations like `y4`, `y2/`, `y/2`.
    const beforeY = musicPart;
    musicPart = musicPart.replace(/(^|[^A-Za-z0-9_])y(?=([0-9]|\/|$))/g, "$1z");
    if (musicPart !== beforeY) warnings.push({ kind: "spacer-rest-y", line: lineIndex + 1 });

    out.push(`${musicPart}${commentPart}`);
  }

  return { text: out.join("\n"), warnings };
}

function isInlineFieldOnlyLine(rawLine) {
  const trimmed = String(rawLine || "").trim();
  if (!trimmed.startsWith("[")) return false;
  let rest = trimmed;
  // Consume one or more leading inline fields: `[P:...] [M:...] ...`
  while (true) {
    const m = rest.match(/^\[\s*[A-Za-z]+\s*:\s*[^\]]*\]\s*/);
    if (!m) break;
    rest = rest.slice(m[0].length);
  }
  const tail = rest.trim();
  if (!tail) return true;
  // Treat "only comment after inline field" as header-like (no music content).
  if (tail.startsWith("%")) return true;
  return false;
}

function detectKeyFieldNotLastBeforeBody(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const isTuneStart = (line) => /^\s*X:/.test(line);
  const isFieldLine = (line) => /^\s*[A-Za-z]:/.test(line);
  const isContinuationLine = (line) => /^\s*\+:\s*/.test(line);
  const isKeyLine = (line) => /^\s*K:/.test(line);
  const isPartLine = (line) => /^\s*P:/.test(line);
  const isCommentLine = (line) => /^\s*%/.test(line);
  const isDirectiveLine = (line) => /^\s*%%/.test(line);
  const beginsBlock = (trimmed) => {
    if (!/^%%\s*begin/i.test(trimmed)) return null;
    if (/^%%\s*begintext\b/i.test(trimmed)) return "text";
    if (/^%%\s*beginsvg\b/i.test(trimmed)) return "svg";
    if (/^%%\s*beginps\b/i.test(trimmed)) return "ps";
    return "other";
  };
  const endsBlock = (trimmed, block) => {
    if (!block) return false;
    if (block === "text") return /^%%\s*endtext\b/i.test(trimmed);
    if (block === "svg") return /^%%\s*endsvg\b/i.test(trimmed);
    if (block === "ps") return /^%%\s*endps\b/i.test(trimmed);
    if (block === "other") return /^%%\s*end/i.test(trimmed);
    return false;
  };

  const scanTune = (start, end) => {
    let kIdx = -1;
    for (let i = start; i < end; i += 1) {
      if (isKeyLine(lines[i])) { kIdx = i; break; }
    }
    if (kIdx < 0) return null;

    let block = null;
    let bodyStart = end;
    for (let j = kIdx + 1; j < end; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (block) {
        if (endsBlock(trimmed, block)) block = null;
        continue;
      }
      const begin = beginsBlock(trimmed);
      if (begin) {
        block = begin;
        continue;
      }
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isPartLine(raw)) { bodyStart = j; break; }
      // Inline field-only lines like `[P:A]` or `[M:...]` are tune-body directives (even if they contain no notes).
      // Treat them as the body start so we don't reorder K: past them (it can break P: parts playback).
      if (isInlineFieldOnlyLine(raw)) { bodyStart = j; break; }
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) continue;
      bodyStart = j;
      break;
    }

    let firstOffender = null;
    for (let j = kIdx + 1; j < bodyStart; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) {
        firstOffender = { line: j + 1, text: raw };
        break;
      }
    }
    if (!firstOffender) return null;

    const tuneLabel = (() => {
      for (let i = start; i < end; i += 1) {
        const m = String(lines[i] || "").match(/^\s*X:\s*(\d+)/);
        if (m) return `X:${m[1]}`;
      }
      return null;
    })();

    return {
      kind: "abc2svg-k-field-not-last",
      loc: { line: firstOffender.line, col: 1 },
      detail: `${tuneLabel ? `${tuneLabel}: ` : ""}K: is not the last header field before the music. abc2svg playback may fail when directives/fields appear after K:.`,
    };
  };

  let start = 0;
  let sawTuneStart = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTuneStart(lines[i])) {
      if (sawTuneStart) {
        const warn = scanTune(start, i);
        if (warn) return warn;
        start = i;
      } else {
        sawTuneStart = true;
        start = i;
      }
    }
  }
  const warn = scanTune(sawTuneStart ? start : 0, lines.length);
  return warn || null;
}

function normalizeKeyFieldToBeLastBeforeBodyForPlayback(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const isTuneStart = (line) => /^\s*X:/.test(line);
  const isFieldLine = (line) => /^\s*[A-Za-z]:/.test(line);
  const isContinuationLine = (line) => /^\s*\+:\s*/.test(line);
  const isKeyLine = (line) => /^\s*K:/.test(line);
  const isVoiceLine = (line) => /^\s*V:/.test(line);
  const isPartLine = (line) => /^\s*P:/.test(line);
  const isCommentLine = (line) => /^\s*%/.test(line);
  const isDirectiveLine = (line) => /^\s*%%/.test(line);
  const beginsBlock = (trimmed) => {
    if (!/^%%\s*begin/i.test(trimmed)) return null;
    if (/^%%\s*begintext\b/i.test(trimmed)) return "text";
    if (/^%%\s*beginsvg\b/i.test(trimmed)) return "svg";
    if (/^%%\s*beginps\b/i.test(trimmed)) return "ps";
    return "other";
  };
  const endsBlock = (trimmed, block) => {
    if (!block) return false;
    if (block === "text") return /^%%\s*endtext\b/i.test(trimmed);
    if (block === "svg") return /^%%\s*endsvg\b/i.test(trimmed);
    if (block === "ps") return /^%%\s*endps\b/i.test(trimmed);
    if (block === "other") return /^%%\s*end/i.test(trimmed);
    return false;
  };

  const normalizeTune = (start, end) => {
    let kIdx = -1;
    for (let i = start; i < end; i += 1) {
      if (isKeyLine(lines[i])) { kIdx = i; break; }
    }
    if (kIdx < 0) return false;

    let block = null;
    let bodyStart = end;
    for (let j = kIdx + 1; j < end; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (block) {
        if (endsBlock(trimmed, block)) block = null;
        continue;
      }
      const begin = beginsBlock(trimmed);
      if (begin) {
        block = begin;
        continue;
      }
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      // Treat P: like tune-body start for playback ordering: K: must be the last *header* field,
      // but P: is a body marker and often precedes the first music line.
      if (isPartLine(raw)) { bodyStart = j; break; }
      // Inline field-only lines like `[P:A]` or `[M:...]` are tune-body directives (even if they contain no notes).
      // Treat them as the body start so we don't reorder K: past them (it can break P: parts playback).
      if (isInlineFieldOnlyLine(raw)) { bodyStart = j; break; }
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) continue;
      bodyStart = j;
      break;
    }
    if (bodyStart <= kIdx + 1) return false;

    let hasPostKeyHeader = false;
    for (let j = kIdx + 1; j < bodyStart; j += 1) {
      const raw = lines[j];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (isCommentLine(raw)) continue;
      if (isDirectiveLine(raw) || isFieldLine(raw) || isContinuationLine(raw)) {
        hasPostKeyHeader = true;
        break;
      }
    }
    if (!hasPostKeyHeader) return false;

    const insertAt = bodyStart - 1;
    if (insertAt <= kIdx) return false;

    // Offset-stable normalization:
    // Instead of moving lines (which shifts character offsets and breaks Follow/SVG mapping),
    // relocate the *content* of K: to the last header line slot while preserving line lengths.
    //
    // We intentionally sacrifice the original content of the destination line (typically %%score / directives),
    // but keep all other post-K header lines (notably V:) intact.
    //
    // If the last header line is a voice header, we refuse to do the swap (losing V: would break playback).
    // In that rare case, we keep the original order and let other compat paths handle playback.
    const dstRaw = lines[insertAt] || "";
    if (isVoiceLine(dstRaw)) return false;

    const kLine = lines[kIdx] || "";
    const dstLen = String(dstRaw).length;
    const kTrimmed = kLine.replace(/[\r\n]+$/, "");
    if (dstLen < kTrimmed.length) return false;
    const kPadded = (kTrimmed.length >= dstLen)
      ? kTrimmed.slice(0, dstLen)
      : (kTrimmed + " ".repeat(dstLen - kTrimmed.length));

    const srcLen = String(kLine).length;
    const placeholder = srcLen <= 0 ? "%" : (`%${" ".repeat(Math.max(0, srcLen - 1))}`);

    lines[kIdx] = placeholder;
    lines[insertAt] = kPadded;
    return true;
  };

  let changed = false;
  let start = 0;
  let sawTuneStart = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (isTuneStart(lines[i])) {
      if (sawTuneStart) {
        if (normalizeTune(start, i)) changed = true;
        start = i;
      } else {
        sawTuneStart = true;
        start = i;
      }
    }
  }
  if (normalizeTune(sawTuneStart ? start : 0, lines.length)) changed = true;
  return { text: lines.join("\n"), changed };
}

function stripLyricsForPlayback(text) {
  // Important: keep the output string length identical to the input.
  // Follow/highlighting depends on stable character offsets between playback text and rendered SVG.
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(line);
      continue;
    }
    if (/^\s*w:/.test(line) || /^\s*W:/.test(line)) {
      const len = String(line || "").length;
      if (len <= 0) out.push("%");
      else out.push(`%${" ".repeat(Math.max(0, len - 1))}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function normalizeBarsForPlayback(text) {
  // abc2svg is strict about barline consistency across voices. Some sources mix `||` and `|` at the same moment,
  // which other players may ignore. For playback-only stability, normalize multi-bars to a single bar.
  // Keep string length stable for Follow mapping: replace `||` with `| ` (bar + space).
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(rawLine);
      continue;
    }
    // Leave directives untouched.
    if (/^\s*%%/.test(rawLine) || /^\s*[A-Za-z]:/.test(rawLine) || isInlineFieldOnlyLine(rawLine)) {
      out.push(rawLine);
      continue;
    }
    out.push(rawLine.replace(/\|\|/g, "| "));
  }
  return out.join("\n");
}

function stripChordSymbolsForPlayback(text) {
  const src = String(text || "");
  if (!src.includes("\"")) return src;
  const lines = src.split(/\r\n|\n|\r/);
  const out = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) inTextBlock = true;
    if (/^%%\s*endtext\b/i.test(trimmed)) inTextBlock = false;
    if (inTextBlock) {
      out.push(rawLine);
      continue;
    }
    // Do not touch header/directive-only lines (e.g. V:... nm="...").
    // We only want to suppress inline chord symbols in music body lines.
    if (/^\s*%%/.test(rawLine) || /^\s*[A-Za-z]:/.test(rawLine) || isInlineFieldOnlyLine(rawLine)) {
      out.push(rawLine);
      continue;
    }
    // Remove chord symbols / annotations in quotes. Playback stability > chord display here.
    // Keep the rest of the line intact and preserve line length for Follow mapping.
    const stripped = rawLine.replace(/\"[^\"]*\"/g, (m) => " ".repeat(String(m || "").length));
    if (stripped.trim() === "") {
      const len = String(stripped || "").length;
      out.push(len > 0 ? `%${" ".repeat(Math.max(0, len - 1))}` : "%");
    } else {
      out.push(stripped);
    }
  }
  return out.join("\n");
}

function extractBarSignatureFromText(text) {
  const lines = String(text || "").split(/\r\n|\n|\r/);
  const sig = [];
  let inTextBlock = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^%%\s*begintext\b/i.test(trimmed)) { inTextBlock = true; continue; }
    if (/^%%\s*endtext\b/i.test(trimmed)) { inTextBlock = false; continue; }
    if (inTextBlock) continue;
    if (!trimmed) continue;
    // Skip directives/fields that may contain ':' but are not musical bars.
    if (/^\s*%%/.test(rawLine)) continue;
    if (/^\s*[A-Za-z]:/.test(rawLine)) continue;
    if (isInlineFieldOnlyLine(rawLine)) continue;
    if (/^%/.test(trimmed) && !/^%%/.test(trimmed)) continue;
    let line = rawLine;
    const idx = line.indexOf("%");
    if (idx >= 0 && !/^\s*%%/.test(trimmed)) line = line.slice(0, idx);
    let inQuote = false;
    for (let i = 0; i < line.length; ) {
      const ch = line[i];
      if (!inQuote && ch === "[") {
        const slice = line.slice(i);
        if (/^\[\s*[A-Za-z]+:/.test(slice)) {
          const close = line.indexOf("]", i + 1);
          if (close >= 0) { i = close + 1; continue; }
        }
      }
      if (ch === "\"") { inQuote = !inQuote; i += 1; continue; }
      if (!inQuote) {
        const token = matchBarToken(line, i);
        if (token) {
          sig.push(token.token);
          i += token.len;
          continue;
        }
      }
      i += 1;
    }
  }
  return sig;
}

function computeExpectedBarSignatureFromInfo(info) {
  const sig = [];
  if (!info || !Array.isArray(info.bars)) return sig;
  const bars = info.bars;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (bar && bar.startToken) sig.push(String(bar.startToken));
    sig.push((bar && bar.endToken) ? String(bar.endToken) : "|");
  }
  return sig;
}

function diffSignatures(expected, actual) {
  const clean = (arr) => (Array.isArray(arr) ? arr.filter((t) => t != null) : []);
  const a = clean(expected);
  const b = clean(actual);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 6);
      const to = Math.min(len, i + 7);
      return {
        ok: false,
        index: i,
        expectedToken: a[i] ?? null,
        actualToken: b[i] ?? null,
        expectedLen: a.length,
        actualLen: b.length,
        expectedSlice: a.slice(from, to),
        actualSlice: b.slice(from, to),
      };
    }
  }
  return { ok: true, expectedLen: a.length, actualLen: b.length };
}

function getPlaybackPayload() {
  if (chordProFeature.isEnabled() && chordProFeature.isFullView()) {
    return { text: "", offset: 0, lineOffset: 0, empty: true };
  }
  if (chordProFeature.isEnabled() && !chordProFeature.hasBlocks()) {
    return { text: "", offset: 0, lineOffset: 0, empty: true };
  }
  const tuneText = getEditorValue();
  const lineOffsetBase = chordProFeature.isEnabled() ? 0 : null;
  const scopedOptions = selectionPlaybackRuntime.getScopedOptions();
  const skipDrums = selectionPlaybackRuntime.getSkipDrumsOnce() || (scopedOptions ? !Boolean(scopedOptions.allowMidiDrums) : false);
  const skipGchords = playbackSkipGchordsOnce === true || (scopedOptions ? Boolean(scopedOptions.muteGchords) : false);
  const ignoreRepeats = playbackIgnoreRepeatsOnce === true;
  if (isPayloadMode()) {
    if (payloadModeFeature.isPlaybackView()) {
      // In payload mode the editor already contains the full payload text,
      // so playback indices should map 1:1 to editor offsets.
      return { text: String(tuneText || ""), offset: 0 };
    }
    // Render view is also a full payload in the editor; keep offset at 0 for follow mapping.
    const offset = 0;
    const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
    const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
    const sourceKey = `payload|||${String(tuneText || "")}|||${offset}|||${repeatsFlag}`;
    if (lastPlaybackPayloadCache && lastPlaybackPayloadCache.key === sourceKey) {
      lastPlaybackMeta = lastPlaybackPayloadCache.meta
        || { drumInsertAtLine: null, drumLineCount: 0 };
      return {
        text: lastPlaybackPayloadCache.text,
        offset: lastPlaybackPayloadCache.offset,
      };
    }

    playbackSanitizeWarnings = [];
    let payload = { text: String(tuneText || ""), offset };
    payload = { text: normalizeDollarLineBreaksForPlayback(payload.text), offset: payload.offset };
    payload = { text: normalizeBlankLinesForPlayback(payload.text), offset: payload.offset };
    let workingText = payload.text;
    if (ignoreRepeats) workingText = stripRepeatsLengthSafe(workingText);
    const sanitized = sanitizeAbcForPlayback(workingText);
    playbackSanitizeWarnings = Array.isArray(sanitized.warnings) ? sanitized.warnings.slice(0, 200) : [];
    payload = { text: sanitized.text, offset: payload.offset };
    if (expandRepeats) {
      payload = { text: expandRepeatsForPlayback(payload.text), offset: payload.offset };
    }

    lastPlaybackMeta = { drumInsertAtLine: null, drumLineCount: 0 };
    lastPlaybackPayloadCache = {
      key: sourceKey,
      text: payload.text,
      offset: payload.offset,
      meta: lastPlaybackMeta,
    };
    lastPreparedPlaybackKey = sourceKey;
    assertCleanAbcText(payload.text, "playback payload");
    return payload;
  }
  if (selectionPlaybackRuntime.isSelectionMode()) {
    const entry = chordProFeature.isEnabled() ? null : getActiveFileEntry();
    const prefixPayload = buildHeaderPrefix(entry ? getHeaderEditorValue() : "", false, tuneText);
    const text = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
    const lineOffset = chordProFeature.isEnabled() ? countLinesForPrefix(prefixPayload.text) + (lineOffsetBase || 0) : null;
    lastPlaybackMeta = { drumInsertAtLine: null, drumLineCount: 0 };
    lastPreparedPlaybackKey = null;
    return { text, offset: (prefixPayload.offset || 0), lineOffset };
  }
  const entry = chordProFeature.isEnabled() ? null : getActiveFileEntry();
  const prefixPayload = buildHeaderPrefix(entry ? getHeaderEditorValue() : "", false, tuneText);
  const baseText = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
  const gchordPreview = skipGchords ? { changed: false, text: baseText } : injectGchordOn(baseText, prefixPayload.offset || 0);
  const gchordPreviewText = (gchordPreview && gchordPreview.changed) ? gchordPreview.text : baseText;
  const nativeDrums = shouldUseNativeMidiDrums();
  const drumPreview = (nativeDrums || skipDrums) ? { text: gchordPreviewText, changed: false } : injectDrumPlayback(gchordPreviewText);
  const previewText = normalizeBlankLinesForPlayback(
    normalizeDollarLineBreaksForPlayback(drumPreview && drumPreview.changed ? drumPreview.text : gchordPreviewText)
  );
  const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
  const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
  const drumsFlag = nativeDrums ? "drums:native" : "drums:inject";
  const skipDrumsFlag = skipDrums ? "skipdrums:on" : "skipdrums:off";
  const gchordFlag = skipGchords ? "gchords:off" : "gchords:on";
  const ignoreFlag = ignoreRepeats ? "ignore:on" : "ignore:off";
  const sourceKey = `${previewText}|||${prefixPayload.offset || 0}|||${repeatsFlag}|||${drumsFlag}|||${skipDrumsFlag}|||${gchordFlag}|||${ignoreFlag}`;
  if (lastPlaybackPayloadCache && lastPlaybackPayloadCache.key === sourceKey) {
    lastPlaybackMeta = lastPlaybackPayloadCache.meta
      || { drumInsertAtLine: null, drumLineCount: 0 };
    const lineOffset = chordProFeature.isEnabled() ? countLinesForPrefix(prefixPayload.text) + (lineOffsetBase || 0) : null;
    return {
      text: lastPlaybackPayloadCache.text,
      offset: lastPlaybackPayloadCache.offset,
      lineOffset,
    };
  }
  let payload = prefixPayload.text
    ? { text: `${prefixPayload.text}${tuneText}`, offset: (prefixPayload.offset || 0) }
    : { text: tuneText, offset: prefixPayload.offset || 0 };
  const gchordInjected = injectGchordOn(payload.text, prefixPayload.offset || 0);
  if (gchordInjected.changed) {
    payload = {
      text: gchordInjected.text,
      offset: (payload.offset || 0) + (gchordInjected.offsetDelta || 0),
    };
  }
  payload = { text: normalizeDollarLineBreaksForPlayback(payload.text), offset: payload.offset };
  payload = { text: normalizeBlankLinesForPlayback(payload.text), offset: payload.offset };
  const sanitized = sanitizeAbcForPlayback(payload.text);
  playbackSanitizeWarnings = Array.isArray(sanitized.warnings) ? sanitized.warnings.slice(0, 200) : [];
  payload = { text: sanitized.text, offset: payload.offset };

  lastPlaybackKeyOrderWarning = null;
  const keyOrderWarn = detectKeyFieldNotLastBeforeBody(payload.text);
  if (keyOrderWarn) {
    lastPlaybackKeyOrderWarning = keyOrderWarn;
    playbackSanitizeWarnings.push(keyOrderWarn);
  }

  lastPlaybackMeterMismatchWarning = null;
  lastPlaybackRepeatShortBarWarning = null;
  const meterWarn = detectMeterMismatchInBarlines(payload.text);
  if (meterWarn) {
    lastPlaybackMeterMismatchWarning = meterWarn;
    playbackSanitizeWarnings.push(meterWarn);
    if (lastMeterMismatchToastKey !== sourceKey) {
      showToast(`Meter mismatch: ${meterWarn.detail}`, 5200);
      lastMeterMismatchToastKey = sourceKey;
    }
  }
  const repeatShortBarWarn = detectRepeatMarkerAfterShortBar(payload.text);
  if (repeatShortBarWarn) {
    lastPlaybackRepeatShortBarWarning = repeatShortBarWarn;
    playbackSanitizeWarnings.push(repeatShortBarWarn);
    if (lastRepeatShortBarToastKey !== sourceKey) {
      showToast(`Repeat may be wrong: ${repeatShortBarWarn.detail}`, 5600);
      lastRepeatShortBarToastKey = sourceKey;
    }
  }

  const drumInjected = (nativeDrums || skipDrums)
    ? { text: payload.text, changed: false, insertAtLine: null, lineCount: 0 }
    : injectDrumPlayback(payload.text);
  if (drumInjected && drumInjected.signatureDiff) {
    lastDrumSignatureDiff = drumInjected.signatureDiff;
    playbackSanitizeWarnings.push({ kind: "drum-signature-mismatch", detail: drumInjected.signatureDiff });
  } else {
    lastDrumSignatureDiff = null;
  }
  if (drumInjected && drumInjected.changed) payload = { text: drumInjected.text, offset: payload.offset };
  if (skipGchords) payload = { text: stripGchordDirectives(payload.text), offset: payload.offset };
  lastPlaybackMeta = drumInjected.changed
    ? { drumInsertAtLine: drumInjected.insertAtLine, drumLineCount: drumInjected.lineCount }
    : { drumInsertAtLine: null, drumLineCount: 0 };
  if (skipDrums) {
    payload = { text: neutralizeMidiDrumDirectivesForPlayback(payload.text), offset: payload.offset };
  }
  if (ignoreRepeats) {
    payload = { text: stripRepeatsLengthSafe(payload.text), offset: payload.offset };
  }
  if (expandRepeats) {
    payload = {
      text: expandRepeatsForPlayback(payload.text),
      offset: payload.offset,
    };
  }
  lastPlaybackPayloadCache = {
    key: sourceKey,
    text: payload.text,
    offset: payload.offset,
    meta: lastPlaybackMeta,
  };
  lastPreparedPlaybackKey = sourceKey;
  assertCleanAbcText(payload.text, "playback payload");
  const lineOffset = chordProFeature.isEnabled() ? countLinesForPrefix(prefixPayload.text) + (lineOffsetBase || 0) : null;
  return { ...payload, lineOffset };
}

function getRenderPayload() {
  if (isPayloadMode()) {
    const text = getEditorValue();
    const offset = computePayloadTuneOffset(text);
    const out = { text, offset };
    assertCleanAbcText(out.text, "render payload");
    return out;
  }
  if (chordProFeature.isEnabled()) {
    if (chordProFeature.isFullView()) return { text: "", offset: 0, lineOffset: 0, empty: true };
    const tuneText = getEditorValue();
    const prefixPayload = buildHeaderPrefix("", true, tuneText);
    const text = prefixPayload.text ? `${prefixPayload.text}${tuneText}` : tuneText;
    const lineOffset = countLinesForPrefix(prefixPayload.text);
    const out = { text, offset: prefixPayload.offset || 0, lineOffset };
    assertCleanAbcText(out.text, "render payload");
    return out;
  }
  const tuneText = getEditorValue();
  const entry = getActiveFileEntry();
  const headerTextRaw = entry ? getHeaderEditorValue() : "";
  const headerText = sanitizeFileHeaderForInteractiveRender(headerTextRaw);
  const prefixPayload = buildHeaderPrefix(headerText, true, tuneText);
  if (!prefixPayload.text) return { text: tuneText, offset: 0 };
  const out = { text: `${prefixPayload.text}${tuneText}`, offset: prefixPayload.offset };
  assertCleanAbcText(out.text, "render payload");
  return out;
}

async function preparePlayback() {
  clearErrors();
  if (chordProFeature.isEnabled() && chordProFeature.isFullView()) {
    showToast("Exit Raw to play ChordPro ABC.", 2400);
    return;
  }
  await ensureSoundfontReady();
  const p = ensurePlayer();
  if (player && typeof player.stop === "function") {
    suppressOnEnd = true;
    player.stop();
  }
  if (typeof p.clear === "function") p.clear();
  playbackNeedsReprepare = false;

  try { sessionStorage.setItem("audio", "sf2"); } catch {}

  const AbcCtor = getAbcCtor();
  playbackParseErrors = [];
  playbackSanitizeWarnings = [];
  lastPlaybackChordOnBarError = false;
  let playbackParseErrorToastShown = false;
  lastPlaybackTuneInfo = null;
  const logPlaybackErr = (message, line, col) => {
    let loc = null;
    if (Number.isFinite(line) && Number.isFinite(col)) {
      loc = { line: line + 1, col: col + 1 };
    } else {
      loc = parseErrorLocation(message);
    }
    const drumStart = (lastPlaybackMeta && Number.isFinite(lastPlaybackMeta.drumInsertAtLine))
      ? lastPlaybackMeta.drumInsertAtLine
      : null;
    const drumLines = (lastPlaybackMeta && Number.isFinite(lastPlaybackMeta.drumLineCount))
      ? lastPlaybackMeta.drumLineCount
      : 0;
    const inDrumBlock = loc
      && drumStart
      && drumLines > 0
      && loc.line >= drumStart
      && loc.line < (drumStart + drumLines);
    const entry = {
      message: String(message || ""),
      loc,
      inDrumBlock: Boolean(inDrumBlock),
    };
    playbackParseErrors.push(entry);
    if (playbackParseErrors.length > 200) playbackParseErrors = playbackParseErrors.slice(-200);
    if (isMidiDrumMustBeInVoicePlaybackError(entry.message)) {
      playbackSanitizeWarnings.push({ kind: "playback-midi-drums-before-voice", message: entry.message });
      return;
    }
    if (!playbackParseErrorToastShown) {
      playbackParseErrorToastShown = true;
      scheduleAutoDump("playback-parse-error", entry && entry.message ? entry.message : String(message || ""));
      if (window.__abcarusDebugPlayback || window.__abcarusDebugDrums) {
        showToast("Playback parse error (see debug dump).", 3200);
      }
    }
    if (/Not enough measure bars for lyric line/i.test(entry.message)) {
      // We'll attempt a playback-only fallback that ignores lyrics, so don't spam errors.
      return;
    }
    if (inDrumBlock) {
      const cleaned = String(message || "").replace(/^\s*play:\d+:\d+\s*/i, "").trim();
      logErr(cleaned || message, null, { skipMeasureRange: true });
      return;
    }
    logErr(message, loc, { skipMeasureRange: true });
  };
  const user = {
    img_out: () => {},
    err: (m) => logPlaybackErr(m),
    errmsg: (m, line, col) => logPlaybackErr(m, line, col),
    abcplay: p,
  };
  const abc = new AbcCtor(user);
  // Determinism first: always rebuild playback payload for each Play.
  // This avoids stale Follow/playback mappings after tune switches or heavy edits.
  lastPlaybackPayloadCache = null;
  const playbackPayload = getPlaybackPayload();
  if (!playbackPayload || playbackPayload.empty || !String(playbackPayload.text || "").trim()) {
    setStatus("Ready");
    showToast("No ABC block to play.", 2200);
    return;
  }
  const fxInjected = injectPlaybackMidiFxControls(playbackPayload.text, playbackPayload.offset || 0);
  const playbackPayloadText = fxInjected.text;
  const playbackPayloadOffset = fxInjected.offset;
  const selectionMode = selectionPlaybackRuntime.isSelectionMode();
  const nativeMidiDrums = shouldUseNativeMidiDrums();
  lastPlaybackHasParts = /\nP\s*:/.test(`\n${playbackPayloadText || ""}`) || /\[\s*P\s*:/i.test(playbackPayloadText || "");
  if (Array.isArray(playbackSanitizeWarnings) && playbackSanitizeWarnings.length) {
    showToast("Playback may vary (ABC sanitized for stability).", 3600);
  }
  if (!assertCleanAbcText(playbackPayloadText, "preparePlayback")) {
    throw new Error("ABC text corruption detected (playback).");
  }
  if (window.__abcarusDebugDrums) {
    const lines = String(playbackPayloadText || "").split(/\r\n|\n|\r/);
    const drumLines = lines.filter((line) => /DRUM|drum|drummap|MIDI channel/i.test(line));
    const tail = lines.slice(-60);
    console.log("[abcarus] playback payload (drum lines):\n" + drumLines.join("\n"));
    console.log("[abcarus] playback payload (tail):\n" + tail.join("\n"));
  }
  if (window.__abcarusDebugPlayback) {
    const lines = String(playbackPayloadText || "").split(/\r\n|\n|\r/);
    console.log("[abcarus] playback payload (head):\n" + lines.slice(0, 40).join("\n"));
  }
  playbackIndexOffset = playbackPayloadOffset || 0;
  if (Number.isFinite(playbackPayload.lineOffset)) {
    errorLineOffset = playbackPayload.lineOffset;
  } else {
    setErrorLineOffsetFromHeader(playbackPayloadText.slice(0, playbackIndexOffset));
  }
  if (lastPlaybackMeterMismatchWarning && lastPlaybackMeterMismatchWarning.detail) {
    addError(
      `Warning: Meter mismatch: ${lastPlaybackMeterMismatchWarning.detail}`,
      lastPlaybackMeterMismatchWarning.loc || null,
      { skipMeasureRange: true }
    );
  }
  if (lastPlaybackRepeatShortBarWarning && lastPlaybackRepeatShortBarWarning.detail) {
    addError(
      `Warning: ${lastPlaybackRepeatShortBarWarning.detail}`,
      lastPlaybackRepeatShortBarWarning.loc || null,
      { skipMeasureRange: true }
    );
  }
  let playbackText = normalizeHeaderNoneSpacing(playbackPayloadText);
  const scopedOptions = selectionPlaybackRuntime.getScopedOptions();
  if (scopedOptions) {
    if (!scopedOptions.allowMidiDrums) {
      playbackText = neutralizeMidiDrumDirectivesForPlayback(playbackText);
    }
    if (scopedOptions.muteGchords) playbackText = stripChordSymbolsForPlayback(playbackText);
    if (scopedOptions.suppressRepeats) playbackText = stripRepeatsLengthSafe(playbackText);
    let effectiveMuted = null;
    const mutedVoiceMap = selectionPlaybackRuntime.getAbMutedVoiceMap();
    if (mutedVoiceMap && Object.values(mutedVoiceMap).some(Boolean)) {
      effectiveMuted = mutedVoiceMap;
    } else if (Array.isArray(scopedOptions.mutedVoices) && scopedOptions.mutedVoices.length) {
      effectiveMuted = scopedOptions.mutedVoices.reduce((acc, id) => {
        acc[String(id)] = true;
        return acc;
      }, {});
    }
    // Voice muting is applied after parse on tune symbols to keep istart mapping stable.
    if (effectiveMuted && Object.values(effectiveMuted).some(Boolean) && /\[V\s*:/i.test(playbackText)) {
      showToast("Voice muting for inline [V:] switches is best-effort.", 2800);
    }
  }
  if (/[\\^_]3\/4/.test(playbackText)) {
    playbackSanitizeWarnings.push({ kind: "playback-acc-3_4-normalized" });
    playbackText = normalizeAccThreeQuarterToneForAbc2svg(playbackText);
    showToast("Playback: 3/4-tone accidentals normalized (compat mode).", 3600);
  }
  if (nativeMidiDrums && !scopedOptions && window.__abcarusPlaybackRelocateMidiDrums === true) {
    const relocated = relocateMidiDrumDirectivesIntoBody(playbackText);
    if (relocated && relocated.moved > 0) {
      playbackText = relocated.text;
      playbackSanitizeWarnings.push({ kind: "playback-midi-drums-moved-after-k", moved: relocated.moved });
      if (window.__abcarusDebugPlayback) {
        showToast("Playback: moved %%MIDI drum* after K: (experimental).", 3200);
      }
    }
  }
  abc.tosvg("play", playbackText);


  // abc2svg requires %%MIDI drum/drumon/drumbars to be inside a voice; many real-world files place them in headers.
  // Neutralize (comment out) these directives for tolerant playback while preserving istart mapping.
  if (hasMidiDrumMustBeInVoicePlaybackError(playbackParseErrors)) {
    playbackSanitizeWarnings.push({ kind: "playback-midi-drums-neutralized" });
    const abc2 = new AbcCtor(user);
    playbackParseErrors = [];
    if (nativeMidiDrums && !scopedOptions) {
      // Experimental native path failed; fall back to our V:DRUM injection so drums still play after neutralization.
      const injected = injectDrumPlayback(playbackText);
      if (injected && injected.changed) {
        playbackText = injected.text;
        playbackSanitizeWarnings.push({ kind: "playback-native-midi-drums-fallback-to-inject" });
        lastPlaybackMeta = { drumInsertAtLine: injected.insertAtLine, drumLineCount: injected.lineCount };
      }
    }
    playbackText = neutralizeMidiDrumDirectivesForPlayback(playbackText);
    abc2.tosvg("play", playbackText);
    abc.tunes = abc2.tunes;
    // Keep this low-noise: it's informational and can be common in real-world files.
    // Record it for dumps; only show it in UI when debugging playback.
    if (window.__abcarusDebugPlayback || window.__abcarusDebugDrums) {
      addError(
        "Warning: Playback ignored global %%MIDI drum* directives (must be inside a voice).",
        null,
        { skipMeasureRange: true }
      );
    }
    const toastKey = getPlaybackSourceKey();
    if (window.__abcarusDebugPlayback && toastKey && toastKey !== lastMidiDrumCompatToastKey) {
      lastMidiDrumCompatToastKey = toastKey;
      showToast("Playback: global %%MIDI drum* ignored (compat).", 2600);
    }
  }

  // Tolerant playback mode: many real-world ABC files contain lyric/barline mismatches that stricter engines reject.
  // We keep the file unchanged; this only affects playback.
  if (!selectionMode && Array.isArray(playbackParseErrors) && playbackParseErrors.some((e) => /lyric line/i.test(e.message || ""))) {
    playbackSanitizeWarnings.push({ kind: "playback-lyrics-dropped" });
    const abc2 = new AbcCtor(user);
    const stripped = stripLyricsForPlayback(playbackText);
    abc2.tosvg("play", stripped);
    abc.tunes = abc2.tunes;
    showToast("Playback: lyrics ignored (compat mode).", 3600);
  }
  if (Array.isArray(playbackParseErrors) && playbackParseErrors.some((e) => /Different bars/i.test(e.message || ""))) {
    playbackSanitizeWarnings.push({ kind: "playback-bars-normalized" });
    const abc3 = new AbcCtor(user);
    const normalized = normalizeBarsForPlayback(playbackText);
    abc3.tosvg("play", normalized);
    abc.tunes = abc3.tunes;
    showToast("Playback: barlines normalized (compat mode).", 3600);
  }

  // Hard guard for injected drums: if bar mismatch is reported inside V:DRUM, do not play that
  // generated drum voice for this run. A partial/misaligned drum tail is worse than silent drums.
  if (hasDrumBarMismatchParseError(playbackParseErrors)) {
    playbackSanitizeWarnings.push({ kind: "playback-drums-disabled-on-bar-mismatch" });
    const abcNoDrums = new AbcCtor(user);
    const noDrumsText = neutralizeMidiDrumDirectivesForPlayback(
      neutralizeInjectedDrumVoiceForPlayback(playbackText)
    );
    playbackParseErrors = [];
    abcNoDrums.tosvg("play", noDrumsText);
    abc.tunes = abcNoDrums.tunes;
    showToast("Playback: drums disabled (bar mismatch in generated DRUM voice).", 3800);
  }

  // abc2svg playback is stricter than many MIDI engines (e.g. abcmidi) and rejects chord symbols placed on barlines.
  // We don't auto-strip by default (it changes accompaniment); instead we warn and provide an opt-in toggle.
  if (Array.isArray(playbackParseErrors) && playbackParseErrors.some((e) => /chord symbols on measure bars/i.test(e.message || ""))) {
    lastPlaybackChordOnBarError = true;
    playbackSanitizeWarnings.push({ kind: "abc2svg-chord-on-measure-bar" });
    if (window.__abcarusPlaybackStripChordSymbols === true) {
      playbackParseErrors = [];
      playbackSanitizeWarnings.push({ kind: "playback-chords-stripped" });
      const abc2 = new AbcCtor(user);
      const stripped = stripChordSymbolsForPlayback(playbackText);
      abc2.tosvg("play", stripped);
      // Replace parsed result.
      abc.tunes = abc2.tunes;
      showToast("Playback: chord symbols ignored (compat mode).", 3600);
    } else {
      showToast("Playback may vary (chord symbols on barlines).", 3600);
    }
  }

  let tunes = abc.tunes || [];
  if (!tunes.length && (playbackIgnoreRepeatsOnce || selectionPlaybackRuntime.getSkipDrumsOnce() || playbackSkipGchordsOnce)) {
    const attemptFallbackParse = (label, override) => {
      const prevIgnore = playbackIgnoreRepeatsOnce;
      const prevSkipDrums = selectionPlaybackRuntime.getSkipDrumsOnce();
      const prevSkipGchords = playbackSkipGchordsOnce;
      try {
        if (override && Object.prototype.hasOwnProperty.call(override, "ignoreRepeats")) {
          playbackIgnoreRepeatsOnce = !!override.ignoreRepeats;
        }
        if (override && Object.prototype.hasOwnProperty.call(override, "skipDrums")) {
          selectionPlaybackRuntime.setSkipDrumsOnce(override.skipDrums);
        }
        if (override && Object.prototype.hasOwnProperty.call(override, "skipGchords")) {
          playbackSkipGchordsOnce = !!override.skipGchords;
        }
        const retryPayload = getPlaybackPayload();
        playbackIndexOffset = retryPayload.offset || 0;
        if (Number.isFinite(retryPayload.lineOffset)) {
          errorLineOffset = retryPayload.lineOffset;
        } else {
          setErrorLineOffsetFromHeader(retryPayload.text.slice(0, playbackIndexOffset));
        }
        let retryText = normalizeHeaderNoneSpacing(retryPayload.text);
        if (/[\\^_]3\/4/.test(retryText)) {
          playbackSanitizeWarnings.push({ kind: "playback-acc-3_4-normalized" });
          retryText = normalizeAccThreeQuarterToneForAbc2svg(retryText);
        }
        if (nativeMidiDrums) {
          const relocated = relocateMidiDrumDirectivesIntoBody(retryText);
          if (relocated && relocated.moved > 0) retryText = relocated.text;
        }
        const abcRetry = new AbcCtor(user);
        playbackParseErrors = [];
        abcRetry.tosvg("play", retryText);
        if (abcRetry.tunes && abcRetry.tunes.length) {
          abc.tunes = abcRetry.tunes;
          tunes = abcRetry.tunes;
          playbackSanitizeWarnings.push({ kind: "playback-selection-fallback", detail: label });
          showToast(label, 2600);
          return true;
        }
      } finally {
        playbackIgnoreRepeatsOnce = prevIgnore;
        selectionPlaybackRuntime.setSkipDrumsOnce(prevSkipDrums);
        playbackSkipGchordsOnce = prevSkipGchords;
      }
      return false;
    };

    // First: allow repeats if the ignore-repeats pass produced no tunes.
    if (playbackIgnoreRepeatsOnce) {
      if (attemptFallbackParse("Selection playback: repeats enabled (fallback).", { ignoreRepeats: false })) {
        // ok
      }
    }
    // Second: allow drums/gchords if still no tunes.
    if (!tunes.length && (selectionPlaybackRuntime.getSkipDrumsOnce() || playbackSkipGchordsOnce)) {
      attemptFallbackParse("Selection playback: drums/gchords enabled (fallback).", { skipDrums: false, skipGchords: false });
    }
  }

  tunes = abc.tunes || [];
  if (!tunes.length) throw new Error("No tunes parsed; cannot play.");

  // Apply muted voices on parsed symbols (offset-stable, parse-safe).
  if (scopedOptions && Array.isArray(scopedOptions.mutedVoices) && scopedOptions.mutedVoices.length) {
    const root = tunes[0] && tunes[0][0] ? tunes[0][0] : null;
    const firstVoiceId = getFirstPlayableVoiceIdFromTuneRoot(root);
    const effectiveMutedIds = resolveEffectiveMutedVoiceIds(scopedOptions.mutedVoices, firstVoiceId);
    if (effectiveMutedIds.length) {
      let anyMuted = false;
      for (const t of tunes) {
        const first = t && t[0] ? t[0] : null;
        if (applyMutedVoicesToTuneRoot(first, effectiveMutedIds)) anyMuted = true;
      }
      if (!anyMuted) {
        playbackSanitizeWarnings.push({ kind: "playback-muted-voices-no-match", voices: effectiveMutedIds.slice(0, 12) });
      }
    }
  }

  try {
    lastPlaybackTuneInfo = {
      count: tunes.length,
      titles: tunes.map((t) => {
        const info = t && t[0] ? t[0].info : null;
        const title = info && info.T ? info.T : null;
        const x = info && info.X ? info.X : null;
        return { x, title };
      }).slice(0, 20),
    };
  } catch {
    lastPlaybackTuneInfo = { count: tunes.length };
  }

  for (const t of tunes) {
    p.add(t[0], t[1], t[3]);
  }

  playbackState = buildPlaybackState(tunes[0][0]);
  playbackNoteTrace = [];
  window.__abcarusPlaybackDebug = {
    getState: () => ({
      preparedKey: lastPreparedPlaybackKey,
      playbackIndexOffset,
      startIstart: playbackState && playbackState.startSymbol ? playbackState.startSymbol.istart : null,
      measures: playbackState ? playbackState.measures.length : 0,
      symbols: playbackState ? playbackState.symbols.length : 0,
      bars: playbackState && playbackState.barIstarts ? playbackState.barIstarts.length : 0,
      preferredVoiceId: playbackState ? (playbackState.preferredVoiceId || null) : null,
      preferredVoiceIndex: playbackState && Number.isFinite(playbackState.preferredVoiceIndex) ? playbackState.preferredVoiceIndex : null,
      voiceStats: playbackState && Array.isArray(playbackState.voiceStats) ? playbackState.voiceStats.slice() : [],
      tunes: lastPlaybackTuneInfo,
      symbolsHead: playbackState
        ? playbackState.symbols.slice(0, 30).map((item) => {
          const sym = item && item.symbol ? item.symbol : null;
          const pv = sym && sym.p_v ? sym.p_v : null;
          return {
            istart: sym && Number.isFinite(sym.istart) ? sym.istart : null,
            time: sym && Number.isFinite(sym.time) ? sym.time : null,
            dur: sym && Number.isFinite(sym.dur) ? sym.dur : null,
            type: sym && Number.isFinite(sym.type) ? sym.type : null,
            voiceId: pv && pv.id != null ? String(pv.id) : null,
            voiceIndex: pv && Number.isFinite(pv.v) ? pv.v : null,
          };
        })
        : [],
    }),
    getDiagnostics: () => ({
      parseErrors: Array.isArray(playbackParseErrors) ? playbackParseErrors.slice() : [],
      sanitizeWarnings: Array.isArray(playbackSanitizeWarnings) ? playbackSanitizeWarnings.slice() : [],
      drumSignatureDiff: lastDrumSignatureDiff,
      chordOnBarError: Boolean(lastPlaybackChordOnBarError),
    }),
    getPlaybackRange: () => clonePlaybackRange(playbackRange),
    getTimeline: () => (playbackState ? playbackState.timeline : []),
    getTrace: () => playbackNoteTrace.slice(),
    clearTrace: () => { playbackNoteTrace = []; },
  };
  if (window.__abcarusDebugPlayback) {
    const symPreview = playbackState.symbols.slice(0, 10).map((item) => {
      const sym = item.symbol || {};
      return {
        istart: sym.istart,
        time: sym.time,
        bar_type: sym.bar_type,
        type: sym.type || sym.sym || sym.name,
      };
    });
    const measPreview = playbackState.measures.slice(0, 6).map((item) => item.istart);
    console.log("[abcarus] playback symbols head:", symPreview);
    console.log("[abcarus] playback measures head:", measPreview);
    console.log("[abcarus] playback start:", playbackState.startSymbol && playbackState.startSymbol.istart);
  }
  setFollowVoiceFromPlayback();
  return p;
}

function startPlaybackFromPrepared(startIdx) {
  if (!playbackStartArmed) {
    stopPlaybackFromGuard("Playback start invoked outside startPlaybackFromRange().");
    return;
  }
  const startSymbol = findSymbolAtOrAfter(startIdx);
  if (!startSymbol) throw new Error("Playback start not found.");

  let start = startSymbol;
  if (playbackState && playbackState.symbols.length) {
    const isPlayable = (symbol) => !!(symbol && Number.isFinite(symbol.dur) && symbol.dur > 0);
    if (!isPlayable(start)) {
      const fallback = playbackState.symbols.find((item) =>
        item.symbol && Number.isFinite(item.symbol.istart) && item.symbol.istart >= start.istart && isPlayable(item.symbol)
      );
      if (fallback) start = fallback.symbol;
    }
  }

  // Guard: an end boundary that points at/before the first playable symbol can cause immediate termination (no sound).
  let endSym = activePlaybackEndSymbol || null;
  if (endSym && Number.isFinite(endSym.istart) && Number.isFinite(start.istart) && endSym.istart <= start.istart) {
    endSym = null;
  }

  lastStartPlaybackIdx = Number.isFinite(start.istart) ? start.istart : 0;
  lastPlaybackIdx = null;
  lastRenderIdx = null;
  resumeStartIdx = null;
  suppressOnEnd = true;

  if (window.__abcarusDebugParts === true) {
    try {
      const getPartLetterAtSymbol = (sym) => {
        let s = sym;
        let guard = 0;
        while (s && guard < 200000) {
          if (s.part && s.part.text) return String(s.part.text || "")[0] || "?";
          s = s.ts_prev;
          guard += 1;
        }
        return "?";
      };
      const computePartIndexLikeSnd = (sym) => {
        let s = sym;
        let guard = 0;
        while (s && guard < 200000) {
          if (s.parts) return { i_p: -1, hit: "parts", at: Number.isFinite(s.istart) ? s.istart : null };
          const s_p = s.part1;
          const p_s = s_p && Array.isArray(s_p.p_s) ? s_p.p_s : null;
          if (p_s) {
            for (let i = 0; i < p_s.length; i += 1) {
              if (p_s[i] === s) return { i_p: i, hit: "p_s", at: Number.isFinite(s.istart) ? s.istart : null };
            }
          }
          s = s.ts_prev;
          guard += 1;
        }
        return { i_p: undefined, hit: null, at: null };
      };
      const idxInfo = computePartIndexLikeSnd(start);
      let partsSeq = null;
      try {
        let s = start;
        let guard = 0;
        while (s && guard < 200000) {
          if (typeof s.parts === "string" && s.parts) { partsSeq = s.parts; break; }
          s = s.ts_prev;
          guard += 1;
        }
      } catch {}
      console.log("[abcarus] playback start (parts)", {
        startIstart: start.istart,
        startEditorOffset: Number.isFinite(start.istart) ? (start.istart - (playbackIndexOffset || 0)) : null,
        partAtStart: getPartLetterAtSymbol(start),
        i_p: idxInfo.i_p,
        i_p_hit: idxInfo.hit,
        i_p_at: idxInfo.at,
        partsSeq,
      });
    } catch {}
  }

  let engineStart = start;
  const rangeForStart = activePlaybackRange || playbackRange;
  const startsAtTuneHead = playbackState
    && playbackState.startSymbol
    && start === playbackState.startSymbol;
  const isFullPartOrderStart = rangeForStart
    && (
      Number(rangeForStart.startOffset) === 0
      || (
        startsAtTuneHead
        && (rangeForStart.origin === "cursor" || rangeForStart.origin === "transport")
      )
    );
  if (
    isFullPartOrderStart
    && playbackState
    && playbackState.rootSymbol
  ) {
    let hasPartsOrder = false;
    for (let probe = start, guard = 0; probe && guard < 200000; probe = probe.ts_prev, guard += 1) {
      if (probe.parts || (probe.part1 && Array.isArray(probe.part1.p_s))) {
        hasPartsOrder = true;
        break;
      }
    }
    if (hasPartsOrder) engineStart = playbackState.rootSymbol;
  }

  player.play(engineStart, endSym, 0);
  isPlaying = true;
  isPaused = false;
  pausedSelectionSignature = null;
  if (!waitingForFirstNote) setStatus("Playing…");
  updatePlayButton();
  setTimeout(() => {
    suppressOnEnd = false;
  }, 0);
}

function resolvePlaybackEndSymbol(range, startSymbol) {
  if (!range || range.endOffset == null) return null;
  if (!startSymbol || !Number.isFinite(startSymbol.istart)) return null;
  const endOffset = Number(range.endOffset);
  if (!Number.isFinite(endOffset)) return null;
  const endAbcOffset = endOffset + playbackIndexOffset;
  if (!Number.isFinite(endAbcOffset) || endAbcOffset <= startSymbol.istart) return null;

  // Keep end boundary exclusive:
  // - include every symbol whose istart is strictly before endAbcOffset
  // - stop at the first symbol after that in time linkage (`lastInRange.ts_next`)
  // This is robust for repeats/voltas because abc2svg evaluates repeat bars only when they are visited.
  const lastInRange = findSymbolAtOrBefore(endAbcOffset - 1);
  if (!lastInRange || !Number.isFinite(lastInRange.istart)) return null;
  if (lastInRange.istart <= startSymbol.istart) return null;
  return lastInRange.ts_next || null;
}

function findBoundaryAtOrAfter(sorted, target) {
  if (!Array.isArray(sorted) || !sorted.length) return null;
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid];
    if (v >= t) {
      best = v;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return best;
}

function findBoundaryAtOrBefore(sorted, target) {
  if (!Array.isArray(sorted) || !sorted.length) return null;
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid];
    if (v <= t) {
      best = v;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function findBarStartContaining(sortedMeasureIstarts, target) {
  if (!Array.isArray(sortedMeasureIstarts) || !sortedMeasureIstarts.length) return null;
  const t = Number(target);
  if (!Number.isFinite(t)) return null;
  let lo = 0;
  let hi = sortedMeasureIstarts.length - 1;
  let best = sortedMeasureIstarts[0];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sortedMeasureIstarts[mid];
    if (v <= t) {
      best = v;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

async function startPlaybackFromRange(rangeOverride) {
  if (!editorView) return;
  const startToken = (playbackStartToken += 1);
  const abortStart = (message) => {
    if (startToken !== playbackStartToken) return;
    lastPlaybackAbortMessage = String(message || "");
    try { recordDebugLog("warn", [`Playback abort: ${lastPlaybackAbortMessage}`]); } catch {}
    try { scheduleAutoDump("playback-abort", lastPlaybackAbortMessage); } catch {}
    waitingForFirstNote = false;
    isPlaying = false;
    isPaused = false;
    setStatus("OK");
    updatePlayButton();
    clearNoteSelection();
    resetPlaybackUiState();
    setSoundfontCaption();
    if (message) showToast(message, 2600);
  };
  let range = clonePlaybackRange(rangeOverride || playbackRange);
  const max = editorView.state.doc.length;
  if (!Number.isFinite(range.startOffset) || range.startOffset < 0 || range.startOffset > max) {
    abortStart("Playback range start is invalid.");
    return;
  }

  // Guard: only one active PlaybackRange at a time.
  if (activePlaybackRange && isPlaying) {
    stopPlaybackFromGuard("Second PlaybackRange attempted to become active while playing.");
    return;
  }

  clearNoteSelection();
  const rangeOrigin = String((range && range.origin) || "cursor");
  const selectionMode = range && (rangeOrigin === "selection" || rangeOrigin === "ab");
  const scopedMode = range && (rangeOrigin === "selection" || rangeOrigin === "ab" || rangeOrigin === "focus");
  if (rangeOrigin === "focus" || rangeOrigin === "selection") {
    selectionPlaybackRuntime.setScopedOptions(getSelectionPlaybackSettings());
  } else if (rangeOrigin === "ab") {
    const abMuted = selectionPlaybackRuntime.getAbMutedVoiceIds();
    selectionPlaybackRuntime.setScopedOptions({
      allowMidiDrums: true,
      muteGchords: window.__abcarusPlaybackStripChordSymbols === true,
      suppressRepeats: true,
      mutedVoices: abMuted,
    });
  } else {
    selectionPlaybackRuntime.clearScopedOptions();
  }
  if (range && typeof range === "object") {
    const scopedOptions = selectionPlaybackRuntime.getScopedOptions();
    if (scopedOptions && typeof scopedOptions.suppressRepeats === "boolean") {
      range.suppressRepeats = Boolean(scopedOptions.suppressRepeats);
    } else if (typeof range.suppressRepeats !== "boolean") {
      range.suppressRepeats = null;
    }
  }
  const sourceKey = selectionMode ? null : getPlaybackSourceKey();
  const canReuse = (
    !scopedMode
    && !playbackNeedsReprepare
    && !lastPlaybackHasParts
    && playbackState
    && lastPreparedPlaybackKey
    && sourceKey
    && lastPreparedPlaybackKey === sourceKey
    && player
  );
  waitingForFirstNote = true;
		  try {
		    if (!canReuse) {
		      stopPlaybackForRestart();
		      const desired = soundfontName || "TimGM6mb.sf2";
	      setSoundfontCaption("Loading...");
	      updateSoundfontLoadingStatus(desired);
		      selectionPlaybackRuntime.setSelectionMode(selectionMode);
		      await preparePlayback();
		    } else {
		      await ensureSoundfontReady();
		      stopPlaybackForRestart();
		    }
		  } catch (e) {
		    lastPlaybackException = {
		      phase: "preparePlayback",
		      message: (e && e.message) ? String(e.message) : String(e),
		      stack: (e && e.stack) ? String(e.stack) : null,
		    };
		    try { scheduleAutoDump("playback-start-failed", (e && e.message) ? e.message : String(e)); } catch {}
		    stopPlaybackFromGuard(`Playback start failed: ${(e && e.message) ? e.message : String(e)}`);
		    if (selectionMode) {
		      showToast("Selected range cannot be played safely.", 3200);
		    } else {
		      showToast("Playback failed to start. Try again.", 3200);
		    }
		    return;
		  } finally {
		    selectionPlaybackRuntime.setSelectionMode(false);
        selectionPlaybackRuntime.clearScopedOptions();
		  }
  if (startToken !== playbackStartToken) return;

  updatePracticeUi();

  const startAbcOffset = toDerivedOffset(range.startOffset);
  if (!Number.isFinite(startAbcOffset)) {
    abortStart("Playback range start is invalid.");
    return;
  }
  let startSym = findSymbolAtOrAfter(startAbcOffset);
  // Cursor can land on inter-note whitespace (or be shifted there by UI timing).
  // In normal transport mode, prefer the previous playable symbol when it is in the same bar segment.
  // This avoids "start from second note" when the user places the cursor visually before a bar start note.
  if (!scopedMode && Number.isFinite(startAbcOffset) && startAbcOffset > 0 && editorView) {
    let ch = "";
    try { ch = editorView.state.doc.sliceString(range.startOffset, range.startOffset + 1); } catch {}
    if (/\s/.test(String(ch || ""))) {
      const prevSym = findSymbolAtOrBefore(startAbcOffset - 1);
      if (prevSym && Number.isFinite(prevSym.istart) && Number.isFinite(prevSym.dur) && prevSym.dur > 0 && !prevSym.noplay) {
        const prevEditorOffset = toEditorOffset(prevSym.istart);
        if (Number.isFinite(prevEditorOffset)) {
          let between = "";
          try {
            const a = Math.max(0, Math.min(range.startOffset, prevEditorOffset));
            const b = Math.max(a, Math.max(range.startOffset, prevEditorOffset));
            between = editorView.state.doc.sliceString(a, b);
          } catch {}
          // Keep mid-score starts deterministic, but do not cross bar/line boundaries.
          if (!/[\n|]/.test(String(between || ""))) {
            if (!startSym || !Number.isFinite(startSym.istart) || prevSym.istart < startSym.istart) {
              startSym = prevSym;
              range.startOffset = Math.max(0, prevEditorOffset);
            }
          }
        }
      }
    }
  }
  if (!startSym || !Number.isFinite(startSym.istart)) {
    if (!scopedMode && startAbcOffset > 0) {
      const fallbackSym = findSymbolAtOrAfter(0);
      if (fallbackSym && Number.isFinite(fallbackSym.istart)) {
        range.startOffset = 0;
        startSym = fallbackSym;
      }
    }
  }
  if (
    startSym
    && Number.isFinite(startSym.istart)
    && !scopedMode
    && startAbcOffset > 0
    && startSym.istart < startAbcOffset
  ) {
    const fallbackSym = findSymbolAtOrAfter(0);
    if (fallbackSym && Number.isFinite(fallbackSym.istart)) {
      range.startOffset = 0;
      startSym = fallbackSym;
    }
  }
  if (!startSym || !Number.isFinite(startSym.istart)) {
    abortStart("Playback start is not mappable.");
    return;
  }

  // Guard: ensure we map startOffset deterministically (no fallback mapping).
  if (startSym.istart < startAbcOffset && range.startOffset !== 0) {
    stopPlaybackFromGuard("PlaybackRange.startOffset mapped to a symbol before startOffset.");
    return;
  }

		  // Switch semantics guard (Option B): playbackRange changes while playing are deferred; we also freeze loop start.
		  activePlaybackRange = range;
		  activePlaybackEndSymbol = resolvePlaybackEndSymbol(range, startSym);
		  activePlaybackEndAbcOffset = (activePlaybackEndSymbol && Number.isFinite(activePlaybackEndSymbol.istart))
		    ? Number(activePlaybackEndSymbol.istart)
		    : null;
		  if (activePlaybackEndSymbol && Number.isFinite(activePlaybackEndSymbol.istart) && activePlaybackEndSymbol.istart <= startSym.istart) {
		    activePlaybackEndSymbol = null;
		    activePlaybackEndAbcOffset = null;
		  }
	  if (range && range.loop) {
	    activeLoopRange = {
	      startOffset: Number(range.startOffset) || 0,
	      endOffset: (range.endOffset == null) ? null : Number(range.endOffset),
	      origin: String(range.origin || "focus"),
	      loop: true,
	    };
	  } else {
	    activeLoopRange = null;
	  }

  playbackRunId += 1;
  lastTraceRunId = playbackRunId;
  lastTracePlaybackIdx = null;
  lastTraceTimestamp = null;
  playbackTraceSeq = 0;

  playbackStartArmed = true;
  try {
    startPlaybackFromPrepared(startSym.istart);
  } catch (e) {
    lastPlaybackException = {
      phase: "startPlaybackFromPrepared",
      message: (e && e.message) ? String(e.message) : String(e),
      stack: (e && e.stack) ? String(e.stack) : null,
    };
    stopPlaybackFromGuard(`Playback start failed: ${(e && e.message) ? e.message : String(e)}`);
    showToast("Playback failed to start. Try again.", 3200);
    return;
  }
  playbackStartArmed = false;
}

async function startPlaybackAtIndex(startIdx) {
  if (!editorView) return;
  const max = editorView.state.doc.length;
  const next = Number.isFinite(startIdx) ? Math.max(0, Math.min(startIdx, max)) : 0;
  setPlaybackRange({
    startOffset: next,
    endOffset: null,
    origin: "cursor",
    loop: playbackRange.loop,
  });
  await startPlaybackFromRange();
}

function pausePlayback() {
  if (!player || !isPlaying) return;
  resumeStartIdx = Number.isFinite(lastPlaybackIdx) ? lastPlaybackIdx : lastStartPlaybackIdx;
  stopPlaybackForRestart();
  isPlaying = false;
  isPaused = true;
  waitingForFirstNote = false;
  setStatus("Paused");
  updatePlayButton();
  setSoundfontCaption();
  if (Number.isFinite(lastRenderIdx)) {
    setPlaybackRange({
      startOffset: lastRenderIdx,
      endOffset: null,
      origin: "cursor",
      loop: playbackRange.loop,
    });
  }
  if (followPlayback && lastRenderIdx != null && editorView) {
    const max = editorView.state.doc.length;
    const idx = Math.max(0, Math.min(lastRenderIdx, max));
    editorView.dispatch({ selection: { anchor: idx, head: idx } });
  }
  pausedSelectionSignature = getEditorSelectionSignature();
}

async function startPlaybackAtMeasureOffset(delta) {
  clearNoteSelection();
  const sourceKey = getPlaybackSourceKey();
  const canReuse = (
    !playbackNeedsReprepare
    && !lastPlaybackHasParts
    && playbackState
    && lastPreparedPlaybackKey
    && lastPreparedPlaybackKey === sourceKey
    && player
  );
  if (!canReuse) {
    stopPlaybackForRestart();
    await preparePlayback();
  } else {
    await ensureSoundfontReady();
    stopPlaybackForRestart();
  }
  if (!playbackState || !playbackState.measures.length) {
    setPlaybackRange({
      startOffset: 0,
      endOffset: null,
      origin: "cursor",
      loop: playbackRange.loop,
    });
    await startPlaybackFromRange();
    return;
  }
  const baseIdx = Number.isFinite(lastPlaybackIdx) ? lastPlaybackIdx : lastStartPlaybackIdx;
  const current = findMeasureIndex(baseIdx);
  const targetIndex = Math.max(0, Math.min(playbackState.measures.length - 1, current + delta));
  const target = playbackState.measures[targetIndex];
  const targetIdx = target && Number.isFinite(target.istart) ? target.istart : 0;
  const editorStart = Math.max(0, targetIdx - playbackIndexOffset);
  setPlaybackRange({
    startOffset: editorStart,
    endOffset: null,
    origin: "cursor",
    loop: playbackRange.loop,
  });
  await startPlaybackFromRange();
}

async function playDrumPreview(pitch, velocity) {
  const midiPitch = Number.isFinite(Number(pitch)) ? Number(pitch) : 35;
  const dyn = velocityToDynamic(velocity);
  try {
    if (isPlaying || isPaused) {
      stopPlaybackForRestart();
      isPlaying = false;
      isPaused = false;
      waitingForFirstNote = false;
      updatePlayButton();
    }
    isPreviewing = true;
    await ensureSoundfontLoaded();
    const p = ensurePlayer();
    if (typeof p.set_sfu === "function") p.set_sfu(soundfontSource || "abc2svg.sf2");
    try { sessionStorage.setItem("audio", "sf2"); } catch {}
    if (typeof p.clear === "function") p.clear();
    const AbcCtor = getAbcCtor();
    const user = {
      img_out: () => {},
      err: (m) => logErr(m),
      errmsg: (m) => logErr(m),
      abcplay: p,
    };
    const abc = new AbcCtor(user);
    const abcText = [
      "X:1",
      "L:1/4",
      "M:4/4",
      "K:C",
      "V:DRUM clef=perc name=\"Drums\"",
      "%%MIDI channel 10",
      `%%MIDI drummap C, ${midiPitch}`,
      `!${dyn}!C,`,
      "",
    ].join("\n");
    abc.tosvg("drum_preview", abcText);
    const tunes = abc.tunes || [];
    if (!tunes.length) return;
    p.add(tunes[0][0], tunes[0][1], tunes[0][3]);
    p.play(tunes[0][0], null, 0);
  } catch (e) {
    logErr((e && e.stack) ? e.stack : String(e));
    isPreviewing = false;
  }
}

if ($btnPlayPause) {
  $btnPlayPause.addEventListener("click", async () => {
    try {
      if (rawMode) {
        showToast("Raw mode: switch to tune mode to play.", 2200);
        return;
      }
      await togglePlayPauseEffective();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($selectionLoopEnabled) {
  $selectionLoopEnabled.addEventListener("change", () => {
    const next = Boolean($selectionLoopEnabled.checked);
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackSelectionLoopEnabled: next }).catch(() => {});
    }
  });
}

if ($selectionSuppressEnabled) {
  $selectionSuppressEnabled.addEventListener("change", () => {
    const next = Boolean($selectionSuppressEnabled.checked);
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackSelectionSuppressRepeats: next }).catch(() => {});
    }
  });
}

if ($selectionGchordsEnabled) {
  $selectionGchordsEnabled.addEventListener("change", () => {
    const next = Boolean($selectionGchordsEnabled.checked);
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackSelectionMuteGchords: !next }).catch(() => {});
    }
  });
}

if ($selectionDrumsEnabled) {
  $selectionDrumsEnabled.addEventListener("change", () => {
    const next = Boolean($selectionDrumsEnabled.checked);
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackSelectionAllowMidiDrums: next }).catch(() => {});
    }
  });
}

if ($selectionMutedVoices) {
  const persistMutedVoices = () => {
    const raw = String($selectionMutedVoices.value || "");
    const normalized = raw
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .join(",");
    if (window.api && typeof window.api.updateSettings === "function") {
      window.api.updateSettings({ playbackSelectionMutedVoices: normalized }).catch(() => {});
    }
  };
  $selectionMutedVoices.addEventListener("change", persistMutedVoices);
  $selectionMutedVoices.addEventListener("blur", persistMutedVoices);
}

if ($practiceTempo) {
  $practiceTempo.addEventListener("change", () => {
    const next = Number($practiceTempo.value);
    if (!Number.isFinite(next)) return;
    practiceTempoMultiplier = next;
    syncPendingPlaybackPlan();
    if (focusModeEnabled && isPlaybackBusy() && player && typeof player.set_speed === "function") {
      desiredPlayerSpeed = next;
      try { player.set_speed(desiredPlayerSpeed); } catch {}
    }
    updatePracticeUi();
  });
  const initial = Number($practiceTempo.value);
  if (Number.isFinite(initial)) practiceTempoMultiplier = initial;
}

const clampLoopField = (raw) => clampInt(raw, 0, 100000, 0);

async function persistLoopSettingsPatch(patch) {
  if (!window.api || typeof window.api.updateSettings !== "function") return;
  try { await window.api.updateSettings(patch); } catch {}
}

if ($practiceLoopEnabled) {
  $practiceLoopEnabled.addEventListener("change", () => {
    const next = Boolean($practiceLoopEnabled.checked);
    playbackLoopEnabled = next;
    syncPendingPlaybackPlan();
    updatePracticeUi();
    persistLoopSettingsPatch({ playbackLoopEnabled: next }).catch(() => {});
  });
}

if ($practiceLoopFrom) {
  $practiceLoopFrom.addEventListener("input", () => {
    const next = clampLoopField($practiceLoopFrom.value);
    playbackLoopFromMeasure = next;
    syncPendingPlaybackPlan();
    updatePracticeUi();
  });
  $practiceLoopFrom.addEventListener("change", () => {
    const next = clampLoopField($practiceLoopFrom.value);
    playbackLoopFromMeasure = next;
    syncPendingPlaybackPlan();
    updatePracticeUi();
    const patch = {
      playbackLoopFromMeasure: playbackLoopFromMeasure,
      playbackLoopToMeasure: playbackLoopToMeasure,
    };
    if (activeTuneId) {
      playbackLoopTuneId = String(activeTuneId);
      patch.playbackLoopTuneId = playbackLoopTuneId;
    }
    persistLoopSettingsPatch(patch).catch(() => {});
  });
}

if ($practiceLoopTo) {
  $practiceLoopTo.addEventListener("input", () => {
    const next = clampLoopField($practiceLoopTo.value);
    playbackLoopToMeasure = next;
    syncPendingPlaybackPlan();
    updatePracticeUi();
  });
  $practiceLoopTo.addEventListener("change", () => {
    const next = clampLoopField($practiceLoopTo.value);
    playbackLoopToMeasure = next;
    syncPendingPlaybackPlan();
    updatePracticeUi();
    const patch = {
      playbackLoopFromMeasure: playbackLoopFromMeasure,
      playbackLoopToMeasure: playbackLoopToMeasure,
    };
    if (activeTuneId) {
      playbackLoopTuneId = String(activeTuneId);
      patch.playbackLoopTuneId = playbackLoopTuneId;
    }
    persistLoopSettingsPatch(patch).catch(() => {});
  });
}

if ($btnFocusMode) {
  $btnFocusMode.addEventListener("click", () => {
    toggleFocusMode();
  });
}

if ($btnToggleSplit) {
  $btnToggleSplit.addEventListener("click", () => {
    toggleSplitOrientation({ userAction: true });
  });
}

if ($btnPlay) {
  $btnPlay.addEventListener("click", async () => {
    try {
      if (rawMode) {
        showToast("Raw mode: switch to tune mode to play.", 2200);
        return;
      }
      await transportPlay();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($btnPause) {
  $btnPause.addEventListener("click", async () => {
    try {
      if (rawMode) {
        showToast("Raw mode: switch to tune mode to play.", 2200);
        return;
      }
      await transportPause();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($btnStop) {
  $btnStop.addEventListener("click", () => {
    stopPlaybackTransport();
  });
}

if ($btnRestart) {
  $btnRestart.addEventListener("click", async () => {
    try {
      await transportStartOver();
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($btnPrevMeasure) {
  $btnPrevMeasure.addEventListener("click", async () => {
    try {
      await activateErrorByNav(-1);
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

if ($btnNextMeasure) {
  $btnNextMeasure.addEventListener("click", async () => {
    try {
      await activateErrorByNav(1);
    } catch (e) {
      logErr((e && e.stack) ? e.stack : String(e));
      setStatus("Error");
    }
  });
}

document.addEventListener("drum:preview", (event) => {
  const detail = event && event.detail ? event.detail : {};
  playDrumPreview(detail.pitch, detail.velocity);
});

if ($btnFonts) {
  $btnFonts.addEventListener("click", () => {
    if (!settingsController) return;
    if (typeof settingsController.openTab === "function") {
      settingsController.openTab("fonts");
      return;
    }
    settingsController.openSettings();
  });
}

if ($btnResetLayout) {
  $btnResetLayout.addEventListener("click", () => {
    resetLayout();
  });
}

if ($btnToggleFollow) {
  $btnToggleFollow.addEventListener("click", async () => {
    if (window.api && typeof window.api.updateSettings === "function") {
      await window.api.updateSettings({ followPlayback: !followPlayback });
      return;
    }
    followPlayback = !followPlayback;
    updateFollowToggle();
  });
}

if ($btnToggleErrors) {
  $btnToggleErrors.addEventListener("click", async () => {
    const next = !errorsEnabled;
    if (!next) {
      if (window.api && typeof window.api.updateSettings === "function") {
        window.api.updateSettings({ errorsEnabled: false }).catch(() => {});
      }
      setErrorsEnabled(false, { triggerRefresh: false });
      return;
    }
    // Enabling errors is session-only (not persisted).
    setErrorsEnabled(true, { triggerRefresh: true });
    startScanForErrorsFromToolbarEnable();
  });
}

if ($btnToggleGlobals) {
  $btnToggleGlobals.addEventListener("click", async () => {
    if (!window.api || typeof window.api.updateSettings !== "function") return;
    await window.api.updateSettings({ globalHeaderEnabled: !globalHeaderEnabled });
  });
}

updatePlayButton();
updateFollowToggle();

async function maybeRunDevAutoscrollDemo() {
  if (!window.api || typeof window.api.getDevConfig !== "function") return;
  const cfg = window.api.getDevConfig() || {};
  const filePath = String(cfg.ABCARUS_DEV_FILE || "").trim();
  if (!filePath) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tuneX = Number(String(cfg.ABCARUS_DEV_TUNE_X || "").trim());
  const wantFocus = String(cfg.ABCARUS_DEV_FOCUS || "").trim() === "1";
  const wantPlay = String(cfg.ABCARUS_DEV_AUTOPLAY || "").trim() === "1";
  const wantDebug = String(cfg.ABCARUS_DEV_AUTOSCROLL_DEBUG || "").trim() === "1";
  const wantFocusDebug = String(cfg.ABCARUS_DEV_FOCUS_DEBUG || "").trim() === "1";
  const quitAfter = String(cfg.ABCARUS_DEV_QUIT || "").trim() === "1";
  const modeSpec = String(cfg.ABCARUS_DEV_AUTOSCROLL_MODE || "").trim();
  const forcedZoom = Number(String(cfg.ABCARUS_DEV_RENDER_ZOOM || "").trim());
  const mutateSettings = String(cfg.ABCARUS_DEV_MUTATE_SETTINGS || "").trim() === "1";

  if (wantDebug) window.__abcarusDebugAutoscroll = true;
  if (wantFocusDebug) window.__abcarusDebugFocus = true;

  let restoreSettingsPatch = null;

  const res = await readFile(filePath);
  if (!res || !res.ok) {
    console.error("[abcarus][dev] Unable to read dev file:", res && res.error ? res.error : filePath);
    return;
  }
  const full = String(res.data || "");

  const extractTune = (text, xNumber) => {
    if (!Number.isFinite(xNumber)) return text;
    const re = /^\s*X:\s*(\d+)\s*$/gm;
    let match = null;
    const starts = [];
    while ((match = re.exec(text))) {
      starts.push({ idx: match.index, x: Number(match[1]) });
    }
    const start = starts.find((s) => s.x === xNumber);
    if (!start) return text;
    const next = starts.find((s) => s.idx > start.idx);
    const end = next ? next.idx : text.length;
    return String(text.slice(start.idx, end)).trimEnd() + "\n";
  };

  const tuneText = extractTune(full, tuneX);
  suppressDirty = true;
  try {
    setEditorValue(tuneText);
  } finally {
    suppressDirty = false;
  }
  scheduleRenderNow();

  const waitForSvg = async (timeoutMs = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const svg = $out ? $out.querySelector("svg") : null;
      if (svg) return true;
      await sleep(100);
    }
    return false;
  };
  if (!(await waitForSvg())) {
    console.error("[abcarus][dev] SVG render did not appear in time.");
    return;
  }

  if (Number.isFinite(forcedZoom) && forcedZoom > 0) {
    if (!wantFocus && mutateSettings && window.api && typeof window.api.getSettings === "function" && typeof window.api.updateSettings === "function") {
      try {
        const prev = await window.api.getSettings();
        const prevZoom = prev && Number(prev.renderZoom);
        if (Number.isFinite(prevZoom) && prevZoom > 0 && prevZoom !== forcedZoom) {
          restoreSettingsPatch = { renderZoom: prevZoom };
        }
        await window.api.updateSettings({ renderZoom: forcedZoom });
      } catch {}
    }
    setRenderZoomCss(forcedZoom);
    try {
      const cssZoom = getComputedStyle(document.documentElement).getPropertyValue("--render-zoom");
      const outZoom = $out ? getComputedStyle($out).zoom : "";
      console.log(
        "[abcarus][dev] render zoom =",
        forcedZoom,
        "cssVar=",
        String(cssZoom || "").trim(),
        "outZoom=",
        String(outZoom || "").trim(),
        "getRenderZoomFactor=",
        getRenderZoomFactor()
      );
    } catch {
      console.log("[abcarus][dev] render zoom =", forcedZoom);
    }
    await sleep(250);
  }

  if (wantFocus) {
    setFocusModeEnabled(true);
    await sleep(250);
  }

  const setMode = (m) => {
    if (!m) return;
    playbackAutoScrollMode = m;
    console.log("[abcarus][dev] autoscroll mode =", playbackAutoScrollMode);
  };

  const runOnce = async (m) => {
    setMode(m);
    await sleep(120);
    if (!wantPlay) return;
    await togglePlayPauseEffective();
    await sleep(25000);
    stopPlaybackTransport();
    await sleep(900);
  };

  try {
    if (modeSpec.toLowerCase() === "cycle") {
      for (const m of ["Keep Visible", "Page Turn", "Centered"]) {
        await runOnce(m);
      }
    } else if (modeSpec) {
      await runOnce(modeSpec);
    } else {
      await runOnce(null);
    }
  } catch (e) {
    console.error("[abcarus][dev] Demo failed:", (e && e.stack) ? e.stack : String(e));
  } finally {
    if (restoreSettingsPatch && window.api && typeof window.api.updateSettings === "function") {
      try { await window.api.updateSettings(restoreSettingsPatch); } catch {}
    }
    if (quitAfter && window.api && typeof window.api.quitApplication === "function") {
      try { await window.api.quitApplication(); } catch {}
    }
  }
}

maybeRunDevAutoscrollDemo().catch(() => {});
function createRectSelectionExtension() {
  return rectangularSelection({
    // Linux WMs often reserve Alt+drag for window move/resize.
    // Keep Alt+drag where available, and provide Ctrl+Shift+drag as a reliable fallback.
    eventFilter: (event) => Boolean(
      event
      && event.button === 0
      && (
        event.altKey
        || (event.ctrlKey && event.shiftKey)
      )
    ),
  });
}
