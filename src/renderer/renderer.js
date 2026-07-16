import {
  EditorView,
  EditorState,
  EditorSelection,
  basicSetup,
  Compartment,
  keymap,
  ViewPlugin,
  indentUnit,
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
  foldBeginTextBlocks,
  indentSelectionLess,
  indentSelectionMore,
  initSearchPanelShortcuts,
  isInBeginTextBlockAtLine,
  moveLineSelection,
  openFindPanel,
  openReplacePanel,
} from "./editor/editor_commands.js";
import {
  parseDecorationCatalogEnrichment,
} from "./editor/abc_helpers_model.js";
import {
  openDecorationPickerAtCursor,
  openKeySignaturePickerAtCursor,
  openMidiProgramPickerAtCursor,
} from "./editor/abc_helpers_controller.js";
import { createErrorsFeature } from "./editor/errors_feature.js";
import {
  detectMeterMismatchInBarlines,
  detectRepeatMarkerAfterShortBar,
} from "./editor/errors_bar_mismatch_model.js";
import {
  parseErrorLocation,
} from "./editor/errors_model.js";
import { buildAbcHoverTooltip } from "./editor/abc_hover.js";
import { GM_PROGRAM_NAMES } from "./editor/gm_programs.js";
import {
  buildAbDecorations,
  buildIntonationHighlightDecorations,
  buildPayloadLayerDecorations,
  buildPracticeBarDecorations,
} from "./editor/range_decorations.js";
import { initSettings } from "./settings.js";
import {
  normalizeMeasuresLineBreaks,
  transformMeasuresPerLine,
} from "./measures.mjs";
import {
  buildDefaultDrumVelocityMap,
  clampVelocity,
  velocityToDynamic,
} from "./drums.js";
import { createLibraryViewStore } from "./library/store.js";
import { createLibraryActions } from "./library/actions.js";
import { buildGroupEntries as buildGroupEntriesCore } from "./library/group_entries.js";
import { createLibraryMetadataController } from "./library/library_metadata_controller.js";
import { createLibraryLifecycleController } from "./library/library_lifecycle_controller.js";
import { createLibraryShellController } from "./library/library_shell_controller.js";
import { createTuneClipboardController } from "./library/tune_clipboard_controller.js";
import { createLibraryTreeView } from "./library/tree_view.js";
import { createLibraryContextMenu } from "./library/context_menu.js";
import { createAppendTuneToActiveFileAction } from "./library/append_tune_action.js";
import { createAppendCurrentTuneAction } from "./library/append_current_tune_action.js";
import { createDeleteTuneAction } from "./library/delete_tune_action.js";
import { createDuplicateTuneAction } from "./library/duplicate_tune_action.js";
import { createPasteMoveTuneAction } from "./library/paste_move_tune_action.js";
import { createRenumberXAction } from "./library/renumber_x_action.js";
import { createNewFileAction } from "./library/new_file_action.js";
import { createRenameFileController } from "./library/rename_file_controller.js";
import { createMoveTuneModalController } from "./library/move_tune_modal_controller.js";
import { createXIssuesModalController } from "./library/x_issues_modal_controller.js";
import { normalizeLibraryPath, pathsEqual } from "./library/path_utils.js";
import {
  getEntryTuneCount,
} from "./library/sorting_filtering.js";
import { createLibraryUiStateController } from "./library/ui_state_controller.js";
import { fileExists, mkdirp, readFile, renameFile, safeBasename, safeDirname, writeFile } from "./io/file_ops.js";
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
  normalizeSuggestedKeyName,
  parseAbcHeaderFields,
  parseTuneIdentityFields,
} from "./abc/header_fields.js";
import {
  buildHeaderPrefixFromLayers,
  buildHeaderPrefixWithLayerSpansFromLayers,
  collectHeaderKeys,
  normalizeHeaderLayer,
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
import { openDrumHelperAtCursor } from "./tools/drum_helper/drum_helper_controller.js";
import { openGchordHelperAtCursor } from "./tools/gchord_helper/gchord_helper_controller.js";
import { createRawModeFeature } from "./tools/raw_mode/raw_mode_feature.js";
import { createAbcTransformFeature } from "./tools/transforms/abc_transform_feature.js";
import { createSetListFeature } from "./tools/set_list/set_list_feature.js";
import { createSetListRendererAdapter } from "./tools/set_list/set_list_renderer_adapter.js";
import { createSourceLinkFeature } from "./tools/source_link/source_link_feature.js";
import { createMicrotonalToolsFeature } from "./tools/microtonal/microtonal_tools_feature.js";
import { createIntonationExplorerFeature } from "./tools/intonation_explorer/intonation_explorer_feature.js";
import { createTemplatesFeature } from "./tools/templates/templates_feature.js";
import { createMidiInputFeature } from "./tools/midi_input/midi_input_feature.js";
import { createPayloadModeFeature } from "./tools/payload_mode/payload_mode_feature.js";
import { createPayloadModeDecorations } from "./tools/payload_mode/payload_mode_decorations.js";
import { createPayloadModeEditorAdapter } from "./tools/payload_mode/payload_mode_editor_adapter.js";
import { computePayloadTuneOffset } from "./tools/payload_mode/payload_mode_model.mjs";
import {
  applyMutedVoicesToTuneRoot,
  buildSelectionPlaybackToast,
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
import { createAbSelectionPlaybackController } from "./playback/ab_selection_playback_controller.js";
import { createSelectionPlaybackRuntime } from "./playback/selection_playback_runtime.js";
import {
  expandRepeatsForPlayback,
  shouldForceRepeatExpansionForPlayback,
} from "./playback/repeat_expansion_model.js";
import {
  detectKeyFieldNotLastBeforeBody,
  injectGchordOn,
  isInlineFieldOnlyLine,
  normalizeBarsForPlayback,
  normalizeBlankLinesForPlayback,
  normalizeDollarLineBreaksForPlayback,
  normalizeLeadingInlineDirectivesForPlayback,
  normalizeReadableMidiDrumsForPlayback,
  relocateMidiDrumDirectivesIntoBody,
  sanitizeAbcForPlayback,
  stripChordSymbolsForPlayback,
  stripLyricsForPlayback,
} from "./playback/playback_payload_model.js";
import {
  buildPlaybackState as buildPlaybackStateModel,
  findPlaybackMeasureIndex,
  findPlaybackSymbolAtOrAfter,
  findPlaybackSymbolAtOrBefore,
  snapIstartToPlayable as snapIstartToPlayableModel,
  upperBoundTime,
} from "./playback/playback_state_model.js";
import {
  buildFocusPlaybackPlan as buildFocusPlaybackPlanModel,
} from "./playback/focus_playback_model.js";
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
import {
  applyPrintDebugMarkup as applyPrintDebugMarkupCore,
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
import { createDiagnosticsController } from "./app/diagnostics/diagnostics_controller.js";
import { createDebugDumpFeature } from "./app/diagnostics/debug_dump_feature.js";
import { installDevUiSmokeHook } from "./app/diagnostics/dev_ui_smoke_hook.js";
import { createToolStatusController } from "./app/ui/tool_status_controller.js";
import { createStatusController } from "./app/ui/status_controller.js";
import { createToastHoverController } from "./app/ui/toast_hover_controller.js";
import { createFileHeaderController } from "./app/document/file_header_controller.js";
import { createFileContextController } from "./app/document/file_context_controller.js";
import { createEditStateController } from "./app/document/edit_state_controller.js";
import { createFileOperationGuard } from "./app/document/file_operation_guard.js";
import { createPlaybackUiController } from "./app/ui/playback_ui_controller.js";
import {
  setEditorHelpFromSettings as applyEditorHelpSettings,
  setUiFontsFromSettings as applyUiFontSettings,
} from "./app/ui/settings_applicator.js";
import { createDocumentLifecycleController } from "./app/document/document_lifecycle_controller.js";
import { createSaveFlowController } from "./app/document/save_flow_controller.js";
import { createWorkingCopySyncController } from "./app/document/working_copy_sync_controller.js";
import { createCurrentDocumentController } from "./app/document/current_document_controller.js";
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
let isNewTuneDraft = false;
let rawMode = false;
let rawModeFilePath = null;
let rawModeHeaderEndOffset = 0;
let rawModeOriginalTuneId = null;
let payloadModeDecorations = null;
let fileContextController = null;
let editStateController = null;
let fileOperationGuard = null;
let playbackUiController = null;
let documentLifecycleController = null;
let documentSessionController = null;
let saveFlowController = null;
let libraryMetadataController = null;
let libraryLifecycleController = null;
let libraryShellController = null;
let tuneClipboardController = null;
let deleteTuneAction = null;
let duplicateTuneAction = null;
let pasteMoveTuneAction = null;
let renumberXAction = null;
let appendCurrentTuneAction = null;
let newFileAction = null;

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

const soundfontController = createSoundfontController({
  windowRef: window,
  api: window.api,
  elements: {
    label: $soundfontLabel,
  },
  state: {
    isPlaying: () => isPlaying,
    isPaused: () => isPaused,
    isWaitingForFirstNote: () => waitingForFirstNote,
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
});

const payloadModeEditorAdapter = createPayloadModeEditorAdapter({
  getEditorView: () => editorView,
  getEditorText: () => getEditorValue(),
  setEditorText: setEditorValue,
  setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
  readOnlyCompartment: abcPayloadReadOnlyCompartment,
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
  isRawMode: () => rawMode,
  isFocusModeEnabled: () => focusModeEnabled,
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
    getRawMode: () => rawMode,
    isPayloadMode,
    isTuneErrorFilterActive,
    isTuneErrorScanInFlight,
  },
  actions: {
    selectTune,
    selectTuneInRaw,
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
  isRawMode: () => rawMode,
  isPayloadMode,
  isPlaying: () => isPlaying,
  getActivePlaybackRange: () => activePlaybackRange,
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
  isRawMode: () => rawMode,
  isPayloadMode,
  getActiveTuneMeta: () => activeTuneMeta,
  getEditorText: () => editorView ? editorView.state.doc.toString() : "",
  getEditorView: () => editorView,
  getRenderPayload,
  getLastRenderPayload: () => lastRenderPayload,
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
  isPlaying: () => isPlaying,
  isPaused: () => isPaused,
  getPlaybackRange: () => playbackRange,
  setPlaybackRange,
  setPendingPlaybackRangeOrigin: (origin) => { pendingPlaybackRangeOrigin = origin; },
  setSuppressPlaybackRangeSelectionSync: (value) => { suppressPlaybackRangeSelectionSync = Boolean(value); },
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
    if (t) {
      clearTimeout(t);
      t = null;
    }
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
  return Boolean(focusModeEnabled)
    && (
      clampInt(playbackLoopFromMeasure, 0, 100000, 0) > 0
      || clampInt(playbackLoopToMeasure, 0, 100000, 0) > 0
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
let practiceBarHighlightRange = null; // {from,to} editor offsets
let practiceBarHighlightVersion = 0;
let lastSvgPracticeBarEls = [];
let lastSvgFollowBarEls = [];
let lastSvgFollowMeasureEls = [];
let lastSvgPlayheadEl = null;
let lastSvgPlayheadSvg = null;
let lastSvgPlayheadXCenter = null;

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
  errorsFeature.clearSvgHighlight();
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
  return errorsFeature.highlightSvgAtEditorOffset(editorOffset);
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
  return diagnosticsController ? diagnosticsController.isIntonationPerfEnabled() : false;
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

function isFilePerfEnabled() {
  return diagnosticsController ? diagnosticsController.isFilePerfEnabled() : false;
}

function logFilePerf(label, data) {
  if (diagnosticsController) diagnosticsController.logFilePerf(label, data);
}

function isRenderPerfEnabled() {
  return diagnosticsController ? diagnosticsController.isRenderPerfEnabled() : false;
}

function logRenderPerf(label, data) {
  if (diagnosticsController) diagnosticsController.logRenderPerf(label, data);
}

function reportStartupStatus(text) {
  if (diagnosticsController) diagnosticsController.reportStartupStatus(text);
}

function abbreviatePathForLog(fullPath, tailSegments = 3) {
  return diagnosticsController ? diagnosticsController.abbreviatePathForLog(fullPath, tailSegments) : "";
}

function setUiFontsFromSettings(settings) {
  applyUiFontSettings({
    documentRef: document,
    settings,
    libraryTree: $libraryTree,
  });
}

function setEditorHelpFromSettings(settings) {
  applyEditorHelpSettings({
    settings,
    reconfigureEditor: reconfigureAbcExtensions,
  });
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
const toolStatusController = createToolStatusController({
  element: $toolStatus,
  api: window.api,
  showToast,
});
const toastHoverController = createToastHoverController({
  documentRef: document,
  toastElement: $toast,
  hoverElement: $hoverStatus,
  isDebugMessagesEnabled,
});
const debugDumpFeature = createDebugDumpFeature({
  api: window.api,
  windowRef: window,
  documentRef: document,
  getAutoDumpDirOverride: () => AUTO_DUMP_DIR_OVERRIDE,
  getActiveTuneMeta: () => activeTuneMeta,
  getCurrentDoc: getCurrentDocument,
  getDebugLogBuffer: () => diagnosticsController ? diagnosticsController.debugLogBuffer : [],
  getRecentActions: () => diagnosticsController ? diagnosticsController.recentActions : [],
  getEditorView: () => editorView,
  getHeaderDirty,
  getHeaderCollapsed,
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
  getSoundfontName: () => soundfontController.getName(),
  getSoundfontSource: () => soundfontController.getSource(),
  getSoundfontReadyName: () => soundfontController.getReadyName(),
  getLastSoundfontApplied: () => soundfontController.getLastApplied(),
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
  getLastRhythmErrorSuggestion: () => errorsFeature.getLastRhythmErrorSuggestion(),
  getLastRenderPayload: () => lastRenderPayload,
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
});
debugDumpFeature.exposeGlobalApi();
debugDumpFeature.installGlobalShortcuts();
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
let settingsController = null;
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
  getSidebarWidth: () => libraryUiStateController ? libraryUiStateController.getLastSidebarWidth() : 280,
  setSidebarWidth: (value) => { if (libraryUiStateController) libraryUiStateController.setLastSidebarWidth(value); },
  saveLibraryPrefs: (patch) => { if (libraryUiStateController) libraryUiStateController.scheduleSaveLibraryPrefs(patch); },
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
let suppressRecentEntries = false;
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
const MAX_FILE_CONTENT_CACHE_ENTRIES = 12;
const fileContentCache = new Map();

function getRenderCompatMap() {
  return getRenderCompatMapFromPayload(lastRenderPayload);
}

function mapSourceOffsetToRenderOffset(offset, compatMap = getRenderCompatMap()) {
  return mapSourceOffsetToRenderOffsetCore(offset, compatMap);
}

function mapRenderOffsetToSourceOffset(offset, compatMap = getRenderCompatMap()) {
  return mapRenderOffsetToSourceOffsetCore(offset, compatMap);
}

function mapEditorOffsetToRenderIdx(editorOffset, payload = lastRenderPayload) {
  return mapEditorOffsetToRenderIdxCore(editorOffset, payload);
}

function mapRenderIdxToEditorOffset(renderIdx, payload = lastRenderPayload) {
  return mapRenderIdxToEditorOffsetCore(renderIdx, payload);
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

function normalizeFileContentCacheKey(filePath) {
  return normalizeLibraryPath(filePath || "");
}

function getFileContentFromCache(filePath) {
  const key = normalizeFileContentCacheKey(filePath);
  if (!key) return undefined;
  return lruGet(fileContentCache, key);
}

function setFileContentInCache(filePath, content) {
  const key = normalizeFileContentCacheKey(filePath);
  if (!key) return;
  lruSet(fileContentCache, key, content, MAX_FILE_CONTENT_CACHE_ENTRIES);
}

function countLinesForPrefix(text) {
  const src = String(text || "");
  if (!src.trim()) return 0;
  const trimmed = src.replace(/[\r\n]+$/, "");
  return trimmed ? trimmed.split(/\r\n|\n|\r/).length : 0;
}

let workingCopySnapshot = null;
let lazyWorkingCopyOpenSeq = 0;
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

function scheduleLazyWorkingCopyOpenForActiveFile(filePath, reason = "selectTune") {
  const p = String(filePath || "");
  if (!p) return;
  if (!window.api || typeof window.api.openWorkingCopy !== "function") return;
  if (workingCopySnapshot && workingCopySnapshot.path && pathsEqual(workingCopySnapshot.path, p)) return;

  const seq = (lazyWorkingCopyOpenSeq += 1);
  const perfOn = isFilePerfEnabled();
  const t0 = perfOn ? perfNowMs() : 0;
  recordRecentAction("wc.open.lazy", { path: p, reason });

  window.api.openWorkingCopy(p).then(async (res) => {
    if (seq !== lazyWorkingCopyOpenSeq) return;
    if (res && res.ok === false) {
      if (perfOn) logFilePerf("lazyWorkingCopyOpen: failed", { ms: Math.round(perfNowMs() - t0), file: safeBasename(p), error: res.error || "" });
      return;
    }
    const snapshot = await refreshWorkingCopySnapshot();
    if (seq !== lazyWorkingCopyOpenSeq) return;
    if (!snapshot || !snapshot.path || !pathsEqual(snapshot.path, p)) return;
    attachTuneUidsToLibraryFile(p, snapshot);
    scheduleRenderLibraryTree();
    if (perfOn) logFilePerf("lazyWorkingCopyOpen: done", { ms: Math.round(perfNowMs() - t0), file: safeBasename(p) });
    if (
      activeTuneMeta
      && activeTuneMeta.path
      && pathsEqual(activeTuneMeta.path, p)
      && isCurrentDocumentDirty()
    ) {
      scheduleWorkingCopyTuneSync();
    }
  }).catch((err) => {
    if (perfOn) logFilePerf("lazyWorkingCopyOpen: error", {
      ms: Math.round(perfNowMs() - t0),
      file: safeBasename(p),
      error: err && err.message ? String(err.message) : String(err),
    });
  });
}

async function confirmReloadFromDisk(filePath) {
  if (!window.api || typeof window.api.confirmReloadFromDisk !== "function") return false;
  return Boolean(await window.api.confirmReloadFromDisk(filePath));
}

async function resolveWorkingCopySaveConflictDefault(filePath, { restoreTuneId = null } = {}) {
  const p = String(filePath || "");
  if (!p) return { ok: false, cancelled: true, action: "cancel" };
  if (!window.api || typeof window.api.confirmSaveConflict !== "function") {
    markDiskConflictPath(p, true);
    return { ok: false, action: "cancel", error: "File changed on disk. Save conflict dialog is unavailable." };
  }
  const choice = await window.api.confirmSaveConflict(p);
  if (choice === "save_copy_as") {
    return saveWorkingCopyCopyAsAndSwitch(p, { restoreTuneId });
  }
  if (choice === "discard_reload") {
    return discardAndReloadWorkingCopyFromDisk(p, { restoreTuneId });
  }
  if (choice !== "overwrite") {
    markDiskConflictPath(p, true);
    return { ok: false, cancelled: true, action: "cancel" };
  }
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
  const reloaded = await window.api.reloadWorkingCopyFromDisk({ force: true });
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
    fileHeaderController.setEditorValueClean(parts.headerText);
    suppressDirty = true;
    setEditorValue(parts.bodyText);
    suppressDirty = false;
    markHeaderClean();
    updateHeaderStateUI();
    patchCurrentDocument({ path: p, content: parts.bodyText, dirty: false }, { create: false });
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
    fileHeaderController.setEditorValueClean(parts.headerText);
    suppressDirty = true;
    setEditorValue(parts.bodyText);
    suppressDirty = false;
    markHeaderClean();
    updateHeaderStateUI();
    patchCurrentDocument({ path: targetPath, content: parts.bodyText, dirty: false }, { create: false });
    setDirtyIndicator(false);
  } else if (restoreTuneId) {
    try { await selectTune(restoreTuneId, { skipConfirm: true, suppressRecent: true }); } catch {}
  }

  markDiskConflictPath(fromPath, false);
  markDiskConflictPath(targetPath, false);
  return { ok: true, updatedFile, targetPath };
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
const MAX_NAV_FILE_HISTORY = 20;
const navFileHistory = [];
let isLibraryVisible = true;
let latestSettingsSnapshot = null;

workingCopySyncController = createWorkingCopySyncController({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getChordProFullText: () => chordProFeature.getFullText(),
    getCurrentDocumentPath,
    getRawMode: () => rawMode,
    getWorkingCopySnapshot: () => workingCopySnapshot,
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
    setActiveTuneUid: (value) => { activeTuneUid = value ? String(value) : null; },
    setDirtyIndicator,
    setEditorValueClean: (text) => {
      suppressDirty = true;
      setEditorValue(text);
      suppressDirty = false;
    },
    setFileContentInCache,
  },
});

appendCurrentTuneAction = createAppendCurrentTuneAction({
  api: window.api,
  SAVE_INTENT,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocumentPath,
    getCurrentNavFilePath,
    getEditorText: getEditorValue,
    getSaveSession: resolveSaveSession,
  },
  actions: {
    confirmAppendToFile,
    ensureSafeToAbandonCurrentDoc,
    ensureXNumberInAbc,
    getActiveFileEntry,
    getNextXNumber,
    markDiskConflictPath,
    markHeaderClean,
    parseTuneIdentityFields,
    patchCurrentDocument,
    pathsEqual,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    resolveWorkingCopySaveConflictDefault,
    selectTune,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setFileContentInCache,
    setIsNewTuneDraft: (value) => { isNewTuneDraft = Boolean(value); },
    setSaveSession,
    setStatus,
    setDirtyIndicator,
    showSaveError,
    showToast,
    syncLibraryFileFromWorkingCopySnapshot,
    updateHeaderStateUI,
    withFileLock,
  },
});

newFileAction = createNewFileAction({
  api: window.api,
  constants: {
    newFileMinimalAbc: NEW_FILE_MINIMAL_ABC,
    templateAbc: TEMPLATE_ABC,
  },
  actions: {
    confirmOverwrite,
    ensureSafeToAbandonCurrentDoc,
    ensureXNumberInAbc,
    fileExists,
    getDefaultSaveDir,
    getSuggestedBaseName,
    loadLibraryFileIntoEditor,
    mkdirp,
    patchCurrentDocument,
    recordNavFilePath,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    safeBasename,
    safeDirname,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setActiveTuneText,
    setDirtyIndicator,
    setFileContentInCache,
    setFileNameMeta,
    showSaveDialog,
    showSaveError,
    showToast,
    stripFileExtension,
    updateFileHeaderPanel,
    updateWindowTitle,
    withFileLock,
    writeFile,
  },
});

saveFlowController = createSaveFlowController({
  api: window.api,
  SAVE_INTENT,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocument,
    getCurrentDocumentPath,
    getFocusModeEnabled: () => focusModeEnabled,
    getHeaderDirty,
    getHeaderEditorValue,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getLibraryIndex: () => libraryIndex,
    getRawMode: () => rawMode,
    getWorkingCopySnapshot: () => workingCopySnapshot,
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
    performSimpleTuneSave,
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
    updateFileHeaderPanel,
    updateHeaderStateUI,
    updateLibraryStatus,
    updateWindowTitle,
    withFileLock,
    writeFile,
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

const libraryViewStore = createLibraryViewStore({
  getIndex: () => libraryIndex,
  safeBasename,
});
libraryShellController = createLibraryShellController({
  api: window.api,
  documentRef: document,
  windowRef: window,
  elements: {
    main: $main,
  },
  state: {
    getLibraryVisible: () => isLibraryVisible,
    setLibraryVisibleState: (value) => { isLibraryVisible = Boolean(value); },
    isLibraryDisabled: () => chordProFeature.isEnabled(),
    getLastSidebarWidth: () => libraryUiStateController ? libraryUiStateController.getLastSidebarWidth() : 280,
    getLibraryIndex: () => libraryIndex,
  },
  actions: {
    ensureSafeToAbandonCurrentDoc,
    loadLibraryFromFolder,
    renderBufferStatus,
    resetRightPaneSplit,
    scheduleSaveLibraryPrefs,
    setPaneSizes,
    setStatus,
    showOpenFolderDialog,
    showToast,
  },
  constants: {
    MIN_PANE_WIDTH,
  },
});
libraryUiStateController = createLibraryUiStateController({
  windowRef: window,
  api: window.api,
  documentRef: document,
  safeBasename,
  pathsEqual,
  getLibraryIndex: () => libraryIndex,
  getLibraryFilter: () => libraryFilter,
  getLibraryTextFilter: () => libraryTextFilter,
  setLibraryTextFilter: (value) => {
    libraryTextFilter = String(value || "").trim();
    if ($librarySearch) $librarySearch.value = libraryTextFilter;
  },
  getActiveFilePath: () => activeFilePath,
  setActiveFilePath: (filePath) => { activeFilePath = filePath || null; },
  getActiveTuneId: () => activeTuneId,
  getActiveTuneMeta: () => activeTuneMeta,
  setLibraryVisible,
  scheduleRenderLibraryTree,
  renderLibraryTree,
  updateLibraryStatus,
  updateLibraryRootUI,
  libraryViewStore,
  buildGroupEntries,
  selectTune,
  refreshLibraryFile,
  hasFullLibraryIndex,
  ensureFullLibraryIndex,
  onModalRowsChanged: () => {
    const rows = libraryViewStore.getModalRows();
    document.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
  },
  searchDebounceMs: 180,
});
const libraryActions = createLibraryActions({
  openTuneFromSelection: openTuneFromLibrarySelection,
});
window.libraryActions = libraryActions;
const renameFileController = createRenameFileController({
  elements: {
    libraryTree: $libraryTree,
  },
  state: {
    getActiveEditFilePath,
    hasGlobalUnsavedChanges,
    hasUnsavedChangesForFile,
    isWorkingCopyOpenForFile,
  },
  actions: {
    renderLibraryTree,
    renameLibraryFile,
    showSaveError,
    showToast,
    withFileLocks,
  },
  io: {
    fileExists,
    renameFile,
  },
  utils: {
    pathsEqual,
    safeDirname,
  },
});
const libraryTreeView = createLibraryTreeView({
  documentRef: document,
  windowRef: window,
  treeElement: $libraryTree,
  tuneSelectElement: $fileTuneSelect,
  collapsedFiles: libraryUiStateController.getCollapsedFiles(),
  collapsedGroups: libraryUiStateController.getCollapsedGroups(),
  getVisibleLibraryFiles,
  getLibraryTextFilter: () => libraryTextFilter,
  applyLibraryTextFilter,
  sortLibraryFiles,
  buildGroupEntries: (files) => buildGroupEntries(files, libraryUiStateController.getGroupMode()),
  sortGroupEntries,
  sortTunes: (tunes) => sortTunes(tunes, libraryUiStateController.getTuneSortMode()),
  getEntryTuneCount,
  getRenamingFilePath: () => renameFileController.getRenamingFilePath(),
  setRenamingFilePath: (value) => renameFileController.setRenamingFilePath(value),
  getActiveFilePath: () => activeFilePath,
  setActiveFilePath: (value) => { activeFilePath = value || null; },
  getActiveEditorFilePath: () => (activeTuneMeta && activeTuneMeta.path)
    ? String(activeTuneMeta.path || "")
    : getCurrentDocumentPath(),
  getActiveTuneId: () => activeTuneId,
  getActiveTuneUid: () => activeTuneUid,
  isPayloadMode,
  isRawMode: () => rawMode,
  pathsEqual,
  commitRenameFile,
  requestLoadLibraryFile,
  moveTuneToFile,
  showContextMenuAt,
  scheduleSaveLibraryUiState,
  updateFileHeaderPanel,
  showHoverStatus,
  restoreHoverStatus,
  pinHoverStatus,
  selectTuneInRaw,
  openTuneFromLibrarySelection,
  showToast,
});
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
const appendTuneToActiveFileAction = createAppendTuneToActiveFileAction({
  api: window.api,
  getActiveTuneMeta: () => activeTuneMeta,
  getCurrentDocDirty: isCurrentDocumentDirty,
  getHeaderDirty,
  getRawMode: () => rawMode,
  findTuneById,
  getTuneText,
  pathsEqual,
  withFileLock,
  refreshWorkingCopySnapshot,
  markDiskConflictPath,
  setFileContentInCache,
  syncLibraryFileFromWorkingCopySnapshot,
  appendTuneTextToFileUnlocked,
  refreshLibraryFile,
  setActiveFilePath: (filePath) => { activeFilePath = filePath || null; },
  selectTune,
  getNextXNumber,
  ensureXNumberInAbc,
  confirmAppendToFile,
  showToast,
});
const libraryContextMenu = createLibraryContextMenu({
  documentRef: document,
  windowRef: window,
  navigatorRef: navigator,
  getLibraryIndex: () => libraryIndex,
  getLibraryTextFilter: () => libraryTextFilter,
  setLibraryTextFilter: (value) => {
    libraryTextFilter = value || "";
    if ($librarySearch) $librarySearch.value = libraryTextFilter;
  },
  getActiveTuneId: () => activeTuneId,
  getActiveTuneUid: () => activeTuneUid,
  getActiveTuneMeta: () => activeTuneMeta,
  getCurrentDocDirty: isCurrentDocumentDirty,
  getHeaderDirty,
  getIsNewTuneDraft: () => isNewTuneDraft,
  getRawMode: () => rawMode,
  getClipboardTune,
  getEditorView: () => editorView,
  getWindowApi: () => window.api,
  pathsEqual,
  safeBasename,
  findTuneById,
  hasUnsavedChangesForFile,
  isWorkingCopyOpenForFile,
  hasDiskConflictPath,
  confirmReloadFromDisk,
  discardAndReloadWorkingCopyFromDisk,
  requestLoadLibraryFile,
  deleteTuneById,
  copyTuneById,
  duplicateTuneById,
  pasteClipboardToFile,
  promptFindInLibrary: () => {
    setLibraryVisible(true);
    if ($librarySearch) {
      $librarySearch.focus();
      try { $librarySearch.select(); } catch {}
    }
  },
  renderLibraryTree,
  updateLibraryStatus,
  refreshLibraryIndex,
  beginRenameFile,
  openXIssues: (filePath) => xIssuesModalController.open(filePath),
  renumberXInActiveFile,
  openMoveTuneModal,
  addTuneToSetList: (tuneId) => setListFeature.addTuneById(tuneId),
  appendTuneToActiveFile: (tuneId) => appendTuneToActiveFileAction.run(tuneId),
  buildTemplatesPreviewContextMenuItems: (target) => templatesFeature.buildPreviewContextMenuItems(target),
  handleTemplatesContextMenuAction: (action, target) => templatesFeature.handleContextMenuAction(action, target),
  showToast,
  showSaveError,
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
const goToMeasureModalController = createGoToMeasureModalController();

function normalizeTitleKey(raw, maxLen, strict) {
  return libraryUiStateController.normalizeTitleKey(raw, maxLen, strict);
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
  libraryUiStateController.scheduleSaveLibraryPrefs(patch);
}

function scheduleSaveLibraryUiState() {
  libraryUiStateController.scheduleSaveLibraryUiState();
}

function applyLibraryUiStateFromSettings(settings) {
  return libraryUiStateController.applyLibraryUiStateFromSettings(settings);
}

async function restoreLibraryTuneSelection(selection) {
  return libraryUiStateController.restoreLibraryTuneSelection(selection);
}

async function flushLibraryPrefsSave() {
  await libraryUiStateController.flushLibraryPrefsSave();
}

function applyLibraryPrefsFromSettings(settings) {
  libraryUiStateController.applyLibraryPrefsFromSettings(settings);
  libraryUiStateController.syncControls({ groupBy: $groupBy, sortBy: $sortBy, sortTunesBy: $sortTunesBy });
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
  getRawMode: () => rawMode,
  getRawModeFilePath: () => rawModeFilePath,
  getActiveFilePath: () => activeFilePath,
  getActiveTuneMeta: () => activeTuneMeta,
  getIsNewTuneDraft: () => isNewTuneDraft,
  getHeaderDirty,
  getLibraryRoot: () => (libraryIndex && libraryIndex.root ? String(libraryIndex.root) : ""),
  getLibraryVisible: () => isLibraryVisible,
  hasDiskConflictPath,
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
    getRawMode: () => rawMode,
    getWorkingCopySnapshot: () => workingCopySnapshot,
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
    getWorkingCopySnapshot: () => workingCopySnapshot,
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
    getIsPlaying: () => isPlaying,
    getIsPaused: () => isPaused,
    getWaitingForFirstNote: () => waitingForFirstNote,
    isChordProEnabled: () => chordProFeature.isEnabled(),
    isChordProFullView: () => chordProFeature.isFullView(),
  },
  actions: {
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
    getRawMode: () => rawMode,
  },
  actions: {
    setRawModeUi: setRawModeUI,
    setChordProMode: (enabled) => chordProFeature.setMode(Boolean(enabled)),
    resetChordProState: () => chordProFeature.resetState(),
    resetRawModeState: () => {
      rawModeFilePath = null;
      rawModeHeaderEndOffset = 0;
      rawModeOriginalTuneId = null;
    },
    setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
    setEditorText: setEditorValue,
    scheduleRender: scheduleRenderNow,
    setRenderBusy,
    clearActiveTuneState: () => {
      activeTuneMeta = null;
      activeTuneId = null;
      activeFilePath = null;
    },
    clearSaveSession,
    markHeaderClean,
    setTuneMetaText,
    setFileNameMeta,
    clearErrors,
    setStatus,
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
    getWorkingCopySnapshot: () => workingCopySnapshot,
    getActiveFilePath: () => activeFilePath,
    setActiveFilePath: (next) => { activeFilePath = next; },
    getActiveTuneMeta: () => activeTuneMeta,
    setActiveTuneMeta: (next) => { activeTuneMeta = next; },
    getActiveTuneIndex: () => activeTuneIndex,
    setActiveTuneId: (next) => { activeTuneId = next; },
    setActiveTuneUid: (next) => { activeTuneUid = next; },
    setActiveTuneIndex: (next) => { activeTuneIndex = next; },
    getCurrentDocumentPath,
    getLibraryFilterLabel: () => libraryFilterLabel,
    getLibraryTextFilter: () => libraryTextFilter,
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
    countLines,
    deleteFileContentCacheKey: (key) => fileContentCache.delete(key),
    fileExists,
    getActiveTuneId: () => activeTuneId,
    getFileContentFromCache,
    hasFileContentCacheKey: (key) => fileContentCache.has(key),
    invalidateLibraryView: () => libraryViewStore.invalidate(),
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
        if (document.body.classList.contains("library-list-open")) {
          const rows = libraryViewStore.getModalRows();
          document.dispatchEvent(new CustomEvent("library-modal:update-rows", { detail: { rows } }));
        }
      } catch {}
    },
    updateLibraryRootUI,
  },
});

tuneClipboardController = createTuneClipboardController({
  state: {
    getLibraryIndex: () => libraryIndex,
    getWorkingCopySnapshot: () => workingCopySnapshot,
  },
  actions: {
    getFileContentFromCache,
    pathsEqual,
    readFile,
    resolveTuneEntryFromSnapshot,
    setBufferStatus,
    setFileContentInCache,
    setStatus,
    showSaveError,
  },
});

deleteTuneAction = createDeleteTuneAction({
  api: window.api,
  state: {
    getLibraryIndex: () => libraryIndex,
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getRawMode: () => rawMode,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    isCurrentDocumentDirty,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    confirmDeleteTune,
    countLines,
    discardWorkingCopyChangesForActiveFile,
    ensureSafeToAbandonCurrentDoc,
    findTuneById,
    markActiveTuneButton,
    markCurrentDocumentClean,
    pathsEqual,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    requireCleanForFileOp,
    safeBasename,
    selectTune,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setActiveTuneId: (value) => { activeTuneId = value; },
    setActiveTuneIndex: (value) => { activeTuneIndex = value; },
    setActiveTuneMeta: (value) => { activeTuneMeta = value; },
    setActiveTuneUid: (value) => { activeTuneUid = value; },
    setActiveTuneText,
    setDirtyIndicator,
    setFileContentInCache,
    showSaveError,
    syncLibraryFileFromWorkingCopySnapshot,
  },
});

duplicateTuneAction = createDuplicateTuneAction({
  api: window.api,
  state: {
    isWorkingCopyOpenForFile,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    ensureCopyTitleInAbc,
    findTuneById,
    markActiveTuneButton,
    markDiskConflictPath,
    pathsEqual,
    readFile,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    renumberXInTextKeepingFirst,
    requireCleanForFileOp,
    selectTune,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setActiveTuneId: (value) => { activeTuneId = value; },
    setActiveTuneText,
    setFileContentInCache,
    setStatus,
    showSaveError,
    syncLibraryFileFromWorkingCopySnapshot,
    withFileLock,
    writeFile,
  },
});

pasteMoveTuneAction = createPasteMoveTuneAction({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneId: () => activeTuneId,
    getActiveTuneMeta: () => activeTuneMeta,
    getClipboardTune,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getWorkingCopySnapshot: () => workingCopySnapshot,
    hasGlobalUnsavedChanges,
    isCurrentDocumentDirty,
    isWorkingCopyOpenForFile,
  },
  actions: {
    clearClipboardTune,
    confirmAppendToFile,
    createBlankDocument,
    ensureXNumberInAbc,
    findTuneById,
    flushWorkingCopyTuneSync,
    getActiveEditFilePath,
    getNextXNumber,
    getTuneText,
    markDiskConflictPath,
    pathsEqual,
    readFile,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    removeTuneFromContent,
    renumberXInTextKeepingFirst,
    requireCleanForFileOp,
    resolveTuneEntryFromSnapshot,
    setActiveFilePath: (value) => { activeFilePath = value; },
    setActiveTuneId: (value) => { activeTuneId = value; },
    setActiveTuneMeta: (value) => { activeTuneMeta = value; },
    setClipboardTune,
    setCurrentDocument,
    setFileContentInCache,
    setStatus,
    showSaveError,
    syncLibraryFileFromWorkingCopySnapshot,
    withFileLock,
    withFileLocks,
    writeFile,
  },
});

renumberXAction = createRenumberXAction({
  api: window.api,
  state: {
    getActiveFilePath: () => activeFilePath,
    getActiveTuneIndex: () => activeTuneIndex,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocumentPath,
    getHeaderDirty,
    getIsNewTuneDraft: () => isNewTuneDraft,
    getLibraryIndex: () => libraryIndex,
    getRawMode: () => rawMode,
    isCurrentDocumentDirty,
    isWorkingCopyOpenForFile,
  },
  actions: {
    attachTuneUidsToLibraryFile,
    flushWorkingCopyTuneSync,
    getActiveFileEntry,
    hasUnsavedChangesForFile,
    markCurrentDocumentClean,
    markDiskConflictPath,
    pathsEqual,
    patchCurrentDocument,
    readFile,
    refreshLibraryFile,
    refreshWorkingCopySnapshot,
    renumberXLinesConsecutive,
    resetWorkingCopyTuneSyncDebounce,
    scheduleRenderLibraryTree,
    selectTune,
    setDirtyIndicator,
    setFileContentInCache,
    setStatus,
    showSaveError,
    showToast,
    updateFileContext,
    withFileLock,
    writeFile,
  },
});

libraryLifecycleController = createLibraryLifecycleController({
  api: window.api,
  elements: {
    tuneSelect: $fileTuneSelect,
  },
  state: {
    getLibraryIndex: () => libraryIndex,
    setLibraryIndex: (next) => { libraryIndex = next; },
    getWorkingCopySnapshot: () => workingCopySnapshot,
    getRawMode: () => rawMode,
    getFocusModeEnabled: () => focusModeEnabled,
    getActiveTuneMeta: () => activeTuneMeta,
    getActiveTuneUid: () => activeTuneUid,
    getCurrentDocumentPath,
    getLibraryFilterLabel: () => libraryFilterLabel,
    getSuppressRecentEntries: () => suppressRecentEntries,
    isPayloadMode,
    isWorkingCopyOpenForFile,
    isCurrentDocumentDirty,
  },
  actions: {
    abbreviatePathForLog,
    applyLibraryUiStateFromSettings,
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
    expandInitialCollapsedState: () => libraryUiStateController.expandInitialCollapsedState(),
    getFileContentFromCache,
    getLatestSettingsSnapshot: () => latestSettingsSnapshot,
    invalidateLibraryView: () => libraryViewStore.invalidate(),
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
    markStartupUiReady,
    maybeResetFocusLoopForTune,
    normalizeLibraryPath,
    openChordPro: (filePath, text, options) => chordProFeature.open(filePath, text, options),
    patchCurrentDocument,
    pathsEqual,
    perfNowMs,
    readFile,
    recordNavFilePath,
    recordRecentAction,
    refreshHeaderLayers,
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
    isRawMode: () => rawMode,
    getRawModeFilePath: () => rawModeFilePath,
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

function markStartupUiReady() {
  statusController.markStartupUiReady();
}

function markStartupSettingsApplied() {
  statusController.markStartupSettingsApplied();
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
  isDisabled: () => Boolean(rawMode || chordProFeature.isEnabled()),
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
const abcTransformFeature = createAbcTransformFeature({
  windowRef: window,
  devConfig,
  getEditorText: getEditorValue,
  getHeaderText: getHeaderEditorValue,
  getSettings: () => latestSettingsSnapshot,
  getTransposePreview: getAccumulatedTransposePreview,
  setTransposePreview: setAccumulatedTransposePreview,
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
installDevUiSmokeHook({
  windowRef: window,
  devConfig,
  setEditorText: (text) => {
    suppressDirty = true;
    try {
      setEditorValue(String(text || ""));
    } finally {
      suppressDirty = false;
    }
  },
  getEditorText: getEditorValue,
  scheduleRender: () => scheduleRenderNow({ clearOutput: true, source: "ui-smoke" }),
  elements: {
    playButton: $btnPlayPause,
    stopButton: $btnStop,
    status: $status,
    toast: $toast,
  },
  clickPlay: () => {
    if ($btnPlayPause) $btnPlayPause.click();
  },
  clickStop: () => {
    if ($btnStop) $btnStop.click();
  },
  getState: () => ({
    isPlaying,
    isPaused,
    waitingForFirstNote,
    playbackStartArmed,
  }),
  getHasSvg: () => Boolean($out && $out.querySelector("svg")),
  getPlaybackDebug: () => window.__abcarusPlaybackDebug || null,
});
const rawModeFeature = createRawModeFeature({
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
  getState: () => ({
    rawMode,
    rawModeFilePath,
    rawModeHeaderEndOffset,
    rawModeOriginalTuneId,
  }),
  patchState: (patch = {}) => {
    if (Object.prototype.hasOwnProperty.call(patch, "rawMode")) rawMode = Boolean(patch.rawMode);
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeFilePath")) rawModeFilePath = patch.rawModeFilePath || null;
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeHeaderEndOffset")) rawModeHeaderEndOffset = Number(patch.rawModeHeaderEndOffset) || 0;
    if (Object.prototype.hasOwnProperty.call(patch, "rawModeOriginalTuneId")) rawModeOriginalTuneId = patch.rawModeOriginalTuneId || null;
  },
  getCurrentDoc: getCurrentDocument,
  patchCurrentDoc: (patch = {}) => {
    patchCurrentDocument(patch);
  },
  getActiveFilePath: () => activeFilePath,
  setActiveFilePath: (filePath) => { activeFilePath = filePath || null; },
  getActiveTuneId: () => activeTuneId,
  getActiveTuneMeta: () => activeTuneMeta,
  setRawActiveTuneMeta: (tuneId, meta) => {
    activeTuneId = tuneId || null;
    activeTuneUid = null;
    activeTuneIndex = null;
    activeTuneMeta = meta || null;
  },
  clearUnsavedDiscardState: () => {
    resetHeaderEditorFilePath();
    markHeaderClean();
    markCurrentDocumentClean();
  },
  getHeaderDirty,
  setHeaderClean: markHeaderClean,
  getHeaderText: getHeaderEditorValue,
  getEditorText: getEditorValue,
  setEditorText: setEditorValue,
  setSuppressDirty: (value) => { suppressDirty = Boolean(value); },
  setFocusModeEnabled,
  setBarMismatchMarkers,
  applyRightSplitSizesFromRatio,
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
  ensureWorkingCopyOpenForPath,
  refreshWorkingCopySnapshot,
  handleMissingWorkingCopySave,
  resolveWorkingCopySaveConflictDefault,
  markDiskConflictPath,
  setFileContentInCache,
  attachTuneUidsToLibraryFile,
  updateHeaderStateUI,
  updateFileHeaderPanel,
  setDirtyIndicator,
  setSaveFullFileSession: (filePath, source) => setSaveSession({
    intent: SAVE_INTENT.FULL_FILE,
    targetPath: String(filePath || ""),
    targetTuneUid: "",
    source: source || "raw_mode",
  }),
  ensureSafeToAbandonCurrentDoc,
  setTuneMetaText,
  buildTuneMetaLabel,
  markActiveTuneButton,
  scrollToPosInEditor,
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
  return fileHeaderController.getEditorValue();
}

function setHeaderCollapsed(collapsed) {
  fileHeaderController.setCollapsed(collapsed);
}

function toggleHeaderCollapsed() {
  fileHeaderController.toggleCollapsed();
}

function sortTunes(list, mode) {
  return libraryUiStateController.sortTunes(list, mode);
}

function sortLibraryFiles(files) {
  return libraryUiStateController.sortLibraryFiles(files);
}

function sortGroupEntries(entries) {
  return libraryUiStateController.sortGroupEntries(entries);
}

function setSortMode(mode) {
  const normalized = libraryUiStateController.setSortMode(mode);
  if ($sortBy) $sortBy.value = normalized;
}

function setTuneSortMode(mode) {
  const normalized = libraryUiStateController.setTuneSortMode(mode);
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
  return libraryUiStateController.applyLibraryTextFilter(files, query);
}


function getEditorValue() {
  if (!editorView) return "";
  return editorView.state.doc.toString();
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
  errorsFeature.refreshNow();
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

  const folderCandidate = candidates.find((res) => res && res.type === "folder" && res.entry && res.entry.path);
  if (folderCandidate && folderCandidate.entry) {
    reportStartupStatus("Opening recent folder…");
    try {
      await loadLibraryFromFolder(folderCandidate.entry.path, { selectInitialTune: false });
      if (libraryIndex && libraryIndex.root) {
        statusController.markStartupRecentOpenStarted();
      }
    } catch {}
  }

  for (const res of candidates) {
    if (!res || !res.entry) continue;
    if (res.type === "tune") {
      reportStartupStatus("Opening recent tune…");
      const opened = await openRecentTune(res.entry);
      if (opened && opened.ok) {
        statusController.markStartupRecentOpenStarted();
        return true;
      }
      continue;
    }
    if (res.type === "file") {
      reportStartupStatus("Opening recent file…");
      const opened = await openRecentFile(res.entry);
      if (opened && opened.ok) {
        statusController.markStartupRecentOpenStarted();
        return true;
      }
      continue;
    }
    if (res.type === "folder") {
      if (libraryIndex && libraryIndex.root && pathsEqual(libraryIndex.root, res.entry.path)) {
        statusController.markStartupRecentOpenStarted();
        return true;
      }
      reportStartupStatus("Opening recent folder…");
      const opened = await openRecentFolder(res.entry);
      if (opened && opened.ok) {
        statusController.markStartupRecentOpenStarted();
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

async function confirmRawModeLeave(contextLabel, { save } = {}) {
  const fileDirty = isCurrentDocumentDirty();
  const hdrDirty = getHeaderDirty();
  if (!fileDirty && !hdrDirty) return true;
  const choice = await confirmUnsavedChanges(contextLabel || "continuing");
  if (choice === "cancel") return false;
  if (choice === "save") {
    const saved = typeof save === "function" ? await save() : await performRawSaveFlow();
    return Boolean(saved);
  }
  if (choice === "dont_save") {
    rawModeFeature.discardUnsavedRawState();
    return true;
  }
  return false;
}

function setRawModeUI(enabled) {
  rawModeFeature.setUi(enabled);
}

async function performRawSaveFlow() {
  return rawModeFeature.save();
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
  if (typeof editorView.lineBlockAt !== "function" || !editorView.scrollDOM) return;
  const applyManualScroll = () => {
    try {
      const block = editorView.lineBlockAt(safePos);
      if (!block || !Number.isFinite(Number(block.top))) return;
      const top = Math.max(0, Number(block.top) - 8);
      editorView.scrollDOM.scrollTop = top;
    } catch {}
  };
  if (typeof editorView.requestMeasure === "function") {
    try {
      editorView.requestMeasure({
        read: () => editorView.lineBlockAt(safePos),
        write: (block) => {
          if (!block || !Number.isFinite(Number(block.top))) return;
          editorView.scrollDOM.scrollTop = Math.max(0, Number(block.top) - 8);
        },
      });
      return;
    } catch {}
  }
  applyManualScroll();
}

function selectTuneInRaw(tuneId) {
  rawModeFeature.selectTuneInRaw(tuneId);
}

async function enterRawMode() {
  await rawModeFeature.enter();
}

async function exitRawMode() {
  await rawModeFeature.exit({ ensureSafe: confirmRawModeLeave });
}

async function leaveRawModeForAction(contextLabel) {
  return rawModeFeature.leaveForAction(contextLabel, { ensureSafe: confirmRawModeLeave });
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
  const headerView = fileHeaderController.getEditorView();
  if (headerView && headerView.dom && activeEl && headerView.dom.contains(activeEl)) return headerView;
  if (editorView && editorView.dom && activeEl && editorView.dom.contains(activeEl)) return editorView;
  return editorView || headerView || null;
}

// --- MIDI input / typing preview ---

function getActiveEditorViewForMidi() {
  const activeEl = document.activeElement;
  const headerView = fileHeaderController.getEditorView();
  if (headerView && headerView.dom && activeEl && headerView.dom.contains(activeEl)) return headerView;
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
		    { key: "F4", run: () => { if (rawMode) { showToast("Raw mode: switch to tune mode to play.", 2200); return true; } startPlaybackAtIndex(0); return true; } },
		    { key: "F8", run: () => { resetLayout(); return true; } },
	    { key: "F9", run: () => { refreshErrorsNow(); return true; } },
	  ]);
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      if (!suppressDirty && !isPayloadMode() && !hasCurrentDocument()) {
        ensureCurrentDocument();
      }
      midiInputFeature.handleTypingPreviewChange(update);
      abLoopRuntime.incrementRevision();
      if (abLoopRuntime.hasPlan()) clearAbPlan({ toast: true });
      if (!suppressDirty && hasCurrentDocument() && !isPayloadMode()) {
        patchCurrentDocument({ content: update.state.doc.toString(), dirty: true }, { create: false });
        setDirtyIndicator(true);
      }
      if (!suppressDirty && hasCurrentDocument() && !isPayloadMode()) {
        if (chordProFeature.isEnabled()) {
          chordProFeature.handleEditorDocChanged(update.state.doc.toString());
          scheduleWorkingCopyFullSync();
        } else if (activeTuneUid) scheduleWorkingCopyTuneSync();
      }
      if (!suppressDirty && !rawMode && !chordProFeature.isFullView()) {
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
        payloadModeDecorations.plugin,
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
    if (errorsFeature.isHighlightSuppressingClear()) return;
    const activeErrorHighlight = errorsFeature.getActiveHighlight();
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

function initHeaderEditor() {
  fileHeaderController.initEditor();
}

function setActiveTuneText(text, metadata, options = {}) {
  return libraryLifecycleController.setActiveTuneText(text, metadata, options);
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
  return libraryShellController.setLibraryVisible(visible, { persist });
}

function toggleLibrary() {
  return libraryShellController.toggleLibrary();
}

function buildGroupEntries(files, mode) {
  return buildGroupEntriesCore(files, mode, { normalizeTitleKey });
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
    libraryUiStateController.handleGroupModeChange($groupBy.value || "file");
    libraryUiStateController.syncControls({ groupBy: $groupBy, sortBy: $sortBy, sortTunesBy: $sortTunesBy });
  });
}

if ($sortBy) {
  if ($sortBy.value) setSortMode($sortBy.value);
  $sortBy.addEventListener("change", () => {
    libraryUiStateController.handleSortModeChange($sortBy.value || "");
    libraryUiStateController.syncControls({ sortBy: $sortBy });
  });
}

if ($sortTunesBy) {
  if ($sortTunesBy.value) setTuneSortMode($sortTunesBy.value);
  $sortTunesBy.addEventListener("change", () => {
    libraryUiStateController.handleTuneSortModeChange($sortTunesBy.value || "");
    libraryUiStateController.syncControls({ sortTunesBy: $sortTunesBy });
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
      libraryUiStateController.clearLibrarySearchTimer();
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
    libraryUiStateController.clearLibrarySearchTimer();
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
    errorsFeature.handleScanButtonClick();
  });
}

function startScanForErrorsFromToolbarEnable() {
  errorsFeature.startScanFromToolbarEnable();
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

// debounce
let t = null;

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

function isDebugMessagesEnabled() {
  return Boolean(window.__abcarusDebugMessages);
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

function applyLibrarySearch(value) {
  libraryTextFilter = String(value || "").trim();
  scheduleRenderLibraryTree();
  updateLibraryStatus();
}

function scheduleLibrarySearch(value) {
  libraryUiStateController.scheduleLibrarySearch(value);
}

function setSoundfontStatus(text, autoClearMs) {
  soundfontController.setStatus(text, autoClearMs);
}

function setSoundfontCaption(text) {
  soundfontController.setCaption(text);
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

function beginRenameFile(filePath) {
  renameFileController.beginRenameFile(filePath);
}

async function commitRenameFile(oldPath, inputName) {
  await renameFileController.commitRenameFile(oldPath, inputName);
}

function openMoveTuneModal(tuneId) {
  moveTuneModalController.open(tuneId, {
    files: libraryIndex && Array.isArray(libraryIndex.files) ? libraryIndex.files : [],
    activeFilePath,
  });
}

async function moveTuneToFile(tuneId, targetPath) {
  await pasteMoveTuneAction.moveTuneToFile(tuneId, targetPath);
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
  if (!/(%%\s*MIDI\s+drum(on|bars)?\b|^\s*\+:)/im.test(raw)) return raw;
  // Keep line lengths stable (istart mapping) by replacing "%%" with "% " (comment).
  let inDrumDirectiveRun = false;
  return raw.split(/\r\n|\n|\r/).map((line) => {
    const isDrumDirective = /^\s*%%\s*MIDI\s+drum(on|off|bars)?\b/i.test(line);
    const isContinuation = inDrumDirectiveRun && /^\s*(%%\s*MIDI\s+drum\s+)?\+:/i.test(line);
    if (!isDrumDirective && !isContinuation) {
      inDrumDirectiveRun = false;
      return line;
    }
    inDrumDirectiveRun = isDrumDirective || isContinuation;
    const idx = line.indexOf("%%");
    if (idx < 0) {
      const plusIdx = line.indexOf("+");
      if (plusIdx < 0) return line;
      return `${line.slice(0, plusIdx)}% ${line.slice(plusIdx)}`;
    }
    return `${line.slice(0, idx)}% ${line.slice(idx + 2)}`;
  }).join("\n");
}

function isMidiDrumMustBeInVoicePlaybackError(message) {
  return /%%MIDI\s+(?:drum|drumon|drumoff|drumbars|drummap)\b[^\n]*must be (?:in|within) a voice/i
    .test(String(message || ""));
}

function isMidiDrumBadValueCompatibilityError(message) {
  return /Bad value in %%MIDI\s+(?:drum|drumon|drumoff|drumbars|drummap)\b/i
    .test(String(message || ""));
}

function shouldSuppressUserVisibleAbcError(message) {
  return isMidiDrumMustBeInVoicePlaybackError(message)
    || isMidiDrumBadValueCompatibilityError(message);
}

function hasMidiDrumMustBeInVoicePlaybackError(parseErrors) {
  if (!Array.isArray(parseErrors)) return false;
  return parseErrors.some((e) => isMidiDrumMustBeInVoicePlaybackError(e && e.message ? e.message : ""));
}

function shouldRelocateMidiDrumsForPlayback(scopedOptions) {
  if (!scopedOptions) return true;
  return String(scopedOptions.origin || "") === "focus" && scopedOptions.allowMidiDrums !== false;
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

function addError(message, locOverride, contextOverride) {
  if (shouldSuppressUserVisibleAbcError(message)) return null;
  return errorsFeature.add(message, locOverride, contextOverride);
}

function logErr(m, loc, context) {
  if (shouldSuppressUserVisibleAbcError(m)) return null;
  return errorsFeature.log(m, loc, context);
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
  if (activeFilePath) {
    const raw = safeBasename(activeFilePath).replace(/\.abc$/i, "");
    return sanitizeFileBaseName(raw || "songbook");
  }
  return getSuggestedBaseName();
}

async function runPrintAction(type) {
  await printCurrentFeature.runAction(type);
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
        if (isErrorsEnabled() && isTuneErrorScanInFlight()) {
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
            if (shouldSuppressUserVisibleAbcError(msg)) return;
            const entry = { message: String(msg) };
            errors.push(entry);
            if (!options || !options.suppressGlobalErrors) logErr(msg, null, context);
            if (stopOnFirstError) throw new Error(entry.message);
          },
          errmsg: (msg, line, col) => {
            if (shouldSuppressUserVisibleAbcError(msg)) return;
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

let pendingRenderTimer = null;
let pendingRenderRaf = null;
let renderRequestToken = 0;
let pendingRenderPerfContext = null;
let activeRenderPerfContext = null;
let pendingBarMismatchAnalysisRaf = null;

function setRenderBusy(next) {
  if (playbackUiController) playbackUiController.setRenderBusy(next);
}

function clearRenderOutput(statusText = "Ready") {
  cancelPendingBarMismatchAnalysis();
  setBarMismatchMarkers([]);
  setStatus(statusText || "Ready");
  if ($out) $out.innerHTML = "";
  invalidateNoteHighlightIndexCache();
  setRenderBusy(false);
  updateLibraryErrorIndexFromCurrentErrors();
  reconcileActiveErrorHighlightAfterRender({ renderSucceeded: false });
}

function cancelPendingBarMismatchAnalysis() {
  if (!pendingBarMismatchAnalysisRaf) return;
  try {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(pendingBarMismatchAnalysisRaf);
  } catch {}
  pendingBarMismatchAnalysisRaf = null;
}

function scheduleBarMismatchAnalysisAfterRender(tuneText, token) {
  cancelPendingBarMismatchAnalysis();
  if (!errorsFeature || !tuneText) return;
  try {
    if (typeof requestAnimationFrame !== "function") return;
    const text = String(tuneText || "");
    pendingBarMismatchAnalysisRaf = requestAnimationFrame(() => {
      pendingBarMismatchAnalysisRaf = null;
      if (Number(token) !== Number(renderRequestToken)) return;
      const perfOn = isRenderPerfEnabled();
      const t0 = perfOn ? perfNowMs() : 0;
      errorsFeature.refreshBarMismatchMarkersForTune(text, { deferEditorRefresh: true });
      errorsFeature.addBarMismatchErrorsFromMarkers();
      updateLibraryErrorIndexFromCurrentErrors();
      errorsFeature.updateIndicatorAndPopover();
      if (perfOn) {
        logRenderPerf("bar mismatch: after render", {
          token,
          ms: Math.round(perfNowMs() - t0),
        });
      }
    });
  } catch {}
}

function scheduleRenderNow({ delayMs = 0, clearOutput = false, source = "" } = {}) {
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

  if (isRenderPerfEnabled()) {
    pendingRenderPerfContext = {
      token,
      requestedAtMs: perfNowMs(),
      source: String(source || "scheduleRenderNow"),
      clearOutput: Boolean(clearOutput),
      delayMs: Number(delayMs) || 0,
      editorChars: String(getEditorValue() || "").length,
    };
    logRenderPerf("schedule", {
      token,
      source: pendingRenderPerfContext.source,
      clearOutput: pendingRenderPerfContext.clearOutput,
      delayMs: pendingRenderPerfContext.delayMs,
      editorChars: pendingRenderPerfContext.editorChars,
    });
  } else {
    pendingRenderPerfContext = null;
  }

  const run = () => {
    if (token !== renderRequestToken) return;
    activeRenderPerfContext = pendingRenderPerfContext && pendingRenderPerfContext.token === token
      ? pendingRenderPerfContext
      : null;
    if (activeRenderPerfContext) {
      logRenderPerf("raf -> renderNow", {
        token,
        source: activeRenderPerfContext.source,
        waitMs: Math.round(perfNowMs() - activeRenderPerfContext.requestedAtMs),
      });
    }
    try {
      renderNow();
    } finally {
      activeRenderPerfContext = null;
    }
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

function renderNow() {
  const perfOn = isRenderPerfEnabled();
  const tRender0 = perfOn ? perfNowMs() : 0;
  const perfContext = activeRenderPerfContext;
  const renderToken = perfContext && Number.isFinite(Number(perfContext.token))
    ? Number(perfContext.token)
    : Number(renderRequestToken);
  cancelPendingBarMismatchAnalysis();
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
    if (perfOn) {
      logRenderPerf("renderNow: empty", {
        token: perfContext ? perfContext.token : null,
        totalMs: Math.round(perfNowMs() - tRender0),
      });
    }
    return;
  }
  const tPrepare0 = perfOn ? perfNowMs() : 0;
  let tPrepareStep = tPrepare0;
  const logPrepareStep = (label, data = {}) => {
    if (!perfOn) return;
    const now = perfNowMs();
    logRenderPerf(`renderNow: prepare ${label}`, {
      token: perfContext ? perfContext.token : null,
      ms: Math.round(now - tPrepareStep),
      totalMs: Math.round(now - tPrepare0),
      ...data,
    });
    tPrepareStep = now;
  };
  const renderPayload = getRenderPayload();
  logPrepareStep("payload", {
    payloadChars: renderPayload && renderPayload.text ? String(renderPayload.text).length : 0,
    offset: renderPayload ? (renderPayload.offset || 0) : 0,
  });
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
  logPrepareStep("normalize", {
    renderChars: String(renderText || "").length,
    sepFallbackUsed,
  });
  lastRenderPayload = {
    text: renderText,
    offset: renderPayload.offset || 0,
    lineOffset: Number.isFinite(renderPayload.lineOffset) ? renderPayload.lineOffset : null,
    compatMap: null,
  };
  if (Number.isFinite(renderPayload.lineOffset)) {
    errorsFeature.setLineOffset(renderPayload.lineOffset);
  } else {
    setErrorLineOffsetFromHeader(renderPayload.text.slice(0, renderPayload.offset || 0));
  }
  setStatus("Rendering…");
  if (perfOn) {
    logRenderPerf("renderNow: prepared", {
      token: perfContext ? perfContext.token : null,
      source: perfContext ? perfContext.source : "direct",
      ms: Math.round(perfNowMs() - tPrepare0),
      editorChars: currentText.length,
      payloadChars: String(renderText || "").length,
      offset: renderPayload.offset || 0,
    });
  }

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
        const tSvg0 = perfOn ? perfNowMs() : 0;
        abc.tosvg("out", renderText);
        if (perfOn) {
          logRenderPerf("renderNow: abc2svg", {
            token: perfContext ? perfContext.token : null,
            attempt: attempts,
            ms: Math.round(perfNowMs() - tSvg0),
            svgParts: svgParts.length,
          });
        }
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
        const tDom0 = perfOn ? perfNowMs() : 0;
        $out.innerHTML = svg;
        invalidateNoteHighlightIndexCache();
        applyMeasureHighlights(renderPayload.offset || 0);
        // Keep notation synced to the editor selection (especially after edits re-render the SVG).
        if (editorView) {
          const anchor = editorView.state.selection.main.anchor;
          highlightNoteAtIndex(anchor);
          const activeErrorRange = errorsFeature.getActiveHighlightRange();
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
        updateLibraryErrorIndexFromCurrentErrors();
        reconcileActiveErrorHighlightAfterRender({ renderSucceeded: true });
        scheduleBarMismatchAnalysisAfterRender(currentText, renderToken);
        if (perfOn) {
          logRenderPerf("renderNow: done", {
            token: perfContext ? perfContext.token : null,
            domMs: Math.round(perfNowMs() - tDom0),
            totalMs: Math.round(perfNowMs() - tRender0),
            svgChars: svg.length,
            errors: errorsFeature.getErrors ? errorsFeature.getErrors().length : undefined,
          });
        }
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
if (fileContextController) fileContextController.wire();
setHeaderCollapsed(getHeaderCollapsed());
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
      await window.api.reloadWorkingCopyFromDisk({ force: true });
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
    patchCurrentDocument({ path: p, content: tuneText, dirty: false }, { create: false });
    if (includeHeader) {
      markHeaderClean();
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

async function finalizeWorkingCopySave(filePath) {
  return saveFlowController.finalizeWorkingCopySave(filePath);
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

async function fileNewTuneAndAppendNow() {
  await appendCurrentTuneAction.fileNewTuneAndAppendNow();
}

async function fileOpen() {
  if (documentSessionController) await documentSessionController.fileOpen();
}

async function importMusicXml() {
  await importExportFeature.importMusicXml();
}

async function importMidi() {
  await importExportFeature.importMidi();
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

async function exportMusicXml() {
  await importExportFeature.exportMusicXml();
}

async function exportMidi() {
  await importExportFeature.exportMidi();
}

async function exportMp3() {
  await importExportFeature.exportMp3();
}

async function renumberXInActiveFile(explicitFilePath) {
  await renumberXAction.renumberXInActiveFile(explicitFilePath);
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
			      logStartupPerf("apply settings: begin");
			      setUiFontsFromSettings(settings);
			      setEditorHelpFromSettings(settings);
			      setGlobalHeaderFromSettings(settings);
			      setAbc2svgFontsFromSettings(settings);
	    setSoundfontFromSettings(settings);
	    setDrumVelocityFromSettings(settings);
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
	    libraryUiStateController.setPrefsWriteSuppressed(false);
      if (!settings) markStartupSettingsApplied();
	  }).catch(() => {
      libraryUiStateController.setPrefsWriteSuppressed(false);
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
	    const prevHeader = `${globalHeaderEnabled}|${globalHeaderText}|${abc2svgNotationFontFile}|${abc2svgTextFontFile}`;
	    const prevSoundfont = soundfontController.getName();
      const prevChordproBinPath = prevSettings && prevSettings.chordproBinPath ? String(prevSettings.chordproBinPath) : "";
      const prevChordproRepoPath = prevSettings && prevSettings.chordproRepoPath ? String(prevSettings.chordproRepoPath) : "";
	    setUiFontsFromSettings(settings);
	    setEditorHelpFromSettings(settings);
	    setGlobalHeaderFromSettings(settings);
	    setAbc2svgFontsFromSettings(settings);
		    setSoundfontFromSettings(settings);
		    setDrumVelocityFromSettings(settings);
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
	    if (settings && prevSoundfont !== soundfontController.getName()) {
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
  const activeErrorHighlight = errorsFeature.getActiveHighlight();
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
        markHeaderClean();
        updateHeaderStateUI();
        setStatus(headerRes.action === "save_copy_as" ? "Saved copy and switched." : "Header saved.");
      } else if (headerRes && headerRes.action === "discard_reload") {
        resetHeaderEditorFilePath();
        markHeaderClean();
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
    resetHeaderEditorFilePath();
    markHeaderClean();
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
let lastPlaybackPayloadCache = null;
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
let lastPlaybackChordOnBarError = false;
let lastPlaybackMidiDrumVoiceCompatSeen = false;
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
  const activeErrorHighlight = errorsFeature.getActiveHighlight();
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
  const preparedText = normalizeBlankLinesForPlayback(
    normalizeDollarLineBreaksForPlayback(gchordText)
  );
  const sanitized = sanitizeAbcForPlayback(preparedText);
  const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
  const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
  // Key includes the post-gchord text and the effective expansion mode to avoid reusing a mismatched playbackState.
  return `${sanitized.text}|||${prefixPayload.offset || 0}|||${repeatsFlag}`;
}

function updatePlayButton() {
  if (playbackUiController) playbackUiController.updatePlayButton();
}

function isPlaybackBusy() {
  return playbackUiController ? playbackUiController.isPlaybackBusy() : Boolean(isPlaying || isPaused || waitingForFirstNote);
}

function updatePlaybackInteractionLock() {
  if (playbackUiController) playbackUiController.updatePlaybackInteractionLock();
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
  return soundfontController.ensureLoaded();
}

async function ensureSoundfontReady() {
  return soundfontController.ensureReady();
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
  if (typeof player.set_sfu === "function") player.set_sfu(soundfontController.getSource() || "abc2svg.sf2");
  try { sessionStorage.setItem("audio", "sf2"); } catch {}

  return player;
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

function buildPlaybackState(firstSymbol) {
  const editorLength = editorView ? editorView.state.doc.length : 0;
  return buildPlaybackStateModel(firstSymbol, { editorLength, playbackIndexOffset });
}

function snapIstartToPlayable(istart) {
  return snapIstartToPlayableModel(playbackState, istart);
}

function findSymbolAtOrBefore(idx) {
  return findPlaybackSymbolAtOrBefore(playbackState, idx);
}

function findSymbolAtOrAfter(idx) {
  return findPlaybackSymbolAtOrAfter(playbackState, idx);
}

function findMeasureIndex(idx) {
  return findPlaybackMeasureIndex(playbackState, idx);
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

function getFocusPlaybackState() {
  const selectionSettings = getScopedPlaybackSettingsForOrigin("focus");
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

function computeFocusPlaybackPlanFromCurrentState() {
  if (!editorView) return { ok: false, reason: "Cannot resolve visible scope in Focus mode." };
  const tuneText = getEditorValue();
  const measureIndex = getRenderMeasureIndex();
  const barMap = buildFocusBarIndexMap(measureIndex, editorView.state.doc.length);
  const firstMeasureOffset = findMeasureStartOffsetByNumberInPrimaryVoice(tuneText, 1);
  const focusState = getFocusPlaybackState();
  return buildFocusPlaybackPlanModel({
    parsedTune: {
      text: tuneText,
      barMap,
      byNumber: measureIndex && measureIndex.byNumber ? measureIndex.byNumber : null,
      firstMeasureOffset: Number.isFinite(firstMeasureOffset) ? Number(firstMeasureOffset) : null,
    },
    focusState,
    visibleRange: getVisibleFocusRenderRange(),
    getMeasureStartOffsetByNumber: findMeasureStartOffsetByNumberInPrimaryVoice,
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
    const enabled = isFocusBoundedPlaybackScope()
      || Boolean(!latestSettingsSnapshot || latestSettingsSnapshot.playbackSelectionSuppressRepeats !== false);
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
  soundfontController.setFromSettings(settings);
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
  soundfontController.resetCache();
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
  return buildHeaderPrefixFromLayers({
    layers,
    includeCheckbars: Boolean(includeCheckbars && isMeasureCheckEnabled()),
    tuneText,
  });
}

function buildHeaderPrefixWithLayerSpans(entryHeader, includeCheckbars, tuneText) {
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
  return buildHeaderPrefixWithLayerSpansFromLayers({
    layers,
    includeCheckbars: Boolean(includeCheckbars && isMeasureCheckEnabled()),
    tuneText,
  });
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
    payload = { text: normalizeReadableMidiDrumsForPlayback(payload.text), offset: payload.offset };
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
  const previewText = normalizeReadableMidiDrumsForPlayback(
    normalizeBlankLinesForPlayback(normalizeDollarLineBreaksForPlayback(gchordPreviewText))
  );
  const expandRepeats = window.__abcarusPlaybackExpandRepeats === true;
  const repeatsFlag = expandRepeats ? "exp:on" : "exp:off";
  const drumsFlag = "drums:native";
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
  payload = { text: normalizeReadableMidiDrumsForPlayback(payload.text), offset: payload.offset };
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

  if (skipGchords) payload = { text: stripGchordDirectives(payload.text), offset: payload.offset };
  lastPlaybackMeta = { drumInsertAtLine: null, drumLineCount: 0 };
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
  lastPlaybackMidiDrumVoiceCompatSeen = false;
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
    if (isMidiDrumMustBeInVoicePlaybackError(entry.message)) {
      lastPlaybackMidiDrumVoiceCompatSeen = true;
      playbackSanitizeWarnings.push({ kind: "playback-midi-drums-before-voice", message: entry.message });
      return;
    }
    playbackParseErrors.push(entry);
    if (playbackParseErrors.length > 200) playbackParseErrors = playbackParseErrors.slice(-200);
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
  const playbackPayloadText = playbackPayload.text;
  const playbackPayloadOffset = playbackPayload.offset || 0;
  const selectionMode = selectionPlaybackRuntime.isSelectionMode();
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
    errorsFeature.setLineOffset(playbackPayload.lineOffset);
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
  playbackText = normalizeReadableMidiDrumsForPlayback(playbackText);
  if (/[\\^_]3\/4/.test(playbackText)) {
    playbackSanitizeWarnings.push({ kind: "playback-acc-3_4-normalized" });
    playbackText = normalizeAccThreeQuarterToneForAbc2svg(playbackText);
    showToast("Playback: 3/4-tone accidentals normalized (compat mode).", 3600);
  }
  if (shouldRelocateMidiDrumsForPlayback(scopedOptions)) {
    const relocated = relocateMidiDrumDirectivesIntoBody(playbackText);
    if (relocated && relocated.moved > 0) {
      playbackText = relocated.text;
      if (Number.isFinite(relocated.insertedLength) && relocated.insertedLength > 0) {
        playbackIndexOffset += relocated.insertedLength;
      }
      playbackSanitizeWarnings.push({ kind: "playback-midi-drums-moved-after-k", moved: relocated.moved });
      if (window.__abcarusDebugPlayback) {
        showToast("Playback: moved %%MIDI drum* after K:.", 3200);
      }
    }
  }
  abc.tosvg("play", playbackText);


  // abc2svg requires %%MIDI drum/drumon/drumbars to be inside a voice; many real-world files place them in headers.
  // Neutralize (comment out) these directives for tolerant playback while preserving istart mapping.
  if (lastPlaybackMidiDrumVoiceCompatSeen || hasMidiDrumMustBeInVoicePlaybackError(playbackParseErrors)) {
    playbackSanitizeWarnings.push({ kind: "playback-midi-drums-neutralized" });
    const abc2 = new AbcCtor(user);
    playbackParseErrors = [];
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
          errorsFeature.setLineOffset(retryPayload.lineOffset);
        } else {
          setErrorLineOffsetFromHeader(retryPayload.text.slice(0, playbackIndexOffset));
        }
        let retryText = normalizeHeaderNoneSpacing(retryPayload.text);
        if (/[\\^_]3\/4/.test(retryText)) {
          playbackSanitizeWarnings.push({ kind: "playback-acc-3_4-normalized" });
          retryText = normalizeAccThreeQuarterToneForAbc2svg(retryText);
        }
        if (shouldRelocateMidiDrumsForPlayback(selectionPlaybackRuntime.getScopedOptions())) {
          const relocated = relocateMidiDrumDirectivesIntoBody(retryText);
          if (relocated && relocated.moved > 0) {
            retryText = relocated.text;
            if (Number.isFinite(relocated.insertedLength) && relocated.insertedLength > 0) {
              playbackIndexOffset += relocated.insertedLength;
            }
          }
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
  const isFullFocusStart = startsAtTuneHead
    && rangeForStart
    && rangeForStart.origin === "focus"
    && rangeForStart.endOffset == null
    && !rangeForStart.loop;
  const isFullPartOrderStart = rangeForStart
    && (
      Number(rangeForStart.startOffset) === 0
      || (
        startsAtTuneHead
        && (rangeForStart.origin === "cursor" || rangeForStart.origin === "transport")
      )
      || isFullFocusStart
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
    selectionPlaybackRuntime.setScopedOptions(withScopedPlaybackOrigin(getScopedPlaybackSettingsForOrigin(rangeOrigin), rangeOrigin));
  } else if (rangeOrigin === "ab") {
    const abMuted = selectionPlaybackRuntime.getAbMutedVoiceIds();
    selectionPlaybackRuntime.setScopedOptions({
      origin: "ab",
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
	      setSoundfontCaption("Loading...");
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
    if (typeof p.set_sfu === "function") p.set_sfu(soundfontController.getSource() || "abc2svg.sf2");
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
    const next = !isErrorsEnabled();
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
