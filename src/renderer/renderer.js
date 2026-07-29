import {
  EditorView,
  EditorState,
  EditorSelection,
  basicSetup,
  keymap,
  ViewPlugin,
  indentUnit,
  gotoLine,
  foldGutter,
  lineNumbers,
} from "../../third_party/codemirror/cm.js";
import { abcHighlight } from "./editor/abc_decorations.js";
import { createEditorExtensionRuntime } from "./editor/editor_extension_runtime.js";
import {
  initSearchPanelShortcuts,
  openFindPanel,
  openReplacePanel,
  scrollEditorToPos,
  insertTextAtEditorSelection as insertTextAtEditorSelectionCore,
  setEditorSelectionAt as setEditorSelectionAtCore,
  setEditorSelectionAtLineCol as setEditorSelectionAtLineColCore,
  setEditorSelectionRange as setEditorSelectionRangeCore,
  toggleLineComments as toggleLineCommentsCore,
} from "./editor/editor_commands.js";
import {
  createMainEditorFeature,
  createRectSelectionExtension,
} from "./editor/main_editor_feature.js";
import { createAbcHelpersFeature } from "./editor/abc_helpers_feature.js";
import { createErrorsFeature } from "./editor/errors_feature.js";
import {
  detectMeterMismatchInBarlines,
  detectRepeatMarkerAfterShortBar,
} from "./editor/errors_bar_mismatch_model.js";
import {
  parseErrorLocation,
} from "./editor/errors_model.js";
import {
  buildAbDecorations,
  buildPayloadLayerDecorations,
} from "./editor/range_decorations.js";
import {
  normalizeMeasuresLineBreaks,
  transformMeasuresPerLine,
} from "./measures.mjs";
import {
  buildDefaultDrumVelocityMap,
  clampVelocity,
  hasMidiDrumMustBeInVoicePlaybackError,
  isMidiDrumMustBeInVoicePlaybackError,
  neutralizeMidiDrumDirectivesForPlayback,
  shouldRelocateMidiDrumsForPlayback,
  shouldSuppressUserVisibleAbcError,
  velocityToDynamic,
} from "./drums.js";
import { createLibraryMetadataController } from "./library/library_metadata_controller.js";
import { createLibraryLifecycleController } from "./library/library_lifecycle_controller.js";
import { createLibraryDocumentContext } from "./library/library_document_context.js";
import { createLibraryCrudDomain } from "./library/library_crud_domain.js";
import { createLibraryUiDomain } from "./library/library_ui_domain.js";
import { normalizeLibraryPath, pathsEqual } from "./library/path_utils.js";
import { fileExists, mkdirp, readFile, renameFile, safeBasename, safeDirname, writeFile } from "./io/file_ops.js";
import { createFileContentCache, createFileOperationLocks } from "./io/file_runtime.js";
import {
  alignBarsInText,
} from "./abc/align_bars.js";
import {
  gcdInt,
  getDefaultLen,
} from "./abc/bar_metrics.js";
import {
  computeMeasureStatsAt as computeMeasureStatsAtCore,
  parseMeterParts,
} from "./abc/measure_stats.js";
import {
  parseAbcHeaderFields,
  parseTuneIdentityFields,
} from "./abc/header_fields.js";
import {
  collectHeaderKeys,
  sanitizeFileHeaderForInteractiveRender,
  sanitizeFileHeaderForPerTuneRender,
} from "./abc/header_prefix_model.js";
import {
  appendTuneToContent,
  ensureCopyTitleInAbc,
  ensureXNumberInAbc,
  getNextXNumber,
  removeTuneFromContent,
  renumberXInTextKeepingFirst,
  renumberXLinesConsecutive,
} from "./abc/text_transforms.js";
import { createPerdeService } from "./microtonal/perde_service.js";
import {
  isChordProFilePath,
  isChordProText,
} from "./tools/chordpro/chordpro_model.js";
import { createChordProFeature } from "./tools/chordpro/chordpro_feature.js";
import { createImportExportFeature } from "./tools/import_export/import_export_feature.js";
import { createRawModeEnterGuard } from "./tools/raw_mode/raw_mode_enter_guard.js";
import { createRawModeFeature } from "./tools/raw_mode/raw_mode_feature.js";
import { createAbcTransformFeature } from "./tools/transforms/abc_transform_feature.js";
import { createSetListFeature } from "./tools/set_list/set_list_feature.js";
import { createSetListRendererAdapter } from "./tools/set_list/set_list_renderer_adapter.js";
import { createSourceLinkFeature } from "./tools/source_link/source_link_feature.js";
import { createMicrotonalToolsFeature } from "./tools/microtonal/microtonal_tools_feature.js";
import { createIntonationExplorerFeature } from "./tools/intonation_explorer/intonation_explorer_feature.js";
import { createIntonationRendererBridge } from "./tools/intonation_explorer/intonation_renderer_bridge.js";
import { createTemplatesFeature } from "./tools/templates/templates_feature.js";
import { createMidiInputFeature } from "./tools/midi_input/midi_input_feature.js";
import { createPayloadModeFeature } from "./tools/payload_mode/payload_mode_feature.js";
import { createPayloadModeDecorations } from "./tools/payload_mode/payload_mode_decorations.js";
import { createPayloadModeEditorAdapter } from "./tools/payload_mode/payload_mode_editor_adapter.js";
import { computePayloadTuneOffset } from "./tools/payload_mode/payload_mode_model.mjs";
import {
  buildSelectionPlaybackToast,
  hasIntentionalSelectionPlaybackSpan,
  hasRepeatTokensInSlice,
  normalizeVoiceIdToken,
  parseMutedVoiceSetting,
} from "./playback/selection_playback_model.js";
import { createAbLoopRuntime } from "./playback/ab_loop_runtime.js";
import { createAbSelectionPlaybackController } from "./playback/ab_selection_playback_controller.js";
import { createSelectionPlaybackRuntime } from "./playback/selection_playback_runtime.js";
import { createPlaybackTransportState } from "./playback/playback_transport_state.js";
import { createPlaybackPayloadController } from "./playback/playback_payload_controller.js";
import { createPlaybackPrepareController } from "./playback/playback_prepare_controller.js";
import { createDrumPreviewController } from "./playback/drum_preview_controller.js";
import { createPlaybackStartController } from "./playback/playback_start_controller.js";
import { createPlaybackTransportController } from "./playback/playback_transport_controller.js";
import { createPlaybackPlayerController } from "./playback/playback_player_controller.js";
import { createPlaybackFollowController } from "./playback/playback_follow_controller.js";
import { createPlaybackAutoScrollController } from "./playback/playback_autoscroll_controller.js";
import { createFocusModeController } from "./playback/focus_mode_controller.js";
import { createFollowHighlightSettings } from "./playback/follow_highlight_settings.js";
import {
  expandRepeatsForPlayback,
  shouldForceRepeatExpansionForPlayback,
} from "./playback/repeat_expansion_model.js";
import {
  detectKeyFieldNotLastBeforeBody,
  injectGchordOn,
  isInlineFieldOnlyLine,
  normalizeBlankLinesForPlayback,
  normalizeDollarLineBreaksForPlayback,
  normalizeLeadingInlineDirectivesForPlayback,
  normalizeReadableMidiDrumsForPlayback,
  sanitizeAbcForPlayback,
} from "./playback/playback_payload_model.js";
import {
  buildPlaybackState as buildPlaybackStateModel,
  findPlaybackMeasureIndex,
  findPlaybackSymbolAtOrAfter,
  findPlaybackSymbolAtOrBefore,
  snapIstartToPlayable as snapIstartToPlayableModel,
  upperBoundTime,
} from "./playback/playback_state_model.js";
import { createSoundfontController } from "./playback/soundfont_controller.js";
import { createPrintAllFeature } from "./print/print_all_feature.js";
import { createPrintCurrentFeature } from "./print/print_current_feature.js";
import {
  getRenderCompatMapFromPayload,
  mapEditorOffsetToRenderIdx as mapEditorOffsetToRenderIdxCore,
  mapRenderIdxToEditorOffset as mapRenderIdxToEditorOffsetCore,
  mapRenderOffsetToSourceOffset as mapRenderOffsetToSourceOffsetCore,
  mapSourceOffsetToRenderOffset as mapSourceOffsetToRenderOffsetCore,
  normalizeHeaderNoneSpacing,
  stripSepForRender,
} from "./render/render_payload_model.js";
import { createAbc2svgLoader } from "./render/abc2svg_loader.js";
import { createAbcToSvgMarkupRenderer } from "./render/abc_to_svg_markup.js";
import { createRenderPayloadController } from "./render/render_payload_controller.js";
import { createRenderPipelineController } from "./render/render_pipeline_controller.js";
import { createScoreHighlightController } from "./render/score_highlight_controller.js";
import { createPracticeBarHighlightController } from "./render/practice_bar_highlight_controller.js";
import { createHeaderLayersController } from "./render/header_layers_controller.js";
import {
  applyPrintDebugMarkup as applyPrintDebugMarkupCore,
  buildSongbookSuggestedBaseName as buildSongbookSuggestedBaseNameCore,
  buildSuggestedTuneBaseName as buildSuggestedTuneBaseNameCore,
  ensureOnePerPageDirective,
  sanitizeFileBaseName,
} from "./print/print_helpers.js";
import {
  clampTranslateToViewport,
  formatTranslateXY,
  readTranslateXY,
} from "./app/ui/modal_geometry.js";
import { createAboutModalController } from "./app/ui/about_modal_controller.js";
import { createGoToMeasureModalController } from "./app/ui/go_to_measure_modal_controller.js";
import { enableDraggableModal } from "./app/ui/draggable_modal.js";
import { enableDraggableFixedPopover } from "./app/ui/draggable_fixed_popover.js";
import { enableDraggableToolPanel } from "./app/ui/draggable_tool_panel.js";
import { createLayoutController } from "./app/ui/layout_controller.js";
import { createDiagnosticsDomain } from "./app/diagnostics/diagnostics_domain.js";
import { createToolStatusController } from "./app/ui/tool_status_controller.js";
import { createStatusController } from "./app/ui/status_controller.js";
import { createStartupController } from "./app/startup/startup_controller.js";
import { createToastHoverController } from "./app/ui/toast_hover_controller.js";
import { createFileHeaderController } from "./app/document/file_header_controller.js";
import { createFileContextController } from "./app/document/file_context_controller.js";
import { createEditStateController } from "./app/document/edit_state_controller.js";
import { createFileOperationGuard } from "./app/document/file_operation_guard.js";
import { createPlaybackUiController } from "./app/ui/playback_ui_controller.js";
import { createSettingsDomain } from "./app/ui/settings_domain.js";
import { createMeasureNavigationController } from "./app/navigation/measure_navigation_controller.js";
import { createDocumentLifecycleController } from "./app/document/document_lifecycle_controller.js";
import { createSaveFlowController } from "./app/document/save_flow_controller.js";
import { createWorkingCopySyncController } from "./app/document/working_copy_sync_controller.js";
import { createWorkingCopyRuntimeController } from "./app/document/working_copy_runtime_controller.js";
import { createWorkingCopyConflictController } from "./app/document/working_copy_conflict_controller.js";
import { createCurrentDocumentController } from "./app/document/current_document_controller.js";
import { createAppCommandsDomain } from "./app/commands/app_commands_domain.js";
import {
  SAVE_INTENT,
  createDocumentSessionController,
} from "./app/document/document_session_controller.js";

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

const editorExtensionRuntime = createEditorExtensionRuntime({
  getEditorView: () => editorView,
  getDiagnosticExtensions: () => [
    measureErrorPlugin,
    barMismatchPlugin,
    errorActivationHighlightPlugin,
    practiceBarHighlightPlugin,
  ],
  getInitialDiagnosticExtensions: () => [
    measureErrorPlugin,
    barMismatchPlugin,
    errorActivationHighlightPlugin,
    practiceBarHighlightPlugin,
    intonationRendererBridge.plugin,
    abPlugin,
    payloadModeDecorations.plugin,
  ],
});
const UNTITLED_UNSAVED_LABEL = "Untitled (unsaved)";

function reconfigureAbcExtensions({
  highlightEnabled = true,
  diagnosticsEnabled = true,
  completionEnabled = true,
  hoverEnabled = false,
  tuningModeExtensions = [],
} = {}) {
  editorExtensionRuntime.reconfigure({
    highlightEnabled,
    diagnosticsEnabled,
    completionEnabled,
    hoverEnabled,
    tuningModeExtensions,
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
let suppressDirty = false;
let editorView = null;
let isNewTuneDraft = false;
let rawModeFeature = null;
let payloadModeDecorations = null;
let fileContextController = null;
let editStateController = null;
let fileOperationGuard = null;
let playbackUiController = null;
let documentLifecycleController = null;
let documentSessionController = null;
let saveFlowController = null;
let focusModeController = null;
let workingCopyRuntimeController = null;
let libraryMetadataController = null;
let libraryLifecycleController = null;
let libraryShellController = null;
let libraryDocumentContext = null;
let libraryCrudDomain = null;
let tuneClipboardController = null;
let deleteTuneAction = null;
let duplicateTuneAction = null;
let pasteMoveTuneAction = null;
let renumberXAction = null;
let appendCurrentTuneAction = null;
let mainEditorFeature = null;
let newFileAction = null;
let abcTransformFeature = null;

function isRawModeActive() {
  return rawModeFeature ? rawModeFeature.isEnabled() : false;
}

function getRawModeFilePath() {
  return rawModeFeature ? rawModeFeature.getFilePath() : null;
}

function resetRawModeState() {
  if (rawModeFeature) rawModeFeature.resetState();
}

function setRawModeFilePath(filePath) {
  if (rawModeFeature) rawModeFeature.setFilePath(filePath);
}

function setRawModeHeaderEndOffset(value) {
  if (rawModeFeature) rawModeFeature.setHeaderEndOffset(value);
}

function resetTransposePreviewState() {
  if (abcTransformFeature && typeof abcTransformFeature.resetTransposePreview === "function") {
    abcTransformFeature.resetTransposePreview();
  }
}

const currentDocumentController = createCurrentDocumentController({
  state: {
    getDocumentSessionController: () => documentSessionController,
    getDocumentLifecycleController: () => documentLifecycleController,
  },
});
const {
  setCurrentDocument,
  clearCurrentDocument,
  getCurrentDocument,
  hasCurrentDocument,
  getCurrentDocumentPath,
  isCurrentDocumentDirty,
  ensureCurrentDocument,
  patchCurrentDocument,
  markCurrentDocumentClean,
  updateUIFromDocument,
  showEmptyState,
  serializeDocument,
  deserializeToDocument,
} = currentDocumentController;

const abc2svgLoader = createAbc2svgLoader({
  windowRef: window,
  documentRef: document,
  actions: {
    scheduleRender: () => scheduleRenderNow(),
    logError: logErr,
  },
});
const {
  getAbcCtor,
  ensureAbc2svgLoader,
  ensureAbc2svgModules,
  ensureAbc2svgModulesAsync,
  ensureMidiGenLoaded,
} = abc2svgLoader;

const abcToSvgMarkupRenderer = createAbcToSvgMarkupRenderer({
  windowRef: window,
  ensureAbc2svgLoader,
  ensureAbc2svgModulesReady: ensureAbc2svgModulesAsync,
  getAbcCtor,
  normalizeHeaderText: normalizeHeaderNoneSpacing,
  stripSepForRender,
  detectKeyFieldNotLastBeforeBody,
  isErrorsEnabled,
  isTuneErrorScanInFlight,
  shouldSuppressUserVisibleAbcError,
  logError: logErr,
});
const { renderAbcToSvgMarkup } = abcToSvgMarkupRenderer;
const abcHelpersFeature = createAbcHelpersFeature({
  windowRef: window,
  api: window.api,
  readFile,
  EditorSelection,
  enableDraggableFixedPopover,
  showToast,
  isInlineFieldOnlyLine,
  renderAbcToSvgMarkup,
});

const soundfontController = createSoundfontController({
  windowRef: window,
  api: window.api,
  elements: {
    label: $soundfontLabel,
  },
  state: {
    isPlaying: () => playbackTransport.isPlaying,
    isPaused: () => playbackTransport.isPaused,
    isWaitingForFirstNote: () => playbackTransport.waitingForFirstNote,
  },
  actions: {
    ensurePlayer: () => ensurePlayer(),
    setBufferStatus: (text) => setBufferStatus(text),
    setStatus: (text) => setStatus(text),
  },
});

const fileHeaderController = createFileHeaderController({
  elements: {
    panel: $fileHeaderPanel,
    editorHost: $fileHeaderEditor,
    toggleButton: $fileHeaderToggle,
    saveButton: $fileHeaderSave,
    reloadButton: $fileHeaderReload,
    stateMarker: $headerStateMarker,
  },
  editorDeps: {
    EditorView,
    EditorState,
    basicSetup,
    keymap,
    indentUnit,
  },
  createRectSelectionExtension,
  toggleLineComments,
  abcHighlight,
  getActiveFileEntry,
  isChordProEnabled: () => chordProFeature.isEnabled(),
  scheduleRenderNow,
  setDirtyIndicator: () => setDirtyIndicator(isCurrentDocumentDirty()),
  logError: (...args) => console.error(...args),
  actions: {
    flushWorkingCopyTuneSync,
    saveFileHeaderText,
    setStatus,
    showSaveError,
    showToast,
  },
});

const payloadModeEditorAdapter = createPayloadModeEditorAdapter({
  getEditorView: () => editorView,
  getEditorText: () => getEditorValue(),
  setEditorText: setEditorValue,
  setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
  readOnlyCompartment: editorExtensionRuntime.payloadReadOnlyCompartment,
  EditorState,
  EditorView,
});

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
  getCopyText: payloadModeEditorAdapter.getCopyText,
  hasEditor: () => Boolean(editorView),
  getEditorText: () => getEditorValue(),
  getEditorSelection: () => editorView ? editorView.state.selection : null,
  setEditorText: payloadModeEditorAdapter.setEditorValue,
  setEditorReadOnly: payloadModeEditorAdapter.setEditorReadOnly,
  setEditorCursor: payloadModeEditorAdapter.setEditorCursor,
  restoreEditorSelection: payloadModeEditorAdapter.restoreEditorSelection,
  getActiveTuneUid: () => activeTuneUid,
  isRawMode: () => isRawModeActive(),
  isFocusModeEnabled,
  getHeaderText: () => {
    const entry = getActiveFileEntry();
    return entry ? getHeaderEditorValue() : "";
  },
  sanitizeHeaderText: sanitizeFileHeaderForInteractiveRender,
  buildHeaderPrefixWithLayerSpans,
  playbackPayloadTransforms: {
    injectGchordOn,
    normalizeDollarLineBreaksForPlayback,
    normalizeBlankLinesForPlayback,
    normalizeReadableMidiDrumsForPlayback,
    sanitizeAbcForPlayback,
    expandRepeatsForPlayback,
    expandRepeats: () => window.__abcarusPlaybackExpandRepeats === true,
  },
  stopPlayback: stopPlaybackTransport,
  resetPlaybackState,
  clearBarMismatchMarkers: () => errorsFeature.clearBarMismatchMarkers(),
  refreshLayerDecorations: () => {
    if (payloadModeDecorations) payloadModeDecorations.refresh();
  },
  scheduleRender: scheduleRenderNow,
  scheduleLibraryTree: () => scheduleRenderLibraryTree(sourceFiles),
  showToast,
  setStatus,
});

payloadModeDecorations = createPayloadModeDecorations({
  ViewPlugin,
  buildPayloadLayerDecorations,
  getOptions: () => payloadModeFeature.getLayerDecorationOptions(),
  refreshEditor: () => {
    if (editorView) editorView.dispatch({ selection: editorView.state.selection, scrollIntoView: false });
  },
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
  getCurrentDoc: getCurrentDocument,
  setCurrentDoc: (doc) => { setCurrentDocument(doc || null); },
  setCurrentDocContent: (content) => patchCurrentDocument({ content }, { create: false }),
  isPayloadMode,
  isLibraryVisible: () => isLibraryVisible,
  isHeaderCollapsed: getHeaderCollapsed,
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
  resetRawModeState,
  resetPlaybackState,
  clearErrors,
  beginFullFileModeContext: (filePath, source) => documentLifecycleController.beginFullFileModeContext(filePath, source),
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

fileContextController = createFileContextController({
  elements: {
    tuneSelect: $fileTuneSelect,
  },
  errors: {
    getFilteredTunes: (tunes) => errorsFeature.getFilteredTunes(tunes),
    hasIndexedErrors: () => errorsFeature.hasIndexedErrors(),
    updateScanButtonVisibility: (entry) => errorsFeature.updateScanButtonVisibility(entry),
    setScanButtonActive: (active) => errorsFeature.setScanButtonActive(active),
  },
  chordPro: {
    isEnabled: () => chordProFeature.isEnabled(),
    updateSelectOptions: () => chordProFeature.updateSelectOptions(),
    getActiveIndex: () => chordProFeature.getActiveIndex(),
    setActiveBlock: (idx, options) => chordProFeature.setActiveBlock(idx, options),
  },
  state: {
    getActiveFileEntry,
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneUid: () => activeTuneUid,
    getActiveTuneMeta: () => activeTuneMeta,
    getIsNewTuneDraft: () => isNewTuneDraft,
    setIsNewTuneDraft: (value) => { isNewTuneDraft = Boolean(value); },
    getLibraryIndex: () => libraryIndex,
    getRawMode: () => isRawModeActive(),
    isPayloadMode,
    isTuneErrorFilterActive,
    isTuneErrorScanInFlight,
  },
  actions: {
    selectTune,
    showToast,
  },
  utils: {
    pathsEqual,
  },
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
  getCurrentDocDirty: isCurrentDocumentDirty,
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
const setListRendererAdapter = createSetListRendererAdapter({
  getCurrentDocDirty: isCurrentDocumentDirty,
  getActiveTuneId: () => activeTuneId,
  getActiveFilePath: () => activeFilePath,
  getHeaderText: () => getHeaderEditorValue(),
  confirmUnsavedChanges,
  performSaveFlow,
  findTuneById,
  readFile,
  writeFile,
  pathsEqual,
  sanitizeHeaderText: sanitizeFileHeaderForPerTuneRender,
  buildHeaderPrefix,
  setErrorLineOffsetFromHeader,
  renderAbcToSvgMarkup,
  getDefaultSaveDir,
  showSaveDialog,
  showSaveError,
  withFileLock,
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
  buildItemForTuneId: setListRendererAdapter.buildItemForTuneId,
  renderItemToSvg: setListRendererAdapter.renderItemToSvg,
  buildSourceLinkMarkup: (abcText) => sourceLinkFeature.buildPrintMarkup(abcText),
  outputPrint: setListRendererAdapter.outputPrint,
  saveAbc: setListRendererAdapter.saveAbc,
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
const abSelectionPlaybackController = createAbSelectionPlaybackController({
  abLoopRuntime,
  selectionPlaybackRuntime,
  getSettings: () => ({
    ...(latestSettingsSnapshot || {}),
    selectionLoopElement: $selectionLoopEnabled,
    selectionSuppressElement: $selectionSuppressEnabled,
    selectionGchordsElement: $selectionGchordsEnabled,
    selectionDrumsElement: $selectionDrumsEnabled,
    selectionMutedVoicesElement: $selectionMutedVoices,
  }),
  getEditorView: () => editorView,
  getEditorText: getEditorValue,
  isRawMode: () => isRawModeActive(),
  isPayloadMode,
  isPlaying: () => playbackTransport.isPlaying,
  getActivePlaybackRange: () => playbackTransport.activePlaybackRange,
  setPlaybackRange,
  startPlaybackFromRange,
  stopPlayback: stopPlaybackTransport,
  refreshMarkers: refreshAbMarkers,
  showToast,
  parseMutedVoiceSetting,
  hasIntentionalSelectionPlaybackSpan,
  hasRepeatTokensInSlice,
  buildSelectionPlaybackToast,
  globalObject: window,
});
const errorsFeature = createErrorsFeature({
  elements: {
    toggleButton: $btnToggleErrors,
    prevButton: $btnPrevMeasure,
    nextButton: $btnNextMeasure,
    scanButton: $scanErrorTunes,
    indicator: $errorsIndicator,
    focusMessage: $errorsFocusMessage,
    popover: $errorsPopover,
    popoverTitle: $errorsPopoverTitle,
    popoverList: $errorsListPopover,
    list: $errorList,
    sidebar: $sidebar,
    sidebarBody: $sidebarBody,
    tuneSelect: $fileTuneSelect,
  },
  safeBasename,
  setButtonText,
  showToast,
  logError: (...args) => console.error(...args),
  isMeasureCheckEnabled,
  isRawMode: () => isRawModeActive(),
  isPayloadMode,
  getActiveTuneMeta: () => activeTuneMeta,
  getEditorText: () => editorView ? editorView.state.doc.toString() : "",
  getEditorView: () => editorView,
  getRenderPayload,
  getLastRenderPayload: () => getLastRenderPayload(),
  getOutputElement: () => $out,
  getRenderPaneElement: () => $renderPane,
  findMeasureRangeAt,
  mapRenderIdxToEditorOffset,
  mapEditorOffsetToRenderIdx,
  pickClosestNoteElement,
  maybeScrollRenderToNote,
  getEditorIndexFromLoc,
  setEditorSelectionAt,
  setEditorSelectionAtLineCol,
  getTextIndexFromLoc,
  highlightRenderNoteAtIndex,
  highlightSvgAtEditorOffset,
  isPlaying: () => playbackTransport.isPlaying,
  isPaused: () => playbackTransport.isPaused,
  getPlaybackRange: () => playbackTransport.playbackRange,
  setPlaybackRange,
  setPendingPlaybackRangeOrigin: (origin) => {
    if (mainEditorFeature) mainEditorFeature.setPendingPlaybackRangeOrigin(origin);
  },
  setSuppressPlaybackRangeSelectionSync: (value) => {
    if (mainEditorFeature) mainEditorFeature.setSuppressPlaybackRangeSelectionSync(value);
  },
  isDirty: isCurrentDocumentDirty,
  confirmUnsavedChanges,
  performSaveFlow,
  getFileContentCached,
  getActiveFileEntry,
  selectTune,
  getActiveTuneId: () => activeTuneId,
  getActiveTuneIdForList: () => activeTuneId,
  getEditorScroll: () => editorView && editorView.scrollDOM ? editorView.scrollDOM.scrollTop : 0,
  setEditorScroll: (value) => { if (editorView && editorView.scrollDOM) editorView.scrollDOM.scrollTop = value; },
  getRenderScroll: () => $renderPane ? $renderPane.scrollTop : 0,
  setRenderScroll: (value) => { if ($renderPane) $renderPane.scrollTop = value; },
  setSuppressRecentEntries: (value) => { suppressRecentEntries = Boolean(value); },
  buildTuneSelectOptions,
  setStatus,
  updateFileContext,
  updateLibraryStatus,
  clearPendingRenderTimer: () => {
    if (mainEditorFeature) mainEditorFeature.clearPendingRender();
  },
  scheduleRenderNow,
  openTuneFromLibrarySelection: (selection) => {
    if (typeof window.openTuneFromLibrarySelection !== "function") return Promise.resolve(null);
    return window.openTuneFromLibrarySelection(selection);
  },
  parseMeterParts,
  computeMeasureStats: computeMeasureStatsAt,
});

// ---------------- A–B playback helpers ----------------

function getErrorEntries() {
  return errorsFeature.getEntries();
}

function isTuneErrorFilterActive() {
  return errorsFeature.isScanFilterActive();
}

function isTuneErrorScanInFlight() {
  return errorsFeature.isScanInFlight();
}

function isErrorsEnabled() {
  return errorsFeature.isEnabled();
}

function isAbPlanValid() {
  return abSelectionPlaybackController.isPlanValid();
}

function updateAbUi() {
  abSelectionPlaybackController.updateUi();
}

function clearAbPlan({ toast } = {}) {
  abSelectionPlaybackController.clearPlan({ toast });
}

function setAbPlanRange(startOffset, endOffset) {
  abSelectionPlaybackController.setRange(startOffset, endOffset);
}

function setAbPlanOptions(opts = {}) {
  abSelectionPlaybackController.setOptions(opts);
}

function toggleAbOptionsPopover() {
  abSelectionPlaybackController.toggleOptionsPopover();
}

function refreshAbOptionsUi() {
  abSelectionPlaybackController.refreshOptionsUi();
}

function getSelectionPlaybackSettings() {
  return abSelectionPlaybackController.getSelectionSettings();
}

function isFocusBoundedPlaybackScope() {
  return Boolean(isFocusModeEnabled())
    && (
      clampInt(playbackTransport.playbackLoopFromMeasure, 0, 100000, 0) > 0
      || clampInt(playbackTransport.playbackLoopToMeasure, 0, 100000, 0) > 0
    );
}

function getScopedPlaybackSettingsForOrigin(origin) {
  const settings = getSelectionPlaybackSettings();
  if (String(origin || "") !== "focus" || !isFocusBoundedPlaybackScope()) return settings;
  return {
    ...settings,
    suppressRepeats: true,
  };
}

function withScopedPlaybackOrigin(settings, origin) {
  return {
    ...(settings || {}),
    origin: String(origin || ""),
  };
}

function getSelectionPlaybackRange() {
  return abSelectionPlaybackController.getSelectionRange();
}

function withTempPlaybackFlags(flags, fn) {
  return abSelectionPlaybackController.withTempPlaybackFlags(flags, fn);
}

function setAbPoint(which) {
  abSelectionPlaybackController.setPoint(which);
}

function setAbFromSelection() {
  abSelectionPlaybackController.setFromSelection();
}

async function playAbLoop() {
  await abSelectionPlaybackController.playAbLoop();
}

async function playSelectionOnce() {
  return abSelectionPlaybackController.playSelectionOnce();
}

let diagnosticsDomain = null;
diagnosticsDomain = createDiagnosticsDomain({
  api: window.api,
  windowRef: window,
  documentRef: document,
  storage: typeof localStorage !== "undefined" ? localStorage : null,
  getLatestSettings: () => latestSettingsSnapshot,
  clampInt,
  debugDumpHost: {
    getActiveTuneMeta: () => activeTuneMeta,
    getCurrentDoc: getCurrentDocument,
    getDebugLogBuffer: () => diagnosticsDomain ? diagnosticsDomain.controller.debugLogBuffer : [],
    getRecentActions: () => diagnosticsDomain ? diagnosticsDomain.controller.recentActions : [],
    getEditorView: () => editorView,
    getHeaderDirty,
    getHeaderCollapsed,
    getEditorValue,
    getHeaderEditorValue,
    getWorkingCopySnapshot,
    getPlaybackPayload,
    getLastPlaybackPayloadCache: () => playbackTransport.lastPlaybackPayloadCache,
    getFollowPipelineVersion: () => FOLLOW_PIPELINE_VERSION,
    getIsPlaying: () => playbackTransport.isPlaying,
    getIsPaused: () => playbackTransport.isPaused,
    getWaitingForFirstNote: () => playbackTransport.waitingForFirstNote,
    getFollowPlayback: () => followPlayback,
    getFollowVoiceId: () => playbackFollowController.getFollowVoiceId(),
    getFollowVoiceIndex: () => playbackFollowController.getFollowVoiceIndex(),
    getPlaybackState: () => playbackTransport.playbackState,
    getPracticeTempoMultiplier: () => playbackTransport.practiceTempoMultiplier,
    getPlaybackLoopEnabled: () => playbackTransport.playbackLoopEnabled,
    getPlaybackLoopFromMeasure: () => playbackTransport.playbackLoopFromMeasure,
    getPlaybackLoopToMeasure: () => playbackTransport.playbackLoopToMeasure,
    getSoundfontName: () => soundfontController.getName(),
    getSoundfontSource: () => soundfontController.getSource(),
    getSoundfontReadyName: () => soundfontController.getReadyName(),
    getLastSoundfontApplied: () => soundfontController.getLastApplied(),
    getPlaybackIndexOffset: () => playbackTransport.playbackIndexOffset,
    getPlaybackRange: () => playbackTransport.playbackRange,
    getActivePlaybackRange: () => playbackTransport.activePlaybackRange,
    getActivePlaybackEndAbcOffset: () => playbackTransport.activePlaybackEndAbcOffset,
    getLastStartPlaybackIdx: () => playbackTransport.lastStartPlaybackIdx,
    getResumeStartIdx: () => playbackTransport.resumeStartIdx,
    getDesiredPlayerSpeed: () => playbackTransport.desiredPlayerSpeed,
    getCurrentPlaybackPlan: () => playbackTransport.currentPlaybackPlan,
    getPendingPlaybackPlan: () => playbackTransport.pendingPlaybackPlan,
    getLastPlaybackGuardMessage: () => playbackTransport.lastPlaybackGuardMessage,
    getLastPlaybackAbortMessage: () => playbackTransport.lastPlaybackAbortMessage,
    getLastPlaybackException: () => playbackTransport.lastPlaybackException,
    getPlaybackNoteTrace: () => playbackTransport.playbackNoteTrace,
    getPlaybackParseErrors: () => playbackTransport.playbackParseErrors,
    getPlaybackSanitizeWarnings: () => playbackTransport.playbackSanitizeWarnings,
    getLastRhythmErrorSuggestion: () => errorsFeature.getLastRhythmErrorSuggestion(),
    getLastRenderPayload: () => getLastRenderPayload(),
    getBarMismatchMarkers: () => errorsFeature.getBarMismatchMarkers(),
    getErrorEntries: () => getErrorEntries(),
    getActiveErrorHighlight: () => errorsFeature.getActiveHighlight(),
    getActiveFileEntry,
    isPayloadMode,
    computeHeaderPresence,
    buildHeaderPrefix,
    injectGchordOn,
    normalizeLeadingInlineDirectivesForPlayback,
    normalizeDollarLineBreaksForPlayback,
    normalizeBlankLinesForPlayback,
    normalizeReadableMidiDrumsForPlayback,
    sanitizeAbcForPlayback,
    clonePlaybackRange,
    clampInt,
    mkdirp,
    writeFile,
    showSaveDialog,
    showSaveError,
    showToast,
    safeBasename,
    safeDirname,
  },
});
diagnosticsDomain.install();
const devConfig = diagnosticsDomain.devConfig;
const recordDebugLog = diagnosticsDomain.recordDebugLog;
const recordRecentAction = diagnosticsDomain.recordRecentAction;
const perfNowMs = diagnosticsDomain.perfNowMs;
const isIntonationPerfEnabled = diagnosticsDomain.isIntonationPerfEnabled;
const logIntonationPerf = diagnosticsDomain.logIntonationPerf;
const isStartupPerfEnabled = diagnosticsDomain.isStartupPerfEnabled;
const logStartupPerf = diagnosticsDomain.logStartupPerf;
const isFilePerfEnabled = diagnosticsDomain.isFilePerfEnabled;
const logFilePerf = diagnosticsDomain.logFilePerf;
const isRenderPerfEnabled = diagnosticsDomain.isRenderPerfEnabled;
const logRenderPerf = diagnosticsDomain.logRenderPerf;
const reportStartupStatus = diagnosticsDomain.reportStartupStatus;
const abbreviatePathForLog = diagnosticsDomain.abbreviatePathForLog;
const scheduleAutoDump = diagnosticsDomain.scheduleAutoDump;
const scheduleAutoWcDump = diagnosticsDomain.scheduleAutoWcDump;
const toolStatusController = createToolStatusController({
  element: $toolStatus,
  api: window.api,
  showToast,
});
const toastHoverController = createToastHoverController({
  documentRef: document,
  toastElement: $toast,
  hoverElement: $hoverStatus,
  isDebugMessagesEnabled: diagnosticsDomain.isDebugMessagesEnabled,
});

// Playback transport state must be initialized before initEditor() runs (selection listeners fire early).
const playbackTransport = createPlaybackTransportState();
const playbackPayloadController = createPlaybackPayloadController({
  transport: playbackTransport,
  selectionRuntime: selectionPlaybackRuntime,
  getEditorText: getEditorValue,
  getActiveEntryHeader: () => {
    const entry = chordProFeature.isEnabled() ? null : getActiveFileEntry();
    return entry ? getHeaderEditorValue() : "";
  },
  buildHeaderPrefix,
  countLinesForPrefix,
  isChordProEnabled: () => chordProFeature.isEnabled(),
  isChordProFullView: () => chordProFeature.isFullView(),
  chordProHasBlocks: () => chordProFeature.hasBlocks(),
  isPayloadMode,
  isPlaybackPayloadView: () => payloadModeFeature.isPlaybackView(),
  getExpandRepeats: () => window.__abcarusPlaybackExpandRepeats === true,
  detectMeterMismatchInBarlines,
  detectRepeatMarkerAfterShortBar,
  neutralizeMidiDrumDirectivesForPlayback,
  assertCleanAbcText,
  showToast,
});
const playbackPrepareController = createPlaybackPrepareController({
  windowRef: window,
  transport: playbackTransport,
  selectionRuntime: selectionPlaybackRuntime,
  ensureSoundfontReady,
  ensurePlayer,
  getAbcCtor,
  getPlaybackPayload,
  getPlaybackSourceKey,
  buildPlaybackState,
  setFollowVoiceFromPlayback,
  clearErrors,
  setStatus,
  showToast,
  logErr,
  addError,
  setErrorLineOffsetFromHeader,
  setErrorsLineOffset: (lineOffset) => errorsFeature.setLineOffset(lineOffset),
  parseErrorLocation,
  scheduleAutoDump,
  assertCleanAbcText,
  neutralizeMidiDrumDirectivesForPlayback,
  isMidiDrumMustBeInVoicePlaybackError,
  hasMidiDrumMustBeInVoicePlaybackError,
  shouldRelocateMidiDrumsForPlayback,
  normalizeAccThreeQuarterToneForAbc2svg,
  isChordProFullView: () => chordProFeature.isFullView(),
});
const playbackStartController = createPlaybackStartController({
  transport: playbackTransport,
  selectionRuntime: selectionPlaybackRuntime,
  getEditorView: () => editorView,
  getPlaybackRange: () => playbackTransport.playbackRange,
  setPlaybackRange,
  clonePlaybackRange,
  getPlaybackSourceKey,
  preparePlayback,
  ensureSoundfontReady,
  stopPlaybackForRestart,
  stopPlaybackFromGuard,
  recordDebugLog,
  scheduleAutoDump,
  setStatus,
  updatePlayButton,
  clearNoteSelection,
  resetPlaybackUiState,
  setSoundfontCaption,
  showToast,
  updatePracticeUi,
  getScopedPlaybackSettingsForOrigin,
  withScopedPlaybackOrigin,
  getStripChordSymbols: () => window.__abcarusPlaybackStripChordSymbols === true,
  toDerivedOffset,
  toEditorOffset,
  findSymbolAtOrAfter,
  findSymbolAtOrBefore,
  findMeasureIndex,
  isFollowPlaybackEnabled: () => followPlayback,
  getDebugParts: () => window.__abcarusDebugParts === true,
});
const playbackTransportController = createPlaybackTransportController({
  transport: playbackTransport,
  selectionRuntime: selectionPlaybackRuntime,
  getEditorView: () => editorView,
  getEditorText: getEditorValue,
  findMeasureStartOffsetByNumber,
  getFocusModeEnabled: isFocusModeEnabled,
  normalizeFocusLoopBoundsForPlayback,
  computeFocusPlaybackPlanFromCurrentState,
  startPlaybackFromRange,
  startPlaybackAtIndex,
  pausePlayback,
  playSelectionOnce,
  setPracticeBarHighlight,
  clearSvgPracticeBarHighlight,
  playbackGuardError: (message) => {
    if (playbackUiController) playbackUiController.reportPlaybackGuardError(message);
  },
  stopPlaybackFromGuard,
  setStatus,
  updatePlayButton,
  clearNoteSelection,
  resetPlaybackUiState,
  setSoundfontCaption,
  showToast,
});
const followHighlightSettings = createFollowHighlightSettings({
  documentRef: document,
  clampNumber,
});
const scoreHighlightController = createScoreHighlightController({
  documentRef: document,
  getOutElement: () => $out,
  getRenderPane: () => $renderPane,
  getEditorView: () => editorView,
  clampNumber,
  getFollowPlayheadPad: followHighlightSettings.getPlayheadPad,
  getFollowPlayheadWidth: followHighlightSettings.getPlayheadWidth,
  getFollowPlayheadShift: followHighlightSettings.getPlayheadShift,
  findMeasureRangeAt,
  mapEditorOffsetToRenderIdx,
  requestAnimationFrameRef: (callback) => requestAnimationFrame(callback),
  getFollowEnabled: () => followPlayback,
  isRawMode: () => isRawModeActive(),
  isPlaying: () => playbackTransport.isPlaying,
  scrollToNote: (element) => maybeScrollRenderToNote(element),
});
const practiceBarHighlightController = createPracticeBarHighlightController({
  getOutElement: () => $out,
  getRenderPane: () => $renderPane,
  getEditorView: () => editorView,
  findMeasureRangeAt,
  mapEditorOffsetToRenderIdx,
});
const practiceBarHighlightPlugin = practiceBarHighlightController.plugin;
const playbackAutoScrollController = createPlaybackAutoScrollController({
  windowRef: window,
  consoleRef: console,
  getRenderPane: () => $renderPane,
  getOutElement: () => $out,
  getPlayheadElement: () => scoreHighlightController.getSvgPlayheadElement(),
  isPlaybackBusy,
  clampNumber,
  getRenderZoomFactor,
  isDebugEnabled: () => Boolean(window.__abcarusDebugAutoscroll),
});
const playbackFollowController = createPlaybackFollowController({
  windowRef: window,
  transport: playbackTransport,
  getEditorView: () => editorView,
  getOutElement: () => $out,
  getRenderPane: () => $renderPane,
  getFollowPlaybackEnabled: () => followPlayback,
  getFocusModeEnabled: isFocusModeEnabled,
  clearSvgPlayhead,
  clearSvgFollowBarHighlight,
  clearSvgFollowMeasureHighlight,
  clearSvgPracticeBarHighlight,
  setPracticeBarHighlight,
  findSymbolAtOrBefore,
  upperBoundTime,
  snapIstartToPlayable,
  mapEditorOffsetToRenderIdx,
  mapRenderIdxToEditorOffset,
  findNearestNoteHighlightElements,
  pickClosestNoteElement,
  extractRenderIdxFromElementClass,
  findNearestBarElForNote,
  setSvgPlayheadFromElements,
  highlightSvgFollowMeasureForNote,
  maybeAutoScrollRenderToCursor,
  cancelPlaybackAutoScroll,
});
const playbackPlayerController = createPlaybackPlayerController({
  windowRef: window,
  transport: playbackTransport,
  selectionRuntime: selectionPlaybackRuntime,
  getEditorView: () => editorView,
  getFocusModeEnabled: isFocusModeEnabled,
  getFollowPlaybackEnabled: () => followPlayback,
  getSoundfontSource: () => soundfontController.getSource(),
  setSuppressPlaybackRangeSelectionSync: (next) => {
    if (mainEditorFeature) mainEditorFeature.setSuppressPlaybackRangeSelectionSync(next);
  },
  applyPlaybackPlanSpeed,
  startPlaybackFromRange,
  updatePracticeUi,
  setStatus,
  updatePlayButton,
  clearNoteSelection,
  clearPlaybackNoteOnEls,
  clearSvgPlayhead,
  clearSvgFollowBarHighlight,
  clearSvgFollowMeasureHighlight,
  resetPlaybackUiState,
  setSoundfontCaption,
  findSymbolAtOrBefore,
  toEditorOffset,
  appendPlaybackTrace,
  stopPlaybackFromGuard,
  schedulePlaybackUiUpdate,
  logErr,
});
const drumPreviewController = createDrumPreviewController({
  transport: playbackTransport,
  velocityToDynamic,
  ensureSoundfontLoaded,
  ensurePlayer,
  getAbcCtor,
  getSoundfontSource: () => soundfontController.getSource(),
  stopPlaybackForRestart,
  updatePlayButton,
  logErr,
  windowRef: window,
});
function getSortedErrorsForNav() {
  return errorsFeature.getSortedErrorsForNav ? errorsFeature.getSortedErrorsForNav() : [];
}

function syncActiveErrorNavIndex(sortedItemsArg) {
  errorsFeature.syncActiveNavIndex(sortedItemsArg);
}

async function activateErrorByNav(delta) {
  await errorsFeature.activateByNav(delta);
}

function clearActiveErrorHighlight(reason) {
  errorsFeature.clearActiveHighlight(reason);
}

function setActiveErrorHighlight(entry, from, to) {
  errorsFeature.setActiveHighlight(entry, from, to);
}

function clearErrorsFeatureState() {
  errorsFeature.clearFeatureState();
}

function updateErrorsFeatureUI() {
  errorsFeature.updateFeatureUi();
}

function setErrorsEnabled(next, { triggerRefresh = false } = {}) {
  errorsFeature.setEnabled(next, { triggerRefresh });
}

const errorActivationHighlightPlugin = errorsFeature.plugins.activationHighlight;

function clearSvgErrorActivationHighlight() {
  errorsFeature.clearSvgHighlight();
}

function clearSvgPracticeBarHighlight() {
  return practiceBarHighlightController.clearSvgPracticeBarHighlight();
}

function clearSvgFollowBarHighlight() {
  return scoreHighlightController.clearSvgFollowBarHighlight();
}

function clearSvgFollowMeasureHighlight() {
  return scoreHighlightController.clearSvgFollowMeasureHighlight();
}

function clearSvgPlayhead() {
  return scoreHighlightController.clearSvgPlayhead();
}

function findNearestBarElForNote(noteEl) {
  return scoreHighlightController.findNearestBarElForNote(noteEl);
}

	function highlightSvgFollowMeasureForNote(noteEl, barEl) {
	  return scoreHighlightController.highlightSvgFollowMeasureForNote(noteEl, barEl);
}

function highlightSvgFollowBarAtEditorOffset(editorOffset) {
  return scoreHighlightController.highlightSvgFollowBarAtEditorOffset(editorOffset);
}

	function setSvgPlayheadFromElements(noteEl, preferredBarEl) {
	  return scoreHighlightController.setSvgPlayheadFromElements(noteEl, preferredBarEl);
}

function highlightSvgAtEditorOffset(editorOffset) {
  return errorsFeature.highlightSvgAtEditorOffset(editorOffset);
}

// ---------------------------------------------------------------------------
// A–B playback (Issue #21, MVP)
// ---------------------------------------------------------------------------

const MIN_PANE_WIDTH = 220;
const MIN_RIGHT_PANE_WIDTH = 220;
const MIN_RIGHT_PANE_HEIGHT = 180;
const MIN_ERROR_PANE_HEIGHT = 120;
const USE_ERROR_OVERLAY = true;
let settingsDomain = null;
let disclaimerShown = false;
let libraryUiStateController = null;
const layoutController = createLayoutController({
  main: $main,
  divider: $divider,
  sidebar: $sidebar,
  rightSplit: $rightSplit,
  splitDivider: $splitDivider,
  editorPane: $editorPane,
  renderPane: $renderPane,
  output: $out,
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
  getLatestSettings: () => latestSettingsSnapshot,
  isNormalModeForSplitToggle,
  isRawMode: () => isRawModeActive(),
  getSidebarWidth: () => libraryUiStateController ? libraryUiStateController.getLastSidebarWidth() : 280,
  setSidebarWidth: (value) => { if (libraryUiStateController) libraryUiStateController.setLastSidebarWidth(value); },
  saveLibraryPrefs: (patch) => { if (libraryUiStateController) libraryUiStateController.scheduleSaveLibraryPrefs(patch); },
  saveLayoutPrefs: async (patch) => {
    if (!window.api || typeof window.api.updateSettings !== "function") return;
    await window.api.updateSettings(patch);
  },
  showToast,
});

focusModeController = createFocusModeController({
  elements: {
    focusButton: $btnFocusMode,
    practiceTempoWrap: $practiceTempoWrap,
    practiceTempo: $practiceTempo,
    practiceFocusRangeGroup: $practiceFocusRangeGroup,
    practiceFocusOptionsGroup: $practiceFocusOptionsGroup,
    practiceFocusVoicesGroup: $practiceFocusVoicesGroup,
    practiceSelectionGroup: $practiceSelectionGroup,
    practiceLoopWrap: $practiceLoopWrap,
    practiceLoopEnabled: $practiceLoopEnabled,
    practiceLoopFrom: $practiceLoopFrom,
    practiceLoopTo: $practiceLoopTo,
    selectionSuppressWrap: $selectionSuppressWrap,
    selectionSuppressEnabled: $selectionSuppressEnabled,
    selectionGchordsWrap: $selectionGchordsWrap,
    selectionGchordsEnabled: $selectionGchordsEnabled,
    selectionDrumsWrap: $selectionDrumsWrap,
    selectionDrumsEnabled: $selectionDrumsEnabled,
    selectionMutedWrap: $selectionMutedWrap,
    selectionMutedVoices: $selectionMutedVoices,
    selectionLoopWrap: $selectionLoopWrap,
    selectionLoopEnabled: $selectionLoopEnabled,
  },
  transport: playbackTransport,
  getSettings: () => latestSettingsSnapshot,
  getActiveTuneId: () => activeTuneId,
  getLibraryVisible: () => isLibraryVisible,
  isRawModeActive: () => isRawModeActive(),
  isPlaybackBusy,
  isFocusBoundedPlaybackScope,
  getEditorView: () => editorView,
  getEditorText: getEditorValue,
  getRenderMeasureIndex,
  getRenderCompatMap,
  mapRenderIdxToEditorOffset,
  getOutputElement: () => $out,
  getRenderPane: () => $renderPane,
  getScopedPlaybackSettingsForOrigin,
  findMeasureStartOffsetByNumber: findMeasureStartOffsetByNumberInPrimaryVoice,
  clampInt,
  readRenderZoom: readRenderZoomCss,
  setRenderZoom: setRenderZoomCss,
  computeFocusFitZoom,
  setLibraryVisible,
  resetRightPaneSplit: () => layoutController.resetRightPaneSplit(),
  syncPendingPlaybackPlan,
  clearNormalPlaybackPlan: () => {
    if (mainEditorFeature) mainEditorFeature.setPendingPlaybackRangeOrigin(null);
    playbackTransport.pendingPlaybackPlan = null;
    playbackTransport.currentPlaybackPlan = null;
  },
  persistLoopSettingsPatch,
  showToast,
});

function isNormalModeForSplitToggle() {
  return !isRawModeActive() && !isFocusModeEnabled();
}

let libraryIndex = null;
let suppressRecentEntries = false;
let renderPayloadController = null;
let renderPipelineController = null;
const FOLLOW_PIPELINE_VERSION = "follow-2026-02-21-r3";
let headerLayersController = null;
const fileContentCache = createFileContentCache({
  maxEntries: 12,
  normalizePath: normalizeLibraryPath,
});
const fileOperationLocks = createFileOperationLocks({
  normalizePath: normalizeLibraryPath,
});

headerLayersController = createHeaderLayersController({
  api: window.api,
  elements: {
    toggleButton: $btnToggleGlobals,
  },
  readFile,
  getActiveFilePath: () => activeFilePath,
  isMeasureCheckEnabled,
  scheduleRender: () => scheduleRenderNow(),
  setButtonText,
});

renderPayloadController = createRenderPayloadController({
  getEditorText: getEditorValue,
  getActiveFileEntry,
  getHeaderText: getHeaderEditorValue,
  isPayloadMode,
  isChordProEnabled: () => chordProFeature.isEnabled(),
  isChordProFullView: () => chordProFeature.isFullView(),
  computePayloadTuneOffset,
  countLinesForPrefix,
  sanitizeHeaderText: sanitizeFileHeaderForInteractiveRender,
  buildHeaderPrefix,
  assertCleanAbcText,
});

function getRenderCompatMap() {
  return getRenderCompatMapFromPayload(getLastRenderPayload());
}

function getLastRenderPayload() {
  return renderPipelineController ? renderPipelineController.getLastPayload() : null;
}

function mapSourceOffsetToRenderOffset(offset, compatMap = getRenderCompatMap()) {
  return mapSourceOffsetToRenderOffsetCore(offset, compatMap);
}

function mapRenderOffsetToSourceOffset(offset, compatMap = getRenderCompatMap()) {
  return mapRenderOffsetToSourceOffsetCore(offset, compatMap);
}

function mapEditorOffsetToRenderIdx(editorOffset, payload = getLastRenderPayload()) {
  return mapEditorOffsetToRenderIdxCore(editorOffset, payload);
}

function mapRenderIdxToEditorOffset(renderIdx, payload = getLastRenderPayload()) {
  return mapRenderIdxToEditorOffsetCore(renderIdx, payload);
}

function normalizeFileContentCacheKey(filePath) {
  return fileContentCache.normalizeKey(filePath);
}

function getFileContentFromCache(filePath) {
  return fileContentCache.get(filePath);
}

function setFileContentInCache(filePath, content) {
  fileContentCache.set(filePath, content);
}

function countLinesForPrefix(text) {
  const src = String(text || "");
  if (!src.trim()) return 0;
  const trimmed = src.replace(/[\r\n]+$/, "");
  return trimmed ? trimmed.split(/\r\n|\n|\r/).length : 0;
}

workingCopyRuntimeController = createWorkingCopyRuntimeController({
  api: window.api,
  state: {
    getActiveTuneMeta: () => activeTuneMeta,
    isCurrentDocumentDirty,
    isFilePerfEnabled,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    logErr,
    logFilePerf,
    perfNowMs,
    recordRecentAction,
    renderUnifiedStatus,
    safeBasename,
    scheduleRenderLibraryTree,
    scheduleWorkingCopyTuneSync,
  },
  utils: {
    normalizeLibraryPath,
    pathsEqual,
  },
});

function getWorkingCopySnapshot() {
  return workingCopyRuntimeController ? workingCopyRuntimeController.getSnapshot() : null;
}

function markDiskConflictPath(filePath, hasConflict) {
  if (workingCopyRuntimeController) workingCopyRuntimeController.markDiskConflictPath(filePath, hasConflict);
}

function hasDiskConflictPath(filePath) {
  return workingCopyRuntimeController ? workingCopyRuntimeController.hasDiskConflictPath(filePath) : false;
}

async function refreshWorkingCopySnapshot() {
  return workingCopyRuntimeController ? workingCopyRuntimeController.refreshSnapshot() : null;
}

async function ensureWorkingCopyOpenForPath(filePath) {
  return workingCopyRuntimeController ? workingCopyRuntimeController.ensureOpenForPath(filePath) : false;
}

function scheduleLazyWorkingCopyOpenForActiveFile(filePath, reason = "selectTune") {
  if (workingCopyRuntimeController) workingCopyRuntimeController.scheduleLazyOpenForActiveFile(filePath, reason);
}

const workingCopyConflictController = createWorkingCopyConflictController({
  api: window.api,
  state: {
    getRawMode: () => isRawModeActive(),
  },
  actions: {
    attachTuneUidsToLibraryFile,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    recordNavFilePath,
    safeBasename,
    safeDirname,
    selectTune,
    switchWorkingCopyFileContext: (filePath, options = {}) => {
      if (options && options.rawMode) {
        documentLifecycleController.beginRawFullFileContext(filePath, options.source || "working_copy");
        setRawModeFilePath(filePath);
      } else {
        activeFilePath = filePath || null;
      }
    },
    setDirtyIndicator,
    setEditorValueClean: (text) => {
      suppressDirty = true;
      try {
        setEditorValue(text);
      } finally {
        suppressDirty = false;
      }
    },
    setFileContentInCache,
    setFileNameMeta,
    setHeaderClean: markHeaderClean,
    setHeaderEditorValueClean: (text) => fileHeaderController.setEditorValueClean(text),
    setRawModeFilePath,
    setRawModeHeaderEndOffset,
    stripFileExtension,
    updateHeaderStateUI,
    patchCurrentDocument,
    markDiskConflictPath,
    splitFileIntoHeaderAndBody,
    withFileLock,
  },
  utils: {
    pathsEqual,
  },
});

async function confirmReloadFromDisk(filePath) {
  return workingCopyConflictController.confirmReloadFromDisk(filePath);
}

async function resolveWorkingCopySaveConflictDefault(filePath, options = {}) {
  return workingCopyConflictController.resolveWorkingCopySaveConflictDefault(filePath, options);
}

async function discardAndReloadWorkingCopyFromDisk(filePath, options = {}) {
  return workingCopyConflictController.discardAndReloadWorkingCopyFromDisk(filePath, options);
}

async function saveWorkingCopyCopyAsAndSwitch(sourcePath, options = {}) {
  return workingCopyConflictController.saveWorkingCopyCopyAsAndSwitch(sourcePath, options);
}

let workingCopySyncController = null;

function scheduleWorkingCopyTuneSync() {
  if (workingCopySyncController) workingCopySyncController.scheduleTuneSync();
}

function scheduleWorkingCopyFullSync() {
  if (workingCopySyncController) workingCopySyncController.scheduleFullSync();
}

function tryResolveActiveTuneUidFromWorkingCopySnapshot() {
  return workingCopySyncController
    ? workingCopySyncController.tryResolveActiveTuneUidFromSnapshot()
    : false;
}

async function flushWorkingCopyTuneSync() {
  return workingCopySyncController
    ? workingCopySyncController.flushTuneSync()
    : { ok: false, error: "Working copy sync controller is unavailable." };
}

function resetWorkingCopyTuneSyncDebounce() {
  if (workingCopySyncController) workingCopySyncController.resetTuneSyncDebounce();
}

async function flushWorkingCopyFullSync() {
  return workingCopySyncController ? workingCopySyncController.flushFullSync() : undefined;
}

async function discardWorkingCopyChangesForActiveFile() {
  return workingCopySyncController
    ? workingCopySyncController.discardChangesForActiveFile()
    : false;
}

function reloadActiveTuneTextFromWorkingCopySnapshot() {
  return workingCopySyncController
    ? workingCopySyncController.reloadActiveTuneTextFromSnapshot()
    : false;
}

function syncLibraryFileFromWorkingCopySnapshot(filePath, snapshot) {
  return libraryMetadataController.syncLibraryFileFromWorkingCopySnapshot(filePath, snapshot);
}

function attachTuneUidsToLibraryFile(filePath, snapshot) {
  return libraryMetadataController.attachTuneUidsToLibraryFile(filePath, snapshot);
}

function resolveTuneEntryFromSnapshot(snapshot, { tuneUid, tuneIndex, startOffset } = {}) {
  return workingCopySyncController
    ? workingCopySyncController.resolveTuneEntryFromSnapshot(snapshot, { tuneUid, tuneIndex, startOffset })
    : null;
}
let activeTuneId = null;
let activeTuneUid = null;
let activeTuneIndex = null;
let activeTuneMeta = null;
let activeFilePath = null;
const MAX_NAV_FILE_HISTORY = 20;
const navFileHistory = [];
let isLibraryVisible = true;
let latestSettingsSnapshot = null;

libraryDocumentContext = createLibraryDocumentContext({
  clearSaveSession,
  markActiveTuneButton,
  markCurrentDocumentClean,
  setActiveFilePath: (value) => { activeFilePath = value; },
  setActiveTuneId: (value) => { activeTuneId = value; },
  setActiveTuneIndex: (value) => { activeTuneIndex = value; },
  setActiveTuneMeta: (value) => { activeTuneMeta = value; },
  setActiveTuneText,
  setActiveTuneUid: (value) => { activeTuneUid = value; },
  setCurrentDocument,
  setDirtyIndicator,
});

workingCopySyncController = createWorkingCopySyncController({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getChordProFullText: () => chordProFeature.getFullText(),
    getCurrentDocumentPath,
    getRawMode: () => isRawModeActive(),
    getWorkingCopySnapshot,
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFullView: () => chordProFeature.isFullView(),
    isPayloadMode,
  },
  actions: {
    ensureXNumberInAbc,
    getEditorValue,
    markCurrentDocumentClean,
    patchCurrentDocument,
    pathsEqual,
    refreshWorkingCopySnapshot,
    setActiveTuneIndex: (value) => { activeTuneIndex = Number.isFinite(Number(value)) ? Number(value) : null; },
    setActiveTuneMetaOffsets: (start, end) => {
      if (!activeTuneMeta) return;
      activeTuneMeta.startOffset = Number(start);
      activeTuneMeta.endOffset = Number(end);
    },
    setActiveTuneUid: (value) => {
      activeTuneUid = value ? String(value) : null;
      if (activeTuneMeta) activeTuneMeta.tuneUid = activeTuneUid || "";
    },
    setDirtyIndicator,
    setEditorValueClean: (text) => {
      suppressDirty = true;
      setEditorValue(text);
      suppressDirty = false;
    },
    setFileContentInCache,
  },
});

saveFlowController = createSaveFlowController({
  api: window.api,
  SAVE_INTENT,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocument,
    getCurrentDocumentPath,
    getFocusModeEnabled: isFocusModeEnabled,
    getHeaderDirty,
    getHeaderEditorValue,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getLibraryIndex: () => libraryIndex,
    getRawMode: () => isRawModeActive(),
    getWorkingCopySnapshot,
    getChordProFullText: () => chordProFeature.getFullText(),
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFullView: () => chordProFeature.isFullView(),
    isPayloadMode,
    resolveSaveSession,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    createNewFileAtPath,
    flushWorkingCopyFullSync,
    flushWorkingCopyTuneSync,
    getDefaultSaveDir,
    getEditorValue,
    getSuggestedBaseName,
    ensureWorkingCopyOpenForPath,
    isHeaderEditorFilePath,
    isWorkingCopyOpenForFile,
    loadLibraryFileIntoEditor,
    loadLibraryFromFolder,
    markCurrentDocumentClean,
    markDiskConflictPath,
    markHeaderClean,
    normalizeLibraryPath,
    patchCurrentDocument,
    pathsEqual,
    performAppendFlow,
    performRawSaveFlow,
    reconcileActiveTuneAfterSave: (filePath, updatedFile) =>
      libraryLifecycleController.reconcileActiveTuneAfterSave(filePath, updatedFile),
    recordNavFilePath,
    recordRecentAction,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    resetHeaderEditorFilePath,
    resetTransposePreviewState,
    resolveWorkingCopySaveConflictDefault,
    safeBasename,
    safeDirname,
    scheduleAutoWcDump,
    scheduleRenderLibraryTree,
    selectTune,
    serializeDocument,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setDirtyIndicator,
    setFileContentInCache,
    setFileNameMeta,
    setStatus,
    showSaveDialog,
    showSaveError,
    showToastWithAction,
    stripFileExtension,
    tryResolveActiveTuneUid: tryResolveActiveTuneUidFromWorkingCopySnapshot,
    updateFileHeaderPanel,
    updateHeaderStateUI,
    updateLibraryStatus,
    updateWindowTitle,
    withFileLock,
  },
});

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
  setStatus,
});

const libraryUiDomain = createLibraryUiDomain({
  api: window.api,
  documentRef: document,
  windowRef: window,
  navigatorRef: navigator,
  elements: {
    main: $main,
    libraryTree: $libraryTree,
    libraryRoot: $libraryRoot,
    tuneSelect: $fileTuneSelect,
    librarySearch: $librarySearch,
    groupBy: $groupBy,
    sortBy: $sortBy,
    sortTunesBy: $sortTunesBy,
    moveTuneModal: $moveTuneModal,
    moveTuneClose: $moveTuneClose,
    moveTuneCancel: $moveTuneCancel,
    moveTuneTarget: $moveTuneTarget,
    moveTuneApply: $moveTuneApply,
    xIssuesModal: $xIssuesModal,
    xIssuesInfo: $xIssuesInfo,
    xIssuesClose: $xIssuesClose,
    xIssuesCopy: $xIssuesCopy,
    xIssuesJump: $xIssuesJump,
    xIssuesAutoFix: $xIssuesAutoFix,
  },
  state: {
    getLibraryVisible: () => isLibraryVisible,
    setLibraryVisibleState: (value) => { isLibraryVisible = Boolean(value); },
    isLibraryDisabled: () => chordProFeature.isEnabled(),
    getLibraryIndex: () => libraryIndex,
    getActiveFilePath: () => activeFilePath,
    setActiveFilePath: (filePath) => { activeFilePath = filePath || null; },
    getActiveTuneId: () => activeTuneId,
    getActiveTuneUid: () => activeTuneUid,
    getActiveTuneMeta: () => activeTuneMeta,
    getCurrentDocDirty: isCurrentDocumentDirty,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    isPayloadMode,
    isRawMode: () => isRawModeActive(),
  },
  actions: {
    addTuneToSetList: (tuneId, options = {}) => setListFeature.addTuneById(tuneId, options),
    buildTemplatesPreviewContextMenuItems: (target) => templatesFeature.buildPreviewContextMenuItems(target),
    confirmReloadFromDisk,
    copyTuneById,
    deleteTuneById,
    discardAndReloadWorkingCopyFromDisk,
    duplicateTuneById,
    enableDraggableModal,
    ensureFullLibraryIndex,
    ensureSafeToAbandonCurrentDoc,
    ensureXNumberInAbc,
    fileExists,
    findTuneById,
    getActiveEditorFilePath: () => (activeTuneMeta && activeTuneMeta.path)
      ? String(activeTuneMeta.path || "")
      : getCurrentDocumentPath(),
    getActiveEditFilePath,
    getClipboardTune,
    getEditorView: () => editorView,
    getNextXNumber,
    getTuneText,
    hasDiskConflictPath,
    hasFullLibraryIndex,
    hasGlobalUnsavedChanges,
    hasUnsavedChangesForFile,
    handleTemplatesContextMenuAction: (action, target) => templatesFeature.handleContextMenuAction(action, target),
    isWorkingCopyOpenForFile,
    loadLibraryFromFolder,
    moveTuneToFile: (tuneId, targetPath) => pasteMoveTuneAction.moveTuneToFile(tuneId, targetPath),
    openTuneFromLibrarySelection,
    pasteClipboardToFile,
    pinHoverStatus,
    markDiskConflictPath,
    refreshLibraryFile,
    refreshLibraryIndex,
    refreshWorkingCopySnapshot,
    renderBufferStatus,
    renameFile,
    renameLibraryFile,
    requestLoadLibraryFile,
    resetRightPaneSplit: () => layoutController.resetRightPaneSplit(),
    restoreHoverStatus,
    renumberXInActiveFile,
    safeDirname,
    scheduleSaveLibraryPrefs,
    selectTune,
    setPaneSizes: (leftWidth) => layoutController.setPaneSizes(leftWidth),
    setFileContentInCache,
    setStatus,
    showContextMenuAt,
    showHoverStatus,
    showOpenFolderDialog,
    showSaveError,
    showToast,
    syncLibraryFileFromWorkingCopySnapshot,
    updateFileHeaderPanel,
    updateLibraryStatus,
    withFileLock,
    withFileLocks,
    appendTuneTextToFileUnlocked,
    confirmAppendToFile,
  },
  utils: {
    pathsEqual,
    safeBasename,
  },
  constants: {
    MIN_PANE_WIDTH,
  },
});
libraryShellController = libraryUiDomain.shellController;
libraryUiStateController = libraryUiDomain.uiStateController;
const libraryActions = libraryUiDomain.actions;
const libraryTreeView = libraryUiDomain.treeView;
const libraryContextMenu = libraryUiDomain.contextMenu;
window.libraryActions = libraryActions;
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
const goToMeasureModalController = createGoToMeasureModalController();
const measureNavigationController = createMeasureNavigationController({
  getEditorView: () => editorView,
  getEditorText: getEditorValue,
  getRenderPayload,
  getAbcCtor,
  neutralizeMidiDrumDirectives: neutralizeMidiDrumDirectivesForPlayback,
  mapEditorOffsetToRenderIdx,
  mapRenderIdxToEditorOffset,
  promptMeasureNumber: () => goToMeasureModalController.prompt(),
  isRawMode: () => isRawModeActive(),
  isPlaybackBusy,
  setStatus,
  showToast,
  setPracticeBarHighlight,
  highlightSvgPracticeBarAtEditorOffset,
  getSvgPracticeBarElements: () => practiceBarHighlightController.getSvgPracticeBarElements(),
  pickClosestNoteElement,
  maybeScrollRenderToNote,
  highlightSvgAtEditorOffset,
  setTransportPlayheadOffset: (pos) => { playbackTransport.transportPlayheadOffset = pos; },
  syncPendingPlaybackPlan,
  setTransportJumpHighlightActive: (active) => {
    playbackTransport.transportJumpHighlightActive = Boolean(active);
    playbackTransport.suppressTransportJumpClearOnce = Boolean(active);
  },
  debugWindow: window,
});

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
    {
      const docPath = getCurrentDocumentPath();
      if (docPath) return docPath;
    }
  } catch {}
  return "";
}

function clearSaveSession() {
  if (documentSessionController) documentSessionController.clearSaveSession();
}

function setSaveSession(next) {
  if (documentSessionController) documentSessionController.setSaveSession(next);
}

function resolveSaveSession() {
  return documentSessionController
    ? documentSessionController.resolveSaveSession()
    : { intent: SAVE_INTENT.NONE, targetPath: "", targetTuneUid: "", source: "none" };
}

function hasFullLibraryIndex() {
  return libraryMetadataController.hasFullLibraryIndex();
}

async function ensureFullLibraryIndex({ reason = "" } = {}) {
  return libraryMetadataController.ensureFullLibraryIndex({ reason });
}

function scheduleSaveLibraryPrefs(patch) {
  libraryUiDomain.scheduleSaveLibraryPrefs(patch);
}

function scheduleSaveLibraryUiState() {
  libraryUiDomain.scheduleSaveLibraryUiState();
}

async function restoreLibraryTuneSelection(selection) {
  return libraryUiDomain.restoreLibraryTuneSelection(selection);
}

async function flushLibraryPrefsSave() {
  await libraryUiDomain.flushLibraryPrefsSave();
}

function updateLibraryRootUI() {
  libraryUiDomain.updateLibraryRootUI();
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
  errorsFeature.setTuneErrorCount(tuneId, count);
}

function clearErrorIndexForFile(entry) {
  errorsFeature.clearIndexForFile(entry);
}

function updateLibraryErrorIndexFromCurrentErrors() {
  errorsFeature.updateIndexFromCurrentErrors(activeTuneId);
}

const statusController = createStatusController({
  documentRef: document,
  statusElement: $status,
  bufferStatusElement: $bufferStatus,
  fileNameMetaElement: $fileNameMeta,
  editorPaneElement: $editorPane,
  safeBasename,
  safeDirname,
  untitledLabel: UNTITLED_UNSAVED_LABEL,
  formatPathTail,
  getCurrentDoc: getCurrentDocument,
  getRawMode: () => isRawModeActive(),
  getRawModeFilePath,
  getActiveFilePath: () => activeFilePath,
  getActiveTuneMeta: () => activeTuneMeta,
  getIsNewTuneDraft: () => isNewTuneDraft,
  getHeaderDirty,
  getLibraryRoot: () => (libraryIndex && libraryIndex.root ? String(libraryIndex.root) : ""),
  getLibraryVisible: () => isLibraryVisible,
  hasDiskConflictPath,
});

const startupController = createStartupController({
  api: window.api,
  requestAnimationFrameRef: requestAnimationFrame,
  getLibraryRoot: () => (libraryIndex && libraryIndex.root ? String(libraryIndex.root) : ""),
  pathsEqual,
  loadLibraryFromFolder,
  openRecentTune,
  openRecentFile,
  openRecentFolder,
  applyInitialLayout: () => layoutController.applyRightSplitSizesFromRatio({ rawMode: isRawModeActive() }),
  centerRenderPane: centerRenderPaneOnCurrentAnchor,
  reportStartupStatus,
  markRecentOpenStarted: () => statusController.markStartupRecentOpenStarted(),
  markUiReady: () => statusController.markStartupUiReady(),
  renderStatus: () => statusController.renderUnifiedStatus(),
});

editStateController = createEditStateController({
  elements: {
    dirtyIndicator: $dirtyIndicator,
    libraryTree: $libraryTree,
  },
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneMeta: () => activeTuneMeta,
    getCurrentDoc: getCurrentDocument,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getRawMode: () => isRawModeActive(),
    getWorkingCopySnapshot,
  },
  actions: {
    renderUnifiedStatus: () => renderUnifiedStatus(),
    updateWindowTitle: () => updateWindowTitle(),
  },
  utils: {
    pathsEqual,
  },
});

fileOperationGuard = createFileOperationGuard({
  state: {
    getActiveEditFilePath,
    getWorkingCopySnapshot,
    hasGlobalUnsavedChanges,
  },
  actions: {
    showSaveError,
  },
  utils: {
    pathsEqual,
  },
});

playbackUiController = createPlaybackUiController({
  elements: {
    renderPane: $renderPane,
    playButton: $btnPlay,
    pauseButton: $btnPause,
    playPauseButton: $btnPlayPause,
    stopButton: $btnStop,
    resetLayoutButton: $btnResetLayout,
    focusModeButton: $btnFocusMode,
    toggleLibraryButton: $btnToggleLibrary,
    libraryRefreshButton: $btnLibraryRefresh,
    libraryClearFilterButton: $btnLibraryClearFilter,
    groupBySelect: $groupBy,
    sortBySelect: $sortBy,
    sortTunesBySelect: $sortTunesBy,
    librarySearchInput: $librarySearch,
    tuneSelect: $fileTuneSelect,
    fileNewButton: $btnFileNew,
    fileOpenButton: $btnFileOpen,
    fileSaveButton: $btnFileSave,
    fileCloseButton: $btnFileClose,
    toggleRawButton: $btnToggleRaw,
    toggleErrorsButton: $btnToggleErrors,
    toggleFollowButton: $btnToggleFollow,
    toggleGlobalsButton: $btnToggleGlobals,
    fileHeaderToggle: $fileHeaderToggle,
    fileHeaderSaveButton: $fileHeaderSave,
    fileHeaderReloadButton: $fileHeaderReload,
    practiceTempoInput: $practiceTempo,
    practiceLoopEnabled: $practiceLoopEnabled,
    practiceLoopFrom: $practiceLoopFrom,
    practiceLoopTo: $practiceLoopTo,
    selectionSuppressEnabled: $selectionSuppressEnabled,
    selectionGchordsEnabled: $selectionGchordsEnabled,
    selectionDrumsEnabled: $selectionDrumsEnabled,
    selectionMutedVoices: $selectionMutedVoices,
    fontsButton: $btnFonts,
    xIssuesAutoFixButton: $xIssuesAutoFix,
    xIssuesJumpButton: $xIssuesJump,
    xIssuesCopyButton: $xIssuesCopy,
    xIssuesCloseButton: $xIssuesClose,
  },
  state: {
    transport: playbackTransport,
    selectionRuntime: selectionPlaybackRuntime,
    getEditorView: () => editorView,
    getIsPlaying: () => playbackTransport.isPlaying,
    getIsPaused: () => playbackTransport.isPaused,
    getWaitingForFirstNote: () => playbackTransport.waitingForFirstNote,
    getFollowPlayback: () => followPlayback,
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFullView: () => chordProFeature.isFullView(),
  },
  actions: {
    recordDebugLog,
    scheduleAutoDump,
    logPlaybackGuardError: (message) => {
      console.error(`[abcarus][playback-range] ${message}`);
    },
    setStatus,
    clearNoteSelection,
    resetPlaybackUiState,
    clearSvgPlayhead,
    clearSvgFollowBarHighlight,
    clearSvgFollowMeasureHighlight,
    setButtonText,
    updateAbUi,
    updatePracticeUi,
  },
});

documentLifecycleController = createDocumentLifecycleController({
  elements: {
    output: $out,
  },
  state: {
    getRawMode: () => isRawModeActive(),
  },
  actions: {
    setRawModeUi: setRawModeUI,
    setChordProMode: (enabled) => chordProFeature.setMode(Boolean(enabled)),
    resetChordProState: () => chordProFeature.resetState(),
    resetRawModeState,
    setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
    setEditorText: setEditorValue,
    scheduleRender: scheduleRenderNow,
    setRenderBusy,
    clearActiveTuneState: (filePath = null) => {
      activeTuneMeta = null;
      activeTuneId = null;
      activeTuneUid = null;
      activeTuneIndex = null;
      activeFilePath = filePath || null;
      isNewTuneDraft = false;
    },
    clearSaveSession,
    setFullFileSaveSession: (filePath, source) => setSaveSession({
      intent: SAVE_INTENT.FULL_FILE,
      targetPath: String(filePath || ""),
      targetTuneUid: "",
      source: source || "full_file_mode",
    }),
    markHeaderClean,
    setTuneMetaText,
    setFileNameMeta,
    clearErrors,
    setCurrentDocument,
    setDirtyIndicator,
    setActiveFilePath: libraryDocumentContext.setActiveFile,
    setActiveTuneId: libraryDocumentContext.setActiveTuneIdOnly,
    setActiveTuneUid: (value) => { activeTuneUid = value; },
    setActiveTuneIndex: (value) => { activeTuneIndex = value; },
    setActiveTuneMeta: (value) => { activeTuneMeta = value; },
    setStatus,
    markActiveTuneButton,
    updateFileContext,
    updateFileHeaderPanel,
    updateHeaderStateUi: updateHeaderStateUI,
  },
  constants: {
    untitledLabel: UNTITLED_UNSAVED_LABEL,
  },
});

libraryMetadataController = createLibraryMetadataController({
  api: window.api,
  state: {
    getLibraryIndex: () => libraryIndex,
    setLibraryIndex: (next) => { libraryIndex = next; },
    getWorkingCopySnapshot,
    getActiveFilePath: () => activeFilePath,
    setActiveFilePath: (next) => { activeFilePath = next; },
    getActiveTuneMeta: () => activeTuneMeta,
    setActiveTuneMeta: (next) => { activeTuneMeta = next; },
    getActiveTuneIndex: () => activeTuneIndex,
    setActiveTuneId: (next) => { activeTuneId = next; },
    setActiveTuneUid: (next) => { activeTuneUid = next; },
    setActiveTuneIndex: (next) => { activeTuneIndex = next; },
    getCurrentDocumentPath,
    getLibraryFilterLabel: () => libraryUiDomain.getLibraryFilterLabel(),
    getLibraryTextFilter: () => libraryUiDomain.getLibraryTextFilter(),
    isTuneErrorFilterActive,
    isTuneErrorScanInFlight,
    isWorkingCopyOpenForFile,
    isStartupPerfEnabled,
  },
  actions: {
    buildTuneMetaLabel,
    clearErrorsIndex: () => errorsFeature.clearIndex(),
    clearFileContentCache: () => fileContentCache.clear(),
    clearLibraryFilter,
    clearSaveSession,
    countLines,
    deleteFileContentCacheKey: (key) => fileContentCache.deleteKey(key),
    fileExists,
    getActiveTuneId: () => activeTuneId,
    getFileContentFromCache,
    hasFileContentCacheKey: (key) => fileContentCache.hasKey(key),
    invalidateLibraryView: () => libraryUiDomain.invalidateView(),
    isLibraryDisabled: () => chordProFeature.isEnabled(),
    logErr,
    logStartupPerf,
    markActiveTuneButton,
    normalizeFileContentCacheKey,
    parseTuneIdentityFields,
    patchCurrentDocument,
    pathsEqual,
    perfNowMs,
    renderLibraryTree,
    safeBasename,
    scheduleRenderLibraryTree,
    scheduleSaveLibraryUiState,
    setDirtyIndicator,
    setFileContentInCache,
    setFileNameMeta,
    setScanStatus,
    setStatus,
    setTuneMetaText,
    showToast,
    stripFileExtension,
    updateFileContext,
    updateFileHeaderPanel,
    updateLibraryModalRows: () => {
      try {
        libraryUiDomain.updateModalRowsIfOpen();
      } catch {}
    },
    updateLibraryRootUI,
  },
});

libraryCrudDomain = createLibraryCrudDomain({
  api: window.api,
  SAVE_INTENT,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocumentPath,
    getCurrentNavFilePath,
    getEditorText: getEditorValue,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getLibraryIndex: () => libraryIndex,
    getRawMode: () => isRawModeActive(),
    getSaveSession: resolveSaveSession,
    hasGlobalUnsavedChanges,
    isCurrentDocumentDirty,
    isWorkingCopyOpenForFile,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    confirmAppendToFile,
    confirmDeleteTune,
    confirmOverwrite,
    discardWorkingCopyChangesForActiveFile,
    ensureCopyTitleInAbc,
    ensureSafeToAbandonCurrentDoc,
    ensureXNumberInAbc,
    fileExists,
    flushWorkingCopyTuneSync,
    getActiveEditFilePath,
    getActiveFileEntry,
    getDefaultSaveDir,
    getFileContentFromCache,
    getNextXNumber,
    getSuggestedBaseName,
    getWorkingCopySnapshot,
    hasUnsavedChangesForFile,
    libraryDocumentContext,
    loadLibraryFileIntoEditor,
    markActiveTuneButton,
    markCurrentDocumentClean,
    markDiskConflictPath,
    markHeaderClean,
    mkdirp,
    parseTuneIdentityFields,
    patchCurrentDocument,
    pathsEqual,
    readFile,
    recordNavFilePath,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    removeTuneFromContent,
    renumberXInTextKeepingFirst,
    renumberXLinesConsecutive,
    requireCleanForFileOp,
    resetWorkingCopyTuneSyncDebounce,
    resolveTuneEntryFromSnapshot,
    resolveWorkingCopySaveConflictDefault,
    safeBasename,
    safeDirname,
    scheduleRenderLibraryTree,
    selectTune,
    setBufferStatus,
    setDirtyIndicator,
    setFileContentInCache,
    setFileNameMeta,
    setIsNewTuneDraft: (value) => { isNewTuneDraft = Boolean(value); },
    setSaveSession,
    setStatus,
    showSaveDialog,
    showSaveError,
    showToast,
    stripFileExtension,
    syncLibraryFileFromWorkingCopySnapshot,
    updateFileContext,
    updateFileHeaderPanel,
    updateHeaderStateUI,
    updateWindowTitle,
    withFileLock,
    withFileLocks,
    writeFile,
  },
  constants: {
    newFileMinimalAbc: NEW_FILE_MINIMAL_ABC,
    templateAbc: TEMPLATE_ABC,
  },
});
tuneClipboardController = libraryCrudDomain.tuneClipboardController;
appendCurrentTuneAction = libraryCrudDomain.appendCurrentTuneAction;
newFileAction = libraryCrudDomain.newFileAction;
deleteTuneAction = libraryCrudDomain.deleteTuneAction;
duplicateTuneAction = libraryCrudDomain.duplicateTuneAction;
pasteMoveTuneAction = libraryCrudDomain.pasteMoveTuneAction;
renumberXAction = libraryCrudDomain.renumberXAction;

libraryLifecycleController = createLibraryLifecycleController({
  api: window.api,
  elements: {
    tuneSelect: $fileTuneSelect,
  },
  state: {
    getLibraryIndex: () => libraryIndex,
    setLibraryIndex: (next) => { libraryIndex = next; },
    getWorkingCopySnapshot,
    getRawMode: () => isRawModeActive(),
    getFocusModeEnabled: isFocusModeEnabled,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocumentPath,
    getLibraryFilterLabel: () => libraryUiDomain.getLibraryFilterLabel(),
    getSuppressRecentEntries: () => suppressRecentEntries,
    isPayloadMode,
    isWorkingCopyOpenForFile,
    isCurrentDocumentDirty,
  },
  actions: {
    abbreviatePathForLog,
    applyLibraryUiStateFromSettings: (settings) => libraryUiDomain.applyLibraryUiStateFromSettings(settings),
    attachTuneUidsToLibraryFile,
    buildTuneMetaLabel,
    clearAbPlan,
    clearActiveErrorHighlight,
    clearFileContentCache: () => fileContentCache.clear(),
    clearLibraryFilter,
    clearSaveSession,
    countLines,
    ensureFullLibraryIndex,
    ensureSafeToAbandonCurrentDoc,
    errorsClearIndex: () => errorsFeature.clearIndex(),
    errorsHasActiveHighlight: () => errorsFeature.hasActiveHighlight(),
    expandInitialCollapsedState: () => libraryUiDomain.expandInitialCollapsedState(),
    getFileContentFromCache,
    getLatestSettingsSnapshot: () => latestSettingsSnapshot,
    invalidateLibraryView: () => libraryUiDomain.invalidateView(),
    isChordProFilePath,
    isChordProText,
    isFilePerfEnabled,
    isRenderPerfEnabled,
    logErr,
    logFilePerf,
    logRenderPerf,
    markActiveTuneButton,
    markHeaderClean,
    markStartupAutoLoadStarted: () => statusController.markStartupAutoLoadStarted(),
    markStartupUiReady: () => statusController.markStartupUiReady(),
    maybeResetFocusLoopForTune,
    normalizeLibraryPath,
    openChordPro: (filePath, text, options) => chordProFeature.open(filePath, text, options),
    patchCurrentDocument,
    pathsEqual,
    perfNowMs,
    readFile,
    recordNavFilePath,
    recordRecentAction,
    refreshHeaderLayers: () => headerLayersController.refreshHeaderLayers(),
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    reportStartupStatus,
    resetEditorSelectionToStart: () => {
      if (!editorView) return;
      try { editorView.dispatch({ selection: { anchor: 0, head: 0 }, scrollIntoView: false }); } catch {}
    },
    resetPlaybackState,
    resetTransposePreviewState,
    resolveTuneEntryFromSnapshot,
    restoreLibraryTuneSelection,
    safeBasename,
    safeDirname,
    scheduleAutoWcDump,
    scheduleLazyWorkingCopyOpenForActiveFile,
    scheduleRenderLibraryTree,
    scheduleRenderNow,
    scheduleSaveLibraryUiState,
    selectionPlaybackRuntime,
    setActiveFilePath: (next) => { activeFilePath = next; },
    setActiveTuneId: (next) => { activeTuneId = next; },
    setActiveTuneIndex: (next) => { activeTuneIndex = next; },
    setActiveTuneMeta: (next) => { activeTuneMeta = next; },
    setActiveTuneUid: (next) => { activeTuneUid = next; },
    setChordProMode: (next) => chordProFeature.setMode(Boolean(next)),
    setDirtyIndicator,
    setEditorValue,
    setFileContentInCache,
    setFileNameMeta,
    setIsNewTuneDraft: (next) => { isNewTuneDraft = Boolean(next); },
    setLibraryActiveFilePath: (next) => { activeFilePath = next; },
    setPlaybackRange,
    setSaveSession,
    setScanStatus,
    setSuppressDirty: (next) => { suppressDirty = Boolean(next); },
    setTuneMetaText,
    showEmptyState,
    showToast,
    sourceLinkUpdate: () => sourceLinkFeature.update(),
    stripFileExtension,
    syncLibraryFileFromWorkingCopySnapshot,
    updateFileContext,
    updateFileHeaderPanel,
    updateHeaderStateUI,
    updateLibraryRootUI,
    updateLibraryStatus,
  },
  constants: {
    SAVE_INTENT,
    UNTITLED_UNSAVED_LABEL,
  },
});

documentSessionController = createDocumentSessionController({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentNavFilePath,
    getHeaderDirty,
    getLibraryFiles: () => (libraryIndex && Array.isArray(libraryIndex.files)) ? libraryIndex.files : [],
    hasUnsavedChangesInActiveEditContext,
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFilePath,
    isChordProText,
    isNewTuneDraft: () => isNewTuneDraft,
    isPayloadMode,
    isRawMode: () => isRawModeActive(),
    getRawModeFilePath,
  },
  actions: {
    clearCurrentDocument,
    discardWorkingCopyChangesForActiveFile,
    flushLibraryPrefsSave,
    loadSingleLibraryFile,
    markHeaderClean,
    openChordProFile: (filePath, text) => chordProFeature.open(filePath, text),
    performRawSaveFlow,
    performSaveAsFlow,
    performSaveFlow,
    readFile,
    selectTune,
    setActiveTuneText,
    setChordProMode: (next) => chordProFeature.setMode(next),
    setDirtyIndicator,
    showToast,
    updateHeaderStateUI,
    pathsEqual,
    safeDirname,
  },
});

function stripFileExtension(name) {
  return statusController.stripFileExtension(name);
}

function setFileNameMeta(name) {
  statusController.setFileNameMeta(name);
}

function updateWindowTitle() {
  statusController.updateWindowTitle();
}

function buildTuneMetaLabel(metadata) {
  return statusController.buildTuneMetaLabel(metadata);
}

function renderUnifiedStatus() {
  statusController.renderUnifiedStatus();
}

function renderBufferStatus() {
  statusController.renderBufferStatus();
}

function setTuneMetaText(text) {
  statusController.setTuneMetaText(text);
}

const sourceLinkFeature = createSourceLinkFeature({
  documentRef: document,
  api: window.api,
  parseAbcHeaderFields,
  showToast,
  getEditorText: getEditorValue,
  hasEditor: () => Boolean(editorView),
  isDisabled: () => Boolean(isRawModeActive() || chordProFeature.isEnabled()),
  shouldIncludePrintQr: () => Boolean(latestSettingsSnapshot && latestSettingsSnapshot.printSourceQrCodes),
});
const printCurrentFeature = createPrintCurrentFeature({
  api: window.api,
  getEditorText: getEditorValue,
  getActiveFileEntry,
  getHeaderText: () => getHeaderEditorValue(),
  buildHeaderPrefix,
  renderAbcToSvgMarkup,
  buildSourceLinkMarkup: (abcText) => sourceLinkFeature.buildPrintMarkup(abcText),
  applyPrintDebugMarkup,
  getSuggestedName: getSuggestedPrintBaseName,
  setStatus,
  showToast,
  logError: logErr,
});
const importExportFeature = createImportExportFeature({
  api: window.api,
  windowRef: window,
  getEditorText: getEditorValue,
  getSuggestedBaseName,
  getCurrentDoc: getCurrentDocument,
  getActiveFilePath: () => activeFilePath,
  getActiveTuneMeta: () => activeTuneMeta,
  getPlaybackPayload,
  ensureSafeToAbandonCurrentDoc,
  requireCleanForFileOp,
  confirmImportTarget: confirmImportMusicXmlTarget,
  confirmAppendToFile,
  showSaveDialog,
  showSaveError,
  showOpenError,
  showToast,
  setStatus,
  logError: logErr,
  readFile,
  writeFile,
  withFileLock,
  safeBasename,
  safeDirname,
  stripFileExtension,
  pathsEqual,
  newFileMinimalAbc: NEW_FILE_MINIMAL_ABC,
  initializeNewImportFile: async (targetPath) => {
    documentLifecycleController.beginCleanFileDocument({
      path: targetPath,
      content: "",
      tuneLabel: "Untitled",
      fileLabel: stripFileExtension(safeBasename(targetPath)),
    });
    scheduleRenderNow({ clearOutput: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
  },
  createBlankDocument,
  setCurrentDocument,
  markCurrentDocumentClean,
  setActiveTuneText,
  setImportedTuneActive: ({ tune, tuneText, file }) => {
    if (!tune || !file) return;
    activeTuneId = tune.id;
    markActiveTuneButton(activeTuneId);
    setActiveTuneText(tuneText, {
      id: tune.id,
      path: file.path,
      basename: file.basename,
      xNumber: tune.xNumber,
      title: tune.title || "",
      composer: tune.composer || "",
      key: tune.key || "",
      startLine: tune.startLine,
      endLine: tune.endLine,
      startOffset: tune.startOffset,
      endOffset: tune.endOffset,
    });
  },
  setFileContentInCache,
  refreshLibraryFile,
  isWorkingCopyOpenForFile,
  refreshWorkingCopySnapshot,
  syncLibraryFileFromWorkingCopySnapshot,
  markDiskConflictPath,
  getNextXNumber,
  ensureXNumberInAbc,
  appendTuneToContent,
  normalizeMeasuresLineBreaks,
  transformMeasuresPerLine,
  alignBarsInText,
  ensureAbc2svgLoader,
  getAbcCtor,
  normalizeHeaderNoneSpacing,
  normalizeAccThreeQuarterToneForAbc2svg,
  ensureAbc2svgModulesAsync,
  ensureMidiGenLoaded,
});
importExportFeature.installMidiProgressHandler();
abcTransformFeature = createAbcTransformFeature({
  windowRef: window,
  devConfig,
  getEditorText: getEditorValue,
  getHeaderText: getHeaderEditorValue,
  getSettings: () => latestSettingsSnapshot,
  setEditorTextForSmoke: (text) => {
    suppressDirty = true;
    setEditorValue(String(text || ""));
    suppressDirty = false;
  },
  applyTransformedText,
  showTransformError,
  setStatus,
  logError: logErr,
  alignBarsInText,
});
abcTransformFeature.installDevSmoke();
diagnosticsDomain.installDevUiSmoke({
  setEditorText: (text) => {
    suppressDirty = true;
    try {
      setEditorValue(String(text || ""));
    } finally {
      suppressDirty = false;
    }
  },
  setCleanDocument: (text) => {
    const content = String(text || "");
    suppressDirty = true;
    try {
      setEditorValue(content);
      setCurrentDocument({ path: null, dirty: false, content });
      activeTuneMeta = null;
      activeTuneId = null;
      activeTuneUid = null;
      activeTuneIndex = null;
      activeFilePath = null;
      isNewTuneDraft = false;
      updateFileContext();
      markActiveTuneButton(null);
      setDirtyIndicator(false);
    } finally {
      suppressDirty = false;
    }
  },
  getEditorText: getEditorValue,
  scheduleRender: () => scheduleRenderNow({ clearOutput: true, source: "ui-smoke" }),
  elements: {
    playButton: $btnPlayPause,
    stopButton: $btnStop,
    closeButton: $btnFileClose,
    status: $status,
    toast: $toast,
    tuneSelect: $fileTuneSelect,
  },
  clickPlay: () => {
    if ($btnPlayPause) $btnPlayPause.click();
  },
  clickStop: () => {
    if ($btnStop) $btnStop.click();
  },
  clickClose: () => {
    if ($btnFileClose) $btnFileClose.click();
  },
  getState: () => ({
    isPlaying: playbackTransport.isPlaying,
    isPaused: playbackTransport.isPaused,
    waitingForFirstNote: playbackTransport.waitingForFirstNote,
    playbackStartArmed: playbackTransport.playbackStartArmed,
  }),
  getHasSvg: () => Boolean($out && $out.querySelector("svg")),
  getPlaybackDebug: () => window.__abcarusPlaybackDebug || null,
});

const rawModeEnterGuard = createRawModeEnterGuard({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneMeta: () => activeTuneMeta,
    getCurrentDocument,
    getCurrentDocumentPath,
    getHeaderDirty,
    getIsCurrentDocumentDirty: isCurrentDocumentDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getWorkingCopySnapshot,
  },
  actions: {
    ensureSafeToAbandonCurrentDoc,
    findHeaderEndOffset,
    getActiveFileEntry,
    getEditorValue,
    getHeaderEditorValue,
    markDiskConflictPath,
    markHeaderClean,
    patchCurrentDocument,
    refreshWorkingCopySnapshot,
    setDirtyIndicator,
    updateHeaderStateUI,
  },
  utils: {
    pathsEqual,
  },
});

rawModeFeature = createRawModeFeature({
  api: window.api,
  documentRef: document,
  elements: {
    rawButton: $btnToggleRaw,
    tuneSelect: $fileTuneSelect,
    playPauseButton: $btnPlayPause,
    stopButton: $btnStop,
    followButton: $btnToggleFollow,
    errorsButton: $btnToggleErrors,
    scanErrorsButton: $scanErrorTunes,
    errorsIndicator: $errorsIndicator,
  },
  getCurrentDoc: getCurrentDocument,
  patchCurrentDoc: (patch = {}) => {
    patchCurrentDocument(patch);
  },
  getActiveFilePath: () => activeFilePath,
  beginRawFullFileContext: (filePath, source) => documentLifecycleController.beginRawFullFileContext(filePath, source),
  getActiveTuneId: () => activeTuneId,
  getActiveTuneMeta: () => activeTuneMeta,
  setRawActiveTuneContext: (tuneId, meta) => documentLifecycleController.setRawActiveTuneContext(tuneId, meta),
  clearUnsavedDiscardState: () => {
    resetHeaderEditorFilePath();
    markHeaderClean();
    markCurrentDocumentClean();
  },
  getHeaderDirty,
  setHeaderClean: markHeaderClean,
  getHeaderText: getHeaderEditorValue,
  getEditorText: getEditorValue,
  getEditorView: () => editorView,
  scrollEditor: scrollEditorToPos,
  setEditorText: setEditorValue,
  setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
  setFocusModeEnabled,
  setBarMismatchMarkers,
  applyRightSplitSizesFromRatio: () => layoutController.applyRightSplitSizesFromRatio({ rawMode: isRawModeActive() }),
  updateSourceLinkPanel: () => sourceLinkFeature.update(),
  showToast,
  showOpenError,
  showSaveError,
  setStatus,
  withFileLock,
  pathsEqual,
  readFile,
  refreshLibraryFile,
  getActiveFileEntry,
  findHeaderEndOffset,
  findTuneById,
  safeFirstTuneId: () => {
    const entry = getActiveFileEntry();
    return entry && entry.tunes && entry.tunes[0] ? entry.tunes[0].id : null;
  },
  selectTune,
  stopPlaybackTransport,
  flushWorkingCopyTuneSync,
  flushWorkingCopyFullSync,
  normalizeCleanStateBeforeRaw: rawModeEnterGuard.normalizeCleanStateBeforeRaw,
  ensureWorkingCopyOpenForPath,
  refreshWorkingCopySnapshot,
  handleMissingWorkingCopySave,
  resolveWorkingCopySaveConflictDefault,
  markDiskConflictPath,
  setFileContentInCache,
  attachTuneUidsToLibraryFile,
  updateHeaderStateUI,
  updateFileHeaderPanel,
  updateFileContext,
  setDirtyIndicator,
  ensureSafeToAbandonCurrentDoc,
  ensureSafeToEnterRaw: rawModeEnterGuard.ensureSafeToEnterRaw,
  confirmUnsavedChanges,
  setTuneMetaText,
  buildTuneMetaLabel,
  markActiveTuneButton,
});

function setDirtyIndicator(isDirty) {
  if (editStateController) editStateController.setDirtyIndicator(isDirty);
}

function computeHeaderPresence() {
  return fileHeaderController.computePresence();
}

function updateHeaderStateUI(options = {}) {
  fileHeaderController.updateStateUi(options);
}

function getHeaderDirty() {
  return fileHeaderController.isDirty();
}

function markHeaderClean() {
  fileHeaderController.setClean();
}

function resetHeaderEditorFilePath() {
  fileHeaderController.resetEditorFilePath();
}

function isHeaderEditorFilePath(filePath) {
  const headerFilePath = fileHeaderController.getEditorFilePath();
  return Boolean(headerFilePath && filePath && pathsEqual(headerFilePath, filePath));
}

function getHeaderCollapsed() {
  return fileHeaderController.getCollapsed();
}

function buildTuneSelectOptions(fileEntry) {
  if (fileContextController) fileContextController.buildTuneSelectOptions(fileEntry);
}

function updateFileContext() {
  if (fileContextController) fileContextController.updateFileContext();
}

async function navigateTuneByDelta(delta) {
  if (fileContextController) await fileContextController.navigateTuneByDelta(delta);
}

function setHeaderEditorValue(text) {
  fileHeaderController.setEditorValue(text);
}

const measureErrorPlugin = errorsFeature.plugins.measure;

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

const barMismatchPlugin = errorsFeature.plugins.barMismatch;

function setBarMismatchMarkers(markers) {
  errorsFeature.setBarMismatchMarkers(markers);
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
const intonationRendererBridge = createIntonationRendererBridge({
  ViewPlugin,
  getEditorView: () => editorView,
  getOutputElement: () => $out,
  findMeasureRangeAt,
  mapEditorOffsetToRenderIdx,
  maybeScrollRenderToNote,
  isRawMode: () => isRawModeActive(),
  isPayloadMode,
});

intonationExplorerFeature = createIntonationExplorerFeature({
  elements: {
    document,
  },
  host: {
    clearSvgBarHighlight: intonationRendererBridge.clearSvgBarHighlight,
    clearSvgNoteHighlight: intonationRendererBridge.clearSvgNoteHighlight,
    enableDraggableToolPanel,
    ensureToolPanelDefaultLeftPosition,
    focusEditorAt: intonationRendererBridge.focusEditorAt,
    getSelectionScope: intonationRendererBridge.getSelectionScope,
    highlightBarsAtOffsets: intonationRendererBridge.highlightBarsAtOffsets,
    highlightNotesAtOffsets: intonationRendererBridge.highlightNotesAtOffsets,
    isPerfEnabled: isIntonationPerfEnabled,
    isRawMode: () => isRawModeActive(),
    logError: (e) => logErr(e && e.message ? e.message : String(e)),
    logPerf: logIntonationPerf,
    nowMs: perfNowMs,
    refreshWorkingCopySnapshot,
    resolveActiveTune: (snapshot) => resolveTuneEntryFromSnapshot(snapshot, {
      tuneUid: activeTuneUid,
      tuneIndex: activeTuneIndex,
      startOffset: activeTuneMeta && activeTuneMeta.startOffset,
    }),
    scrollToCurrentHighlight: intonationRendererBridge.scrollToCurrentHighlight,
    setHighlightRanges: intonationRendererBridge.setHighlightRanges,
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
  return fileHeaderController.getEditorValue();
}

function setHeaderCollapsed(collapsed) {
  fileHeaderController.setCollapsed(collapsed);
}

function toggleHeaderCollapsed() {
  fileHeaderController.toggleCollapsed();
}

function clearLibraryFilter() {
  libraryUiDomain.clearLibraryFilter();
}

function getActiveFileEntry() {
  if (chordProFeature.isEnabled()) return null;
  if (!libraryIndex || !libraryIndex.files || !activeFilePath) return null;
  return libraryIndex.files.find((file) => pathsEqual(file.path, activeFilePath)) || null;
}

function updateFileHeaderPanel() {
  fileHeaderController.updatePanel();
}

function findHeaderEndOffset(content) {
  // Avoid `\s*` which can consume newlines and shift the boundary into blank lines.
  const match = String(content || "").match(/^[\t ]*X:/m);
  if (!match) return String(content || "").length;
  return Number.isFinite(match.index) ? match.index : 0;
}

function updateLibraryStatus() {
  return libraryMetadataController.updateLibraryStatus();
}

function highlightSvgPracticeBarAtEditorOffset(editorOffset) {
  return practiceBarHighlightController.highlightSvgPracticeBarAtEditorOffset(editorOffset);
}

function setPracticeBarHighlight(range) {
  return practiceBarHighlightController.setPracticeBarHighlight(range);
}

function getEditorValue() {
  if (!editorView) return "";
  return editorView.state.doc.toString();
}

function resetLayout() {
  if (settingsDomain) settingsDomain.resetLayout();
}

function refreshErrorsNow() {
  errorsFeature.refreshNow();
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

async function performRawSaveFlow() {
  return rawModeFeature.save();
}

function scrollToPosInEditor(pos, options = {}) {
  return scrollEditorToPos(editorView, pos, options);
}

function setRawModeUI(enabled) {
  if (rawModeFeature) rawModeFeature.setUi(enabled);
}

async function enterRawMode() {
  await rawModeFeature.enter();
}

async function exitRawMode() {
  await rawModeFeature.exit();
}

async function leaveRawModeForAction(contextLabel) {
  return rawModeFeature.leaveForAction(contextLabel);
}

function toggleLineComments(view) {
  return toggleLineCommentsCore(view, {
    isEditingBlocked: () => (
      playbackTransport.isPlaying
      || playbackTransport.isPaused
      || playbackTransport.waitingForFirstNote
    ),
    onEditingBlocked: () => showToast("Playback active: stop before editing.", 2400),
  });
}

function getFocusedEditorView() {
  const activeEl = document.activeElement;
  const headerView = fileHeaderController.getEditorView();
  if (headerView && headerView.dom && activeEl && headerView.dom.contains(activeEl)) return headerView;
  if (editorView && editorView.dom && activeEl && editorView.dom.contains(activeEl)) return editorView;
  return editorView || headerView || null;
}

const midiInputFeature = createMidiInputFeature({
  documentRef: document,
  api: window.api,
  setButtonText,
  showToast,
  getMainEditorView: () => editorView,
  getHeaderEditorView: () => fileHeaderController.getEditorView(),
  EditorSelectionRef: EditorSelection,
  getDefaultLen,
  gcdInt,
  isTypingPreviewBlocked: () => Boolean(isRawModeActive() || isPayloadMode() || chordProFeature.isEnabled()),
  isMainEditorUpdate: (update) => Boolean(editorView && update && update.view === editorView),
  refreshCursorStatus: () => {
    if (mainEditorFeature) mainEditorFeature.refreshCursorStatus();
  },
  hasCursorStatus: () => Boolean(mainEditorFeature),
});
midiInputFeature.exposeDebugApi();

function initEditor() {
  if (editorView || !$editorHost) return;
  mainEditorFeature = createMainEditorFeature({
    host: $editorHost,
    cursorStatusElement: $cursorStatus,
    initialDoc: DEFAULT_ABC,
    extensionRuntime: editorExtensionRuntime,
    keymapOptions: {
      documentRef: document,
      windowRef: window,
      isRawMode: () => isRawModeActive(),
      showToast,
      fileSave,
      toggleMidiInput: () => midiInputFeature.toggleInputSetting(),
      toggleMidiMute: () => midiInputFeature.toggleMuteSetting(),
      goToMeasure: goToMeasureCommand,
      openAbcHelper: (view) => abcHelpersFeature.openAtCursor(view),
      toggleLineComments,
      togglePlayPause: togglePlayPauseEffective,
      startPlayback: startPlaybackAtIndex,
      resetLayout,
      refreshErrors: refreshErrorsNow,
      getFocusedEditorView,
    },
    updateOptions: {
      isDirtySuppressed: () => suppressDirty,
      isPayloadMode,
      hasCurrentDocument,
      ensureCurrentDocument,
      patchCurrentDocument,
      setDirtyIndicator,
      handleTypingPreviewChange: (update) => midiInputFeature.handleTypingPreviewChange(update),
      incrementAbRevision: () => abLoopRuntime.incrementRevision(),
      hasAbPlan: () => abLoopRuntime.hasPlan(),
      clearAbPlan,
      isChordProEnabled: () => chordProFeature.isEnabled(),
      isChordProFullView: () => chordProFeature.isFullView(),
      handleChordProDocChanged: (content) => chordProFeature.handleEditorDocChanged(content),
      handleChordProSelectionOffset: (index) => chordProFeature.handleSelectionOffset(index),
      getActiveTuneUid: () => activeTuneUid,
      scheduleWorkingCopyFullSync,
      scheduleWorkingCopyTuneSync,
      isRawMode: () => isRawModeActive(),
      scheduleRender: () => scheduleRenderNow(),
      scheduleSourceLinkUpdate: () => sourceLinkFeature.scheduleUpdate(),
      isPlaying: () => playbackTransport.isPlaying,
      getFollowPlayback: () => followPlayback,
      scheduleCursorNoteHighlight,
      clearNoteSelection,
      updatePlaybackRangeFromSelection: (selection, origin, activeHighlight) => {
        playbackTransportController.updatePlaybackRangeFromSelection(
          selection,
          origin,
          activeHighlight
        );
      },
      getActiveErrorHighlight: () => errorsFeature.getActiveHighlight(),
      transport: playbackTransport,
      clearPracticeHighlight: () => {
        setPracticeBarHighlight(null);
        clearSvgPracticeBarHighlight();
      },
    },
    isPayloadMode,
    shouldSuppressErrorHighlightClear: () => errorsFeature.isHighlightSuppressingClear(),
    getActiveErrorHighlight: () => errorsFeature.getActiveHighlight(),
    clearActiveErrorHighlight,
    showContextMenuAt,
    updateAbUi,
  });
  editorView = mainEditorFeature.init();
}

function initHeaderEditor() {
  fileHeaderController.initEditor();
}

function setActiveTuneText(text, metadata, options = {}) {
  return libraryLifecycleController.setActiveTuneText(text, metadata, options);
}

function insertTextAtEditorSelection(text) {
  return insertTextAtEditorSelectionCore(editorView, text);
}

function setLibraryVisible(visible, { persist = true } = {}) {
  return libraryShellController.setLibraryVisible(visible, { persist });
}

function toggleLibrary() {
  return libraryShellController.toggleLibrary();
}

function scheduleRenderLibraryTree(files = null) {
  libraryTreeView.schedule(files);
}

function renderLibraryTree(files = null) {
  libraryTreeView.render(files);
}

function markActiveTuneButton(tuneId) {
  void tuneId;
  libraryTreeView.markActiveTuneButton();
}

async function selectTune(tuneId, options = {}) {
  return libraryLifecycleController.selectTune(tuneId, options);
}

// Canonical Library Tree open entrypoint: `selectTune(tuneId)`.
// This wrapper reuses the same loading/confirm logic for the modal.
async function openTuneFromLibrarySelection(selection) {
  return libraryLifecycleController.openTuneFromLibrarySelection(selection);
}

window.openTuneFromLibrarySelection = openTuneFromLibrarySelection;

async function openRecentTune(entry) {
  return libraryLifecycleController.openRecentTune(entry);
}

async function openRecentFile(entry) {
  return libraryLifecycleController.openRecentFile(entry);
}

async function openRecentFolder(entry) {
  return libraryShellController.openRecentFolder(entry);
}

async function scanAndLoadLibrary() {
  return libraryShellController.scanAndLoadLibrary();
}

async function refreshLibraryIndex() {
  return libraryMetadataController.refreshLibraryIndex();
}

async function loadLibraryFromFolder(folder, options = {}) {
  return libraryLifecycleController.loadLibraryFromFolder(folder, options);
}

async function loadSingleLibraryFile(filePath, options = {}) {
  return libraryLifecycleController.loadSingleLibraryFile(filePath, options);
}

async function loadLibraryFileIntoEditor(filePath, options = {}) {
  return libraryLifecycleController.loadLibraryFileIntoEditor(filePath, options);
}

async function requestLoadLibraryFile(filePath) {
  return libraryLifecycleController.requestLoadLibraryFile(filePath);
}

libraryUiDomain.wireControls();
libraryUiDomain.wireSearch({ clearButton: $btnLibraryClearFilter });
libraryUiDomain.wireCatalogBridge();

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

function createBlankDocument() {
  return editStateController
    ? editStateController.createBlankDocument(DEFAULT_ABC)
    : { path: null, dirty: false, content: DEFAULT_ABC };
}

function setStatus(s) {
  statusController.setStatus(s);
}

function setButtonText(button, text) {
  if (!button) return;
  const span = button.querySelector ? button.querySelector(".btn-text") : null;
  const value = String(text || "");
  if (span) span.textContent = value;
  else button.textContent = value;
}

function setHoverStatus(text) {
  toastHoverController.setHoverStatus(text);
}

function pinHoverStatus(text) {
  toastHoverController.pinHoverStatus(text);
}

function showHoverStatus(text) {
  toastHoverController.showHoverStatus(text);
}

function restoreHoverStatus() {
  toastHoverController.restoreHoverStatus();
}

function setBufferStatus(text) {
  statusController.setBufferStatus(text);
}

function setTransientBufferStatus(text, autoClearMs = 3200) {
  setBufferStatus(text);
  const delay = Number.isFinite(Number(autoClearMs)) ? Number(autoClearMs) : 3200;
  setTimeout(() => {
    if (statusController.getBufferStatusText() === String(text || "")) setBufferStatus("");
  }, Math.max(0, delay));
}

function computeMeasureStatsAt(editorText, anchorOffset) {
  return computeMeasureStatsAtCore(editorText, anchorOffset, { findMeasureRangeAt });
}

function isCriticalToast(message) {
  return toastHoverController.isCriticalToast(message);
}

function showToast(message, durationMs = 4000) {
  toastHoverController.showToast(message, durationMs);
}

function showToastWithAction(message, actionLabel, actionFn, durationMs = 6000) {
  toastHoverController.showToastWithAction(message, actionLabel, actionFn, durationMs);
}

function updateErrorsIndicatorAndPopover() {
  errorsFeature.updateIndicatorAndPopover();
}

function setScanErrors(errorsArray) {
  errorsFeature.setScanErrors(errorsArray);
}

function reconcileActiveErrorHighlightAfterRender({ renderSucceeded = false } = {}) {
  errorsFeature.reconcileActiveHighlightAfterRender({ renderSucceeded });
}

async function jumpToError(errItem) {
  await errorsFeature.jumpToError(errItem);
}

async function checkExternalTools() {
  await toolStatusController.check();
}

function setSoundfontStatus(text, autoClearMs) {
  soundfontController.setStatus(text, autoClearMs);
}

function setSoundfontCaption(text) {
  soundfontController.setCaption(text);
}

function applyTransformedText(text, options = {}) {
  ensureCurrentDocument();
  if (options.resetTransposePreview !== false) resetTransposePreviewState();
  let nextText = text || "";
  nextText = chordProFeature.applyTransformedText(nextText);
  suppressDirty = true;
  setEditorValue(nextText);
  suppressDirty = false;
  patchCurrentDocument({ content: nextText, dirty: true }, { create: false });
  if (chordProFeature.isEnabled()) {
    scheduleWorkingCopyFullSync();
  }
  scheduleRenderNow({ clearOutput: true });
}

function alignBarsInEditor() {
  abcTransformFeature.alignBars();
}

function showErrorsVisible(visible) {
  // Errors are surfaced via the always-visible "Errors: N" indicator + popover.
  // Keep the legacy sidebar errors pane inactive to avoid duplicate UX.
  if ($sidebar) $sidebar.classList.remove("has-errors");
  if ($sidebarBody) $sidebarBody.classList.remove("errors-visible");
  void visible;
}

function clearErrors() {
  errorsFeature.clear();
}

function initContextMenu() {
  libraryContextMenu.init();
}

function hasUnsavedChangesForFile(filePath) {
  return editStateController ? editStateController.hasUnsavedChangesForFile(filePath) : false;
}

function getActiveEditFilePath() {
  return editStateController ? editStateController.getActiveEditFilePath() : "";
}

function hasGlobalUnsavedChanges() {
  return editStateController ? editStateController.hasGlobalUnsavedChanges() : false;
}

function hasUnsavedChangesInActiveEditContext() {
  return editStateController ? editStateController.hasUnsavedChangesInActiveEditContext() : false;
}

async function requireCleanForFileOp(targetPath, actionLabel) {
  return fileOperationGuard ? fileOperationGuard.requireCleanForFileOp(targetPath, actionLabel) : false;
}

function isWorkingCopyOpenForFile(filePath) {
  return fileOperationGuard ? fileOperationGuard.isWorkingCopyOpenForFile(filePath) : false;
}

function splitFileIntoHeaderAndBody(fullText) {
  const text = String(fullText || "");
  const headerEnd = findHeaderEndOffset(text);
  const header = text.slice(0, headerEnd);
  const body = text.slice(headerEnd);
  return { headerText: header, bodyText: body };
}

function showContextMenuAt(x, y, target) {
  libraryContextMenu.show(x, y, target);
}

function hideContextMenu() {
  libraryContextMenu.hide();
}

function setErrorLineOffsetFromHeader(headerText) {
  errorsFeature.setLineOffsetFromHeader(headerText);
}

function applyMeasureHighlights(renderOffset) {
  errorsFeature.applyMeasureHighlights(renderOffset);
}

function isMeasureCheckEnabled() {
  const text = getEditorValue();
  const match = String(text || "").match(/^M:\s*(.+)$/m);
  if (!match) return false;
  const value = String(match[1] || "").trim().toLowerCase();
  return value !== "none";
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
  return measureNavigationController.findMeasureRangeAt(text, pos);
}

function findMeasureStartOffsetByNumber(text, measureNumber) {
  return measureNavigationController.findMeasureStartOffsetByNumber(text, measureNumber);
}

function findMeasureStartOffsetByNumberInPrimaryVoice(text, measureNumber) {
  return measureNavigationController.findMeasureStartOffsetByNumberInPrimaryVoice(text, measureNumber, { normalizeVoiceIdToken });
}

function getRenderMeasureIndex() {
  return measureNavigationController.getRenderMeasureIndex();
}

async function promptGoToMeasureNumber() {
  return goToMeasureModalController.prompt();
}

async function goToMeasureCommand() {
  return measureNavigationController.goToMeasureCommand();
}

function addError(message, locOverride, contextOverride) {
  if (shouldSuppressUserVisibleAbcError(message)) return null;
  return errorsFeature.add(message, locOverride, contextOverride);
}

function logErr(m, loc, context) {
  if (shouldSuppressUserVisibleAbcError(m)) return null;
  return errorsFeature.log(m, loc, context);
}

function clearNoteSelection() {
  return scoreHighlightController.clearNoteSelection();
}

function pickClosestNoteElement(els) {
  return scoreHighlightController.pickClosestNoteElement(els);
}

function invalidateNoteHighlightIndexCache() {
  return scoreHighlightController.invalidateNoteHighlightIndexCache();
}

function extractRenderIdxFromElementClass(el) {
  return scoreHighlightController.extractRenderIdxFromElementClass(el);
}

function queryNoteHighlightElementsByRenderIdx(renderIdx) {
  return scoreHighlightController.queryNoteHighlightElementsByRenderIdx(renderIdx);
}

function findNearestNoteHighlightElements(renderIdx, maxDelta = 240) {
  return scoreHighlightController.findNearestNoteHighlightElements(renderIdx, maxDelta);
}

function highlightNoteAtIndex(idx) {
  scoreHighlightController.highlightEditorNoteAtIndex(idx, { scrollToNote: maybeScrollRenderToNote });
}

function scheduleCursorNoteHighlight(idx) {
  scoreHighlightController.scheduleCursorNoteHighlight(idx);
}

function highlightRenderNoteAtIndex(renderIdx) {
  scoreHighlightController.highlightRenderNoteAtIndex(renderIdx, { scrollToNote: maybeScrollRenderToNote });
}

function setEditorSelectionAt(idx) {
  return setEditorSelectionAtCore(editorView, idx, { onSelect: highlightNoteAtIndex });
}

function setEditorSelectionRange(start, end) {
  return setEditorSelectionRangeCore(editorView, start, end, { onSelect: highlightNoteAtIndex });
}

function setEditorSelectionAtLineCol(line, col) {
  return setEditorSelectionAtLineColCore(
    editorView,
    line,
    col,
    { onSelect: highlightNoteAtIndex },
  );
}

function buildSuggestedTuneBaseName({ includeKey = false } = {}) {
  return buildSuggestedTuneBaseNameCore({
    editorText: getEditorValue(),
    activeTuneMeta,
    includeKey,
  });
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
  {
    const docPath = getCurrentDocumentPath();
    if (docPath) return safeDirname(docPath);
  }
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
  return buildSongbookSuggestedBaseNameCore({
    activeFilePath,
    fallbackBaseName: getSuggestedBaseName(),
    safeBasename,
  });
}

async function getFileContentCached(filePath) {
  return fileContentCache.getCached(filePath, readFile);
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

renderPipelineController = createRenderPipelineController({
  windowRef: window,
  outputElement: $out,
  getRawMode: () => isRawModeActive(),
  isChordProFullView: () => chordProFeature.isFullView(),
  isChordProEnabled: () => chordProFeature.isEnabled(),
  chordProHasBlocks: () => chordProFeature.hasBlocks(),
  getEditorText: getEditorValue,
  getEditorView: () => editorView,
  getRenderPayload,
  normalizeHeaderText: normalizeHeaderNoneSpacing,
  stripSepForRender,
  assertCleanAbcText,
  ensureAbc2svgLoader,
  ensureAbc2svgModules,
  getAbcCtor,
  clearNoteSelection,
  invalidateNoteHighlightIndexCache,
  clearErrors,
  setRenderBusy,
  setStatus,
  logError: logErr,
  addError,
  setBarMismatchMarkers,
  setErrorLineOffset: (lineOffset) => errorsFeature.setLineOffset(lineOffset),
  setErrorLineOffsetFromHeader,
  updateLibraryErrorIndexFromCurrentErrors,
  reconcileActiveErrorHighlightAfterRender,
  detectMeterMismatchInBarlines,
  detectRepeatMarkerAfterShortBar,
  applyMeasureHighlights,
  highlightNoteAtIndex,
  getActiveErrorHighlightRange: () => errorsFeature.getActiveHighlightRange(),
  highlightSvgAtEditorOffset,
  isPlaybackBusy,
  isTransportJumpHighlightActive: () => playbackTransport.transportJumpHighlightActive,
  highlightSvgPracticeBarAtEditorOffset,
  isDebugMessagesEnabled: diagnosticsDomain.isDebugMessagesEnabled,
  setTransientBufferStatus,
  isRenderPerfEnabled,
  perfNowMs,
  logRenderPerf,
  refreshBarMismatchMarkersForTune: (text, options) => errorsFeature.refreshBarMismatchMarkersForTune(text, options),
  addBarMismatchErrorsFromMarkers: () => errorsFeature.addBarMismatchErrorsFromMarkers(),
  updateErrorsIndicatorAndPopover: () => errorsFeature.updateIndicatorAndPopover(),
  getErrorCount: () => errorsFeature.getErrors ? errorsFeature.getErrors().length : undefined,
});

function setRenderBusy(next) {
  if (playbackUiController) playbackUiController.setRenderBusy(next);
}

function clearRenderOutput(statusText = "Ready") {
  if (renderPipelineController) renderPipelineController.clearOutput(statusText);
}

function scheduleRenderNow(options = {}) {
  if (renderPipelineController) renderPipelineController.scheduleRenderNow(options);
}

function renderNow() {
  if (renderPipelineController) renderPipelineController.renderNow();
}

initEditor();
initSearchPanelShortcuts();
initHeaderEditor();
fileHeaderController.wireActions();
if (fileContextController) fileContextController.wire();
setHeaderCollapsed(getHeaderCollapsed());
setCurrentDocument(createBlankDocument());
updateWindowTitle();
updateHeaderStateUI();
layoutController.initPaneResizer();
layoutController.initRightPaneResizer({ isRawMode: () => isRawModeActive() });
layoutController.initSidebarResizer();
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

async function confirmUnsavedChanges(contextLabel) {
  return documentSessionController
    ? documentSessionController.confirmUnsavedChanges(contextLabel)
    : "cancel";
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

async function showSaveDialog(suggestedName, suggestedDir) {
  if (!window.api || typeof window.api.showSaveDialog !== "function") return null;
  return window.api.showSaveDialog(suggestedName, suggestedDir);
}

async function showOpenFolderDialog() {
  if (!window.api || typeof window.api.showOpenFolderDialog !== "function") return null;
  return window.api.showOpenFolderDialog();
}

async function withFileLock(filePath, operation) {
  return fileOperationLocks.withFileLock(filePath, operation);
}

async function withFileLocks(filePaths, operation) {
  return fileOperationLocks.withFileLocks(filePaths, operation);
}

function countLines(text) {
  if (!text) return 1;
  return text.split(/\r\n|\n|\r/).length;
}

async function showSaveError(message) {
  if (!window.api || typeof window.api.showSaveError !== "function") return;
  await window.api.showSaveError(message);
}

async function showTransformError(message) {
  if (window.api && typeof window.api.showTransformError === "function") {
    await window.api.showTransformError(message);
    return;
  }
  await showSaveError(message);
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

async function openAbout() {
  await aboutModalController.open();
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

async function applyAbc2abcTransform(options) {
  await abcTransformFeature.apply(options || {});
}

async function confirmAbandonIfDirty(contextLabel) {
  return documentSessionController
    ? documentSessionController.confirmAbandonIfDirty(contextLabel)
    : false;
}

async function ensureSafeToAbandonCurrentDoc(actionLabel) {
  return documentSessionController
    ? documentSessionController.ensureSafeToAbandonCurrentDoc(actionLabel)
    : false;
}

async function handleMissingWorkingCopySave(filePath) {
  return saveFlowController.handleMissingWorkingCopySave(filePath);
}

async function performSaveFlow() {
  return saveFlowController.performSaveFlow();
}

async function performSaveAsFlow() {
  return saveFlowController.performSaveAsFlow();
}

function dropLibraryFileEntry(filePath) {
  return libraryMetadataController.dropLibraryFileEntry(filePath);
}

async function refreshLibraryFile(filePath, options) {
  return libraryMetadataController.refreshLibraryFile(filePath, options);
}

async function renameLibraryFile(oldPath, newPath) {
  return libraryMetadataController.renameLibraryFile(oldPath, newPath);
}

async function saveFileHeaderText(filePath, headerText) {
  return saveFlowController.saveFileHeaderText(filePath, headerText);
}

function findTuneById(tuneId) {
  return tuneClipboardController.findTuneById(tuneId);
}

async function getTuneText(tune, fileMeta) {
  return tuneClipboardController.getTuneText(tune, fileMeta);
}

async function copyTuneById(tuneId, mode) {
  return tuneClipboardController.copyTuneById(tuneId, mode);
}

function getClipboardTune() {
  return tuneClipboardController.getClipboardTune();
}

function setClipboardTune(next) {
  return tuneClipboardController.setClipboardTune(next);
}

function clearClipboardTune() {
  tuneClipboardController.clearClipboardTune();
}

async function duplicateTuneById(tuneId) {
  await duplicateTuneAction.duplicateTuneById(tuneId);
}

async function appendTuneTextToFileUnlocked(filePath, text) {
  return pasteMoveTuneAction.appendTuneTextToFileUnlocked(filePath, text);
}

async function appendTuneTextToFile(filePath, text) {
  return pasteMoveTuneAction.appendTuneTextToFile(filePath, text);
}

async function pasteClipboardToFile(targetPath) {
  await pasteMoveTuneAction.pasteClipboardToFile(targetPath);
}

async function deleteTuneById(tuneId) {
  await deleteTuneAction.deleteTuneById(tuneId);
}

async function performAppendFlow() {
  return appendCurrentTuneAction.performAppendFlow();
}

async function fileNew() {
  await newFileAction.fileNew();
}

async function createNewFileAtPath(filePath, content, options = {}) {
  return newFileAction.createNewFileAtPath(filePath, content, options);
}

async function fileNewFromTemplate() {
  await newFileAction.fileNewFromTemplate();
}

async function fileNewTune() {
  await appendCurrentTuneAction.fileNewTune();
}

async function appendTuneTextToFileNow(filePath, tuneText, { toastOk = "" } = {}) {
  return appendCurrentTuneAction.appendTextToFileNow(filePath, tuneText, { toastOk });
}

async function fileOpen() {
  if (documentSessionController) await documentSessionController.fileOpen();
}

async function fileSave() {
  if (documentSessionController) await documentSessionController.fileSave();
}

async function fileSaveAs() {
  if (documentSessionController) await documentSessionController.fileSaveAs();
}

async function requestCloseDocument() {
  if (documentSessionController) await documentSessionController.requestCloseDocument();
}

async function requestQuitApplication() {
  if (documentSessionController) await documentSessionController.requestQuitApplication();
}

async function fileClose() {
  if (documentSessionController) await documentSessionController.fileClose();
}

async function renumberXInActiveFile(explicitFilePath) {
  await renumberXAction.renumberXInActiveFile(explicitFilePath);
}

const appCommandsDomain = createAppCommandsDomain({
  api: window.api,
  windowRef: window,
  documentRef: document,
  controllers: {
    errors: errorsFeature,
    getSettingsDomain: () => settingsDomain,
    measureNavigation: measureNavigationController,
  },
  elements: {
    toggleLibraryButton: $btnToggleLibrary,
    libraryRefreshButton: $btnLibraryRefresh,
    scanErrorTunesButton: $scanErrorTunes,
    fileNewButton: $btnFileNew,
    newTuneButton: $btnNewTune,
    templatesButton: $btnTemplates,
    chordproPdfButton: $btnChordproPdf,
    fileOpenButton: $btnFileOpen,
    fileSaveButton: $btnFileSave,
    fileCloseButton: $btnFileClose,
    toggleRawButton: $btnToggleRaw,
    playPauseButton: $btnPlayPause,
    playButton: $btnPlay,
    pauseButton: $btnPause,
    stopButton: $btnStop,
    restartButton: $btnRestart,
    prevMeasureButton: $btnPrevMeasure,
    nextMeasureButton: $btnNextMeasure,
    fontsButton: $btnFonts,
    resetLayoutButton: $btnResetLayout,
    toggleSplitButton: $btnToggleSplit,
    toggleFollowButton: $btnToggleFollow,
    toggleErrorsButton: $btnToggleErrors,
    toggleGlobalsButton: $btnToggleGlobals,
  },
  state: {
    getEditorView: () => editorView,
    getFollowPlayback: () => followPlayback,
    getLatestSettings: () => latestSettingsSnapshot,
    getActiveTuneId: () => activeTuneId,
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFullView: () => chordProFeature.isFullView(),
    isErrorsEnabled,
    isGlobalHeaderEnabled: () => headerLayersController.isGlobalHeaderEnabled(),
    isMicrotonalNotationSupported,
    isPayloadMode,
    isPayloadModeSettingEnabled: () => Boolean(latestSettingsSnapshot && latestSettingsSnapshot.payloadModeEnabled),
    isPlaybackActive: () => Boolean(playbackTransport.isPlaying || playbackTransport.isPaused),
    isPlaybackBusy,
    isRawModeActive: () => isRawModeActive(),
  },
  actions: {
    alignBarsInEditor,
    applyAbc2abcTransform,
    clearLibraryFilter,
    confirmReloadFromDisk,
    discardAndReloadWorkingCopyFromDisk,
    dumpDebug: () => diagnosticsDomain.dumpDebugToFile().catch(() => {}),
    enterPayloadMode: () => payloadModeFeature.enter(),
    exitPayloadMode: () => payloadModeFeature.exit(),
    exportMidi: () => importExportFeature.exportMidi(),
    exportMp3: () => importExportFeature.exportMp3(),
    exportMusicXml: () => importExportFeature.exportMusicXml(),
    fileNew,
    fileNewFromTemplate,
    fileNewTune,
    fileOpen,
    fileSave,
    fileSaveAs,
    fileClose,
    getActiveFileEntry,
    gotoLine: () => { if (editorView) gotoLine(editorView); },
    importMidi: () => importExportFeature.importMidi(),
    importMusicXml: () => importExportFeature.importMusicXml(),
    leaveRawModeForAction,
    logError: logErr,
    navigateTuneByDelta,
    activateErrorByNav,
    enterRawMode,
    exitRawMode,
    exportChordProPdf: () => chordProFeature.exportPdf(),
    openAbout,
    openExternal,
    openFind: () => { if (editorView) openFindPanel(editorView); },
    openLibraryCatalog: () => libraryUiDomain.openCatalogFromCurrentIndex(),
    openRecentFile,
    openRecentFolder,
    openRecentTune,
    openReplace: () => { if (editorView) openReplacePanel(editorView); },
    openSetList: () => setListFeature.open(),
    openTemplatesModal,
    renumberXInActiveFile,
    requestCloseDocument,
    requestQuitApplication,
    resetLayout,
    runPrintAction: (type) => printCurrentFeature.runAction(type),
    runPrintAllAction: (type) => printAllFeature.runAction(type),
    scanAndLoadLibrary,
    setChordProFullView: (next) => chordProFeature.setFullView(next),
    setErrorsEnabled,
    setFollowPlayback: (next) => { followPlayback = Boolean(next); },
    setNoteTypingPreview: (enabled) => midiInputFeature.applySettingsPatch({ noteTypingPreviewEnabled: Boolean(enabled) }),
    setSplitOrientation,
    setStatus,
    showSaveError,
    showToast,
    toggleFileHeader: toggleHeaderCollapsed,
    toggleFocusMode,
    toggleIntonationExplorer: () => intonationExplorerFeature.toggle(),
    toggleLibrary,
    togglePlayPauseEffective,
    transportPlay,
    transportPause,
    stopPlaybackTransport,
    toggleSplitOrientation,
    transportStartOver,
    updateFollowToggle,
    getFocusedEditorView,
    toggleLineComments,
    wirePayloadMode: () => payloadModeFeature.wire(),
  },
});
appCommandsDomain.wire();

document.addEventListener("abcarus:reset-library-cache", () => {
  try {
    libraryUiDomain.invalidateView();
  } catch {}
});

settingsDomain = createSettingsDomain({
  api: window.api,
  documentRef: document,
  requestAnimationFrameRef: requestAnimationFrame,
  state: {
    getLatestSettings: () => latestSettingsSnapshot,
    setLatestSettings: (settings) => { latestSettingsSnapshot = settings || null; },
    setFollowPlayback: (next) => { followPlayback = Boolean(next); },
    setDrumVelocityMap: (next) => abcHelpersFeature.setDrumVelocityMap(next),
    getEditorDom: () => editorView ? editorView.dom : null,
    isPayloadMode,
    isMicrotonalNotationSupported,
    isIntonationExplorerVisible: () => Boolean(intonationExplorerFeature && intonationExplorerFeature.isVisible()),
    isChordProEnabled: () => chordProFeature.isEnabled(),
  },
  elements: {
    libraryTree: $libraryTree,
    renderPane: $renderPane,
  },
  controllers: {
    headerLayers: headerLayersController,
    soundfont: soundfontController,
    layout: layoutController,
    followHighlightSettings,
    playbackAutoScroll: playbackAutoScrollController,
    focusMode: focusModeController,
    printAll: printAllFeature,
    libraryUiDomain,
    midiInput: midiInputFeature,
  },
  actions: {
    centerRenderPaneOnCurrentAnchor,
    closeIntonationExplorer: () => intonationExplorerFeature.close(),
    ensureSoundfontLoaded,
    exitPayloadMode: () => payloadModeFeature.exit(),
    logStartupPerf,
    markStartupSettingsApplied: () => statusController.markStartupSettingsApplied(),
    reconfigureEditor: reconfigureAbcExtensions,
    refreshChordProPdfButtonState: (options) => chordProFeature.refreshPdfButtonState(options),
    resetPlaybackForSoundfontChange: () => {
      if (playbackTransport.player && typeof playbackTransport.player.stop === "function") {
        playbackTransport.suppressOnEnd = true;
        playbackTransport.player.stop();
      }
      playbackTransport.player = null;
      playbackTransport.playbackState = null;
      playbackTransport.playbackIndexOffset = 0;
    },
    scheduleRender: scheduleRenderNow,
    scheduleStartupLayoutReset: startupController.scheduleLayoutReset,
    setSoundfontStatus,
    showDisclaimerIfNeeded,
    showToast,
    updateErrorsFeatureUi: updateErrorsFeatureUI,
    updateFollowToggle,
    updateGlobalHeaderToggle,
    wirePayloadMode: () => payloadModeFeature.wire(),
  },
  helpers: {
    buildDefaultDrumVelocityMap,
    clampVelocity,
  },
});
logStartupPerf("settings domain init done");
settingsDomain.start();

function centerRenderPaneOnCurrentAnchor() {
  if (!$out || !$renderPane || !editorView) return;
  const activeErrorHighlight = errorsFeature.getActiveHighlight();
  const editorOffset = (activeErrorHighlight && Number.isFinite(activeErrorHighlight.from))
    ? activeErrorHighlight.from
    : editorView.state.selection.main.anchor;
  const renderOffset = (getLastRenderPayload() && Number.isFinite(getLastRenderPayload().offset))
    ? getLastRenderPayload().offset
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

document.addEventListener("keydown", (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (String(e.key || "").toLowerCase() !== "h") return;
  e.preventDefault();
  toggleHeaderCollapsed();
});

async function openTemplatesModal() {
  await templatesFeature.open();
}

initContextMenu();

startupController.start();

if ($out) {
  $out.addEventListener("click", (e) => {
    const target = e.target;
    if (!target || !target.classList) return;
    if (!target.classList.contains("note-hl")) return;
    const start = Number(target.dataset && target.dataset.start);
    const end = Number(target.dataset && target.dataset.end);
    if (Number.isFinite(start)) {
      const renderOffset = (getLastRenderPayload() && Number.isFinite(getLastRenderPayload().offset))
        ? getLastRenderPayload().offset
        : 0;
      const editorStart = Math.max(0, mapRenderIdxToEditorOffset(start));
      const editorEndRaw = Number.isFinite(end) && end > start ? end : start + 1;
      const editorEnd = Math.max(editorStart, mapRenderIdxToEditorOffset(editorEndRaw));
      if (mainEditorFeature) mainEditorFeature.setPendingPlaybackRangeOrigin("svg");
      setEditorSelectionRange(editorStart, editorEnd);
      setPlaybackRange({
        startOffset: editorStart,
        endOffset: editorEnd,
        origin: "svg",
        loop: playbackTransport.playbackRange.loop,
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

// ---------- AUDIO ----------

let followPlayback = true;

function setRenderZoomCss(zoom) {
  layoutController.setRenderZoom(zoom);
}

function readRenderZoomCss() {
  return layoutController.readRenderZoom({ fallback: getRenderZoomFactor() });
}

function computeFocusFitZoom() {
  return layoutController.computeFocusFitZoom({
    currentZoom: getRenderZoomFactor(),
    clamp: clampNumber,
  });
}

function isFocusModeEnabled() {
  return focusModeController ? focusModeController.isEnabled() : false;
}

function updateFocusModeUi() {
  if (focusModeController) focusModeController.updateUi();
}

function setFocusModeEnabled(nextEnabled) {
  if (focusModeController) focusModeController.setEnabled(nextEnabled);
}

function toggleFocusMode() {
  if (focusModeController) focusModeController.toggle();
}

function clearPlaybackNoteOnEls() {
  return playbackFollowController.clearPlaybackNoteOnEls();
}

function resetPlaybackUiState() {
  playbackAutoScrollController.resetManualPause();
  return playbackFollowController.resetPlaybackUiState();
}

function initPlaybackAutoScrollListeners() {
  return playbackAutoScrollController.initPlaybackAutoScrollListeners();
}

function cancelPlaybackAutoScroll() {
  return playbackAutoScrollController.cancelPlaybackAutoScroll();
}

function getRenderZoomFactor() {
  return layoutController ? layoutController.getRenderZoomFactor() : 1;
}

function stopPlaybackFromGuard(message) {
  if (playbackUiController) playbackUiController.handlePlaybackGuardStop(message);
}

function maybeAutoScrollRenderToCursor(el) {
  return playbackAutoScrollController.maybeAutoScrollRenderToCursor(el);
}

function clonePlaybackRange(r) {
  return playbackTransportController.clonePlaybackRange(r);
}

function setPlaybackRange(next) {
  return playbackTransportController.setPlaybackRange(next);
}

function appendPlaybackTrace(evt) {
  playbackTransport.appendTrace(evt);
}

function getPlaybackSourceKey() {
  return playbackPayloadController.getPlaybackSourceKey();
}

function updatePlayButton() {
  if (playbackUiController) playbackUiController.updatePlayButton();
}

function isPlaybackBusy() {
  return playbackUiController ? playbackUiController.isPlaybackBusy() : Boolean(playbackTransport.isPlaying || playbackTransport.isPaused || playbackTransport.waitingForFirstNote);
}

function updatePlaybackInteractionLock() {
  if (playbackUiController) playbackUiController.updatePlaybackInteractionLock();
}

function buildTransportPlaybackPlan() {
  return playbackTransportController.buildTransportPlaybackPlan();
}

function syncPendingPlaybackPlan() {
  return playbackTransportController.syncPendingPlaybackPlan();
}

function applyPlaybackPlanSpeed(plan) {
  return playbackTransportController.applyPlaybackPlanSpeed(plan);
}

async function togglePlayPauseEffective() {
  return playbackTransportController.togglePlayPauseEffective();
}

async function transportStartOver() {
  return playbackTransportController.transportStartOver();
}

async function transportTogglePlayPause() {
  return playbackTransportController.transportTogglePlayPause();
}

async function transportPlay() {
  return playbackTransportController.transportPlay();
}

async function transportPause() {
  return playbackTransportController.transportPause();
}

function resetPlaybackState() {
  return playbackTransportController.resetPlaybackState();
}

function highlightSourceAt(idx, on) {
  return playbackFollowController.highlightSourceAt(idx, on);
}

function maybeScrollEditorToOffset(editorOffset) {
  return playbackFollowController.maybeScrollEditorToOffset(editorOffset);
}

function schedulePlaybackUiUpdate(istart) {
  return playbackFollowController.schedulePlaybackUiUpdate(istart);
}

function maybeScrollRenderToNote(el) {
  return playbackFollowController.maybeScrollRenderToNote(el);
}

async function ensureSoundfontLoaded() {
  return soundfontController.ensureLoaded();
}

async function ensureSoundfontReady() {
  return soundfontController.ensureReady();
}

function ensurePlayer() {
  return playbackPlayerController.ensurePlayer();
}

function setFollowVoiceFromPlayback() {
  return playbackFollowController.setFollowVoiceFromPlayback();
}

function buildPlaybackState(firstSymbol) {
  const editorLength = editorView ? editorView.state.doc.length : 0;
  return buildPlaybackStateModel(firstSymbol, { editorLength, playbackIndexOffset: playbackTransport.playbackIndexOffset });
}

function snapIstartToPlayable(istart) {
  return snapIstartToPlayableModel(playbackTransport.playbackState, istart);
}

function findSymbolAtOrBefore(idx) {
  return findPlaybackSymbolAtOrBefore(playbackTransport.playbackState, idx);
}

function findSymbolAtOrAfter(idx) {
  return findPlaybackSymbolAtOrAfter(playbackTransport.playbackState, idx);
}

function findMeasureIndex(idx) {
  return findPlaybackMeasureIndex(playbackTransport.playbackState, idx);
}

function stopPlaybackForRestart() {
  return playbackTransportController.stopPlaybackForRestart();
}

function stopPlaybackTransport() {
  return playbackTransportController.stopPlaybackTransport();
}

function toDerivedOffset(editorOffset) {
  const raw = Number(editorOffset);
  if (!Number.isFinite(raw)) return null;
  return raw + (playbackTransport.playbackIndexOffset || 0);
}

function toEditorOffset(derivedOffset) {
  const raw = Number(derivedOffset);
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, raw - (playbackTransport.playbackIndexOffset || 0));
}

function updateGlobalHeaderToggle() {
  headerLayersController.updateToggle();
}

function updateFollowToggle() {
  if (playbackUiController) playbackUiController.updateFollowToggle();
}

function clampNumber(value, min, max, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function clampInt(value, min, max, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  const n = Math.floor(v);
  return Math.max(min, Math.min(max, n));
}

function computeFocusPlaybackPlanFromCurrentState() {
  return focusModeController
    ? focusModeController.computePlaybackPlan()
    : { ok: false, reason: "Cannot resolve visible scope in Focus mode." };
}

function updatePracticeUi() {
  if (focusModeController) focusModeController.updatePracticeUi();
}

function normalizeLoopBounds(fromMeasure, toMeasure) {
  return focusModeController ? focusModeController.normalizeLoopBounds(fromMeasure, toMeasure) : { from: 0, to: 0 };
}

function normalizeFocusLoopBoundsForPlayback() {
  return focusModeController ? focusModeController.normalizeLoopBoundsForPlayback() : false;
}

function maybeResetFocusLoopForTune(tuneId, { updateUi = true } = {}) {
  if (focusModeController) focusModeController.maybeResetLoopForTune(tuneId, { updateUi });
}

function setSplitOrientation(nextOrientation, { persist = true, userAction = false } = {}) {
  const before = layoutController.getRightSplitOrientation();
  const ok = layoutController.setSplitOrientation(nextOrientation, { persist, userAction });
  if (ok && before !== layoutController.getRightSplitOrientation()) {
    playbackFollowController.suppressFollowScroll();
  }
  return ok;
}

function toggleSplitOrientation({ userAction = false } = {}) {
  const before = layoutController.getRightSplitOrientation();
  const ok = layoutController.toggleSplitOrientation({ userAction });
  if (ok && before !== layoutController.getRightSplitOrientation()) {
    playbackFollowController.suppressFollowScroll();
  }
  return ok;
}

function buildHeaderPrefix(entryHeader, includeCheckbars, tuneText) {
  return headerLayersController.buildHeaderPrefix(entryHeader, includeCheckbars, tuneText);
}

function buildHeaderPrefixWithLayerSpans(entryHeader, includeCheckbars, tuneText) {
  return headerLayersController.buildHeaderPrefixWithLayerSpans(entryHeader, includeCheckbars, tuneText);
}

function getPlaybackPayload() {
  return playbackPayloadController.getPlaybackPayload();
}

function getRenderPayload() {
  return renderPayloadController.getRenderPayload();
}

async function preparePlayback() {
  return playbackPrepareController.preparePlayback();
}

function startPlaybackFromPrepared(startIdx) {
  return playbackStartController.startPlaybackFromPrepared(startIdx);
}

function resolvePlaybackEndSymbol(range, startSymbol) {
  return playbackStartController.resolvePlaybackEndSymbol(range, startSymbol);
}

async function startPlaybackFromRange(rangeOverride) {
  return playbackStartController.startPlaybackFromRange(rangeOverride);
}

async function startPlaybackAtIndex(startIdx) {
  return playbackStartController.startPlaybackAtIndex(startIdx);
}

function pausePlayback() {
  return playbackStartController.pausePlayback();
}

async function startPlaybackAtMeasureOffset(delta) {
  return playbackStartController.startPlaybackAtMeasureOffset(delta);
}

async function playDrumPreview(pitch, velocity) {
  return drumPreviewController.playDrumPreview(pitch, velocity);
}

async function persistLoopSettingsPatch(patch) {
  if (!window.api || typeof window.api.updateSettings !== "function") return;
  try { await window.api.updateSettings(patch); } catch {}
}

if (focusModeController) focusModeController.wireControls();

document.addEventListener("drum:preview", (event) => {
  const detail = event && event.detail ? event.detail : {};
  playDrumPreview(detail.pitch, detail.velocity);
});

updatePlayButton();
updateFollowToggle();

diagnosticsDomain.runDevAutoscrollDemo({
  readFile,
  setEditorTextClean: (text) => {
    suppressDirty = true;
    try {
      setEditorValue(String(text || ""));
    } finally {
      suppressDirty = false;
    }
  },
  scheduleRender: () => scheduleRenderNow(),
  getOutputElement: () => $out,
  setRenderZoom: setRenderZoomCss,
  getRenderZoomFactor,
  setFocusModeEnabled,
  setAutoscrollModeForDev: (mode) => playbackAutoScrollController.setModeForDev(mode),
  togglePlayPause: togglePlayPauseEffective,
  stopPlayback: stopPlaybackTransport,
}).catch(() => {});
