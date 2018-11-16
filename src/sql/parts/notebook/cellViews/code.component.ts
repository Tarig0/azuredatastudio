/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Output, EventEmitter, OnChanges, SimpleChange } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { QueryTextEditor } from 'sql/parts/modelComponents/queryTextEditor';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { SimpleProgressService } from 'vs/editor/standalone/browser/simpleServices';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ITextModel } from 'vs/editor/common/model';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import URI from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Schemas } from 'vs/base/common/network';
import * as DOM from 'vs/base/browser/dom';
import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { RunCellAction, NotebookCellToggleMoreActon } from 'sql/parts/notebook/cellViews/codeActions';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { ToggleMoreWidgetAction } from 'sql/parts/dashboard/common/actions';
import { CellTypes } from 'sql/parts/notebook/models/contracts';
import { INotificationService } from 'vs/platform/notification/common/notification';

export const CODE_SELECTOR: string = 'code-component';

@Component({
	selector: CODE_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./code.component.html'))
})
export class CodeComponent extends AngularDisposable implements OnInit, OnChanges {
	@ViewChild('toolbar', { read: ElementRef }) private toolbarElement: ElementRef;
	@ViewChild('moreactions', { read: ElementRef }) private moreactionsElement: ElementRef;
	@ViewChild('editor', { read: ElementRef }) private codeElement: ElementRef;
	@Input() cellModel: ICellModel;
	@Input() hasVerticalToolbar: boolean;

	@Output() public onContentChanged = new EventEmitter<void>();

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	protected _actionBar: Taskbar;
	private readonly _minimumHeight = 30;
	private _editor: QueryTextEditor;
	private _editorInput: UntitledEditorInput;
	private _editorModel: ITextModel;
	private _uri: string;
	private _model: NotebookModel;
	private _activeCellId: string;
	private _toggleMoreActions: NotebookCellToggleMoreActon;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService,
		@Inject(IModelService) private _modelService: IModelService,
		@Inject(IModeService) private _modeService: IModeService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(INotificationService) private notificationService: INotificationService,
	) {
		super();
	}

	ngOnInit() {
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		if (this.hasVerticalToolbar) {
			this.initActionBar();
		}
	}

	ngAfterViewInit() {
		this._toggleMoreActions = new NotebookCellToggleMoreActon(
			this._instantiationService,
			this.contextMenuService,
			this.notificationService,
			this.moreactionsElement,
			this.model);
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		this.updateLanguageMode();
		this.updateModel();
		if (this._toggleMoreActions) {
			this._toggleMoreActions.onChange(this.cellModel, changes);
		}
	}

	ngAfterContentInit(): void {
		this.createEditor();
		this._register(DOM.addDisposableListener(window, DOM.EventType.RESIZE, e => {
			this.layout();
		}));
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	private createEditor(): void {
		let instantiationService = this._instantiationService.createChild(new ServiceCollection([IProgressService, new SimpleProgressService()]));
		this._editor = instantiationService.createInstance(QueryTextEditor);
		this._editor.create(this.codeElement.nativeElement);
		this._editor.setVisible(true);
		this._editor.setMinimumHeight(this._minimumHeight);
		let uri = this.createUri();
		this._editorInput = instantiationService.createInstance(UntitledEditorInput, uri, false, this.cellModel.language, '', '');
		this._editor.setInput(this._editorInput, undefined);
		this._editorInput.resolve().then(model => {
			this._editorModel = model.textEditorModel;
			this._modelService.updateModel(this._editorModel, this.cellModel.source);
		});

		this._register(this._editor);
		this._register(this._editorInput);
		this._register(this._editorModel.onDidChangeContent(e => {
			this._editor.setHeightToScrollHeight();
			this.cellModel.source = this._editorModel.getValue();
			this.onContentChanged.emit();
		}));
		this.layout();
	}

	public layout(): void {
		this._editor.layout(new DOM.Dimension(
			DOM.getContentWidth(this.codeElement.nativeElement),
			DOM.getContentHeight(this.codeElement.nativeElement)));
		this._editor.setHeightToScrollHeight();
	}

	protected initActionBar() {

		let runCellAction = this._instantiationService.createInstance(RunCellAction);

		let taskbar = <HTMLElement>this.toolbarElement.nativeElement;
		this._actionBar = new Taskbar(taskbar, this.contextMenuService);
		this._actionBar.context = this;
		this._actionBar.setContent([
			{ action: runCellAction }
		]);

	}

	private createUri(): URI {
		let uri = URI.from({ scheme: Schemas.untitled, path: `notebook-editor-${this.cellModel.id}` });
		// Use this to set the internal (immutable) and public (shared with extension) uri properties
		this.cellModel.cellUri = uri;
		return uri;
	}

	/// Editor Functions
	private updateModel() {
		if (this._editorModel) {
			this._modelService.updateModel(this._editorModel, this.cellModel.source);
		}
	}

	private updateLanguageMode() {
		if (this._editorModel && this._editor) {
			this._modeService.getOrCreateMode(this.cellModel.language).then((modeValue) => {
				this._modelService.setMode(this._editorModel, modeValue);
			});
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let toolbarEl = <HTMLElement>this.toolbarElement.nativeElement;
		toolbarEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();

		let moreactionsEl = <HTMLElement>this.moreactionsElement.nativeElement;
		moreactionsEl.style.borderRightColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

}
